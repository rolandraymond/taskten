const express = require('express');
const router = express.Router();
const notificationsService = require('../notifications/service');

// Import sub-routers for task-related routes
const attachmentsRouter = require('./attachments');
const commentsRouter = require('./comments');
const eventsRouter = require('./events');

const {
    Task,
    TaskEvent,
    RecurringCompletion,
    Project,
    sequelize,
    TaskAssignment,
    User,
} = require('../../models');
const requireAdmin = require('../../middleware/requireAdmin');
const taskRepository = require('./repository');

const {
    resetQueryCounter,
    getQueryStats,
    enableQueryLogging,
} = require('../../middleware/queryLogger');

const {
    calculateNextDueDate,
    calculateVirtualOccurrences,
    shouldGenerateNextTask,
} = require('./recurringTaskService');
const { logError } = require('../../services/logService');
const { logEvent } = require('./taskEventService');

// ✅ التعديل الأول: استيراد الـ EventEmitter من taskEvents.js مش events.js
// events.js هو Express Router للـ timeline/analytics
// taskEvents.js هو الـ domain event bus للإشعارات
const taskEvents = require('./taskEvents');
const { getAccess, ACCESS } = require('../../services/permissionsService');

const { serializeTask, serializeTasks } = require('./core/serializers');
const { updateTaskTags } = require('./operations/tags');
const { filterTasksByParams } = require('./queries/query-builders');
const {
    getSafeTimezone,
    getTodayBoundsInUTC,
    getUpcomingRangeInUTC,
} = require('../../utils/timezone-utils');
const permissionsService = require('../../services/permissionsService');
const { isValidUid } = require('../../utils/slug-utils');

const {
    validateProjectAccess,
    validateParentTaskAccess,
    validateDeferUntilAndDueDate,
} = require('./utils/validation');
const {
    buildTaskAttributes,
    buildUpdateAttributes,
} = require('./core/builders');
const { createSubtasks, updateSubtasks } = require('./operations/subtasks');
const { handleCompletionStatus } = require('./operations/completion');
const { captureOldValues, logTaskChanges } = require('./utils/logging');
const {
    handleParentChildOnStatusChange,
} = require('./operations/parent-child');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('./utils/constants');

const {
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
    addPerformanceHeaders,
} = require('./operations/list');

const {
    handleRecurrenceUpdate,
    calculateNextIterations,
} = require('./operations/recurring');

const { getTaskMetrics } = require('./queries/metrics-computation');

const { getSubtasks } = require('./operations/subtasks');

const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('./middleware/access');
const requirePermission = require('../../middleware/requirePermission');
const { ACTIONS } = require('../../config/permissions');

if (process.env.NODE_ENV === 'development') {
    enableQueryLogging();
}

async function getRecurringParentEndDate(recurringParentId, userId) {
    if (!recurringParentId) return undefined;
    const parent = await taskRepository.findByIdAndUser(
        recurringParentId,
        userId
    );
    if (!parent) return undefined;
    return parent.recurrence_end_date;
}

function expandRecurringTasks(tasks, maxDays = 7, statusFilter = null) {
    const expandedTasks = [];
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    tasks.forEach((task) => {
        const isRecurring =
            task.recurrence_type &&
            task.recurrence_type !== 'none' &&
            !task.recurring_parent_id;

        if (!isRecurring) {
            expandedTasks.push(task);
            return;
        }

        console.log('[DEBUG] Processing recurring task:', {
            id: task.id,
            name: task.name,
            recurrence_type: task.recurrence_type,
            due_date: task.due_date,
            status: task.status,
            completed_at: task.completed_at,
            has_due_date: !!task.due_date,
            statusFilter: statusFilter,
        });

        if (
            (statusFilter === 'completed' || statusFilter === 'done') &&
            (task.status === 2 || task.status === 'done')
        ) {
            console.log(
                '[DEBUG] Task is completed and filter is completed, showing actual task'
            );
            expandedTasks.push(task);
            return;
        }

        let startFrom = task.due_date ? new Date(task.due_date) : now;

        if (task.status === 2 || task.status === 'done') {
            const baseDate =
                task.completion_based && task.completed_at
                    ? new Date(task.completed_at)
                    : new Date(task.due_date || now);
            const nextDate = calculateNextDueDate(task, baseDate);
            startFrom = nextDate || now;
            console.log(
                '[DEBUG] Task is completed, starting from next occurrence:',
                startFrom
            );
        } else if (startFrom < now) {
            let nextDate = startFrom;
            let iterations = 0;
            const MAX_ITERATIONS = 100;

            while (nextDate && nextDate < now && iterations < MAX_ITERATIONS) {
                nextDate = calculateNextDueDate(task, nextDate);
                iterations++;
            }

            startFrom = nextDate || now;
        }

        console.log('[DEBUG] Starting from date:', startFrom);
        const occurrences = calculateVirtualOccurrences(
            task,
            maxDays,
            startFrom
        );
        console.log('[DEBUG] Generated occurrences:', occurrences.length);

        occurrences.forEach((occurrence, index) => {
            const virtualTask = {
                ...(task.toJSON ? task.toJSON() : task),
                due_date: occurrence.due_date,
                is_virtual_occurrence: true,
                occurrence_index: index,
                virtual_id: `${task.id}_occurrence_${index}`,
            };
            expandedTasks.push(virtualTask);
        });
    });

    return expandedTasks;
}
router.get('/task/:uid/users', requireTaskReadAccess, async (req, res) => {
    try {
        const users = await permissionsService.getUsersWithTaskAccess(
            req.params.uid
        );

        res.json(users);
    } catch (error) {
        logError('Error fetching task users:', error);
        res.status(500).json({ error: 'Failed to fetch task users' });
    }
});

router.get('/tasks', async (req, res) => {
    const startTime = Date.now();
    resetQueryCounter();

    try {
        const {
            type,
            groupBy,
            maxDays,
            order_by,
            include_lists,
            limit: limitParam,
            offset: offsetParam,
        } = req.query;
        const { id: userId, timezone, language } = req.currentUser;

        await handleRecurringTasks(userId, type);

        let tasks = await filterTasksByParams(req.query, userId, timezone);

        let upcomingProjects = [];
        if (type === 'upcoming') {
            const safeTimezone = getSafeTimezone(timezone);
            const upcomingRange = getUpcomingRangeInUTC(safeTimezone, 7);
            const { Op } = require('sequelize');

            const ownedOrShared =
                await permissionsService.ownershipOrPermissionWhere(
                    'project',
                    userId
                );

            upcomingProjects = await Project.findAll({
                where: {
                    ...ownedOrShared,
                    due_date_at: {
                        [Op.between]: [upcomingRange.start, upcomingRange.end],
                    },
                    status: {
                        [Op.notIn]: ['completed', 'archived'],
                    },
                },
                order: [['due_date_at', 'ASC']],
            });
        }

        if (type === 'upcoming' && groupBy === 'day') {
            console.log('[DEBUG] Expanding recurring tasks for /upcoming');
            console.log('[DEBUG] Total tasks before expansion:', tasks.length);
            console.log(
                '[DEBUG] Recurring tasks:',
                tasks
                    .filter(
                        (t) => t.recurrence_type && t.recurrence_type !== 'none'
                    )
                    .map((t) => ({
                        id: t.id,
                        name: t.name,
                        recurrence_type: t.recurrence_type,
                        due_date: t.due_date,
                        recurring_parent_id: t.recurring_parent_id,
                    }))
            );
            const days = maxDays ? parseInt(maxDays, 10) : 7;
            tasks = expandRecurringTasks(tasks, days, req.query.status);
            console.log('[DEBUG] Total tasks after expansion:', tasks.length);
        }

        if (type === 'today') {
            const safeTimezone = getSafeTimezone(timezone);
            const todayBounds = getTodayBoundsInUTC(safeTimezone);

            const instancesForToday = tasks.filter(
                (t) =>
                    t.recurring_parent_id &&
                    t.due_date &&
                    new Date(t.due_date) >= todayBounds.start &&
                    new Date(t.due_date) <= todayBounds.end
            );

            const parentIdsWithTodayInstances = new Set(
                instancesForToday.map((t) => t.recurring_parent_id)
            );

            tasks = tasks.filter(
                (t) =>
                    !t.recurrence_type ||
                    t.recurrence_type === 'none' ||
                    t.recurring_parent_id !== null ||
                    !parentIdsWithTodayInstances.has(t.id)
            );
        }

        const hasPagination =
            limitParam !== undefined || offsetParam !== undefined;
        const totalCount = tasks.length;
        let paginatedTasks = tasks;

        if (hasPagination) {
            const limit = parseInt(limitParam, 10) || 20;
            const offset = parseInt(offsetParam, 10) || 0;
            paginatedTasks = tasks.slice(offset, offset + limit);
        }

        const groupedTasks = await buildGroupedTasks(
            paginatedTasks,
            type,
            groupBy,
            maxDays,
            order_by,
            timezone,
            language || 'en'
        );

        const serializationOptions =
            type === 'today' ? { preserveOriginalName: true } : {};

        const response = {
            tasks: await serializeTasks(
                paginatedTasks,
                timezone,
                serializationOptions
            ),
        };

        const serializedGrouped = await serializeGroupedTasks(
            groupedTasks,
            timezone
        );
        if (serializedGrouped) {
            response.groupedTasks = serializedGrouped;
        }

        if (type === 'upcoming' && upcomingProjects.length > 0) {
            response.projects = upcomingProjects.map((project) => ({
                id: project.id,
                uid: project.uid,
                name: project.name,
                status: project.status,
                priority: project.priority,
                due_date_at: project.due_date_at,
                created_at: project.created_at,
                updated_at: project.updated_at,
            }));
        }

        await addDashboardLists(
            response,
            userId,
            timezone,
            type,
            include_lists,
            serializationOptions
        );

        if (hasPagination) {
            const limit = parseInt(limitParam, 10) || 20;
            const offset = parseInt(offsetParam, 10) || 0;
            response.pagination = {
                total: totalCount,
                limit: limit,
                offset: offset,
                hasMore: offset + paginatedTasks.length < totalCount,
            };
        }

        addPerformanceHeaders(res, startTime, getQueryStats());
        res.json(response);
    } catch (error) {
        logError('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get(
    '/tasks/completed-recent',
    requirePermission(ACTIONS.VIEW_TEAM_ACTIVITY),
    async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

        const tasks = await Task.findAll({
            where: {
                status: 2,
            },
            
    
    include: [
            {
                model: Project,
                as: 'Project',
                attributes: ['id', 'uid', 'name'],
            },
        ],
            order: [['completed_at', 'DESC']],
            limit,
        });

        res.json(
    tasks.map((task) => {
        const t = task.get({ plain: true });

        return {
            id: t.id,
            uid: t.uid,
            name: t.name,
            status: t.status,
            completed_at: t.completed_at,
            updated_at: t.updated_at,
            project: t.Project
                ? {
                      id: t.Project.id,
                      uid: t.Project.uid,
                      name: t.Project.name,
                  }
                : null,
        };
    })
);
    } catch (error) {
        console.error('Completed recent tasks error:', error);
        res.status(500).json({ error: 'Failed to load completed tasks' });
    }

    }
);
router.get('/tasks/metrics', async (req, res) => {
    try {
        const response = await getTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone,
            req.query.type
        );

        res.json(response);
    } catch (error) {
        logError('Error fetching task metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/task', async (req, res) => {
    try {
        const { name, project_id, parent_task_id, tags, Tags, subtasks } =
            req.body;
        const tagsData = tags || Tags;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Task name is required.' });
        }

        const timezone = getSafeTimezone(req.currentUser.timezone);
        const taskAttributes = buildTaskAttributes(
            req.body,
            req.currentUser.id,
            timezone
        );

        try {
            const recurringParentEndDate = await getRecurringParentEndDate(
                req.body.recurring_parent_id,
                req.currentUser.id
            );

            validateDeferUntilAndDueDate(
                taskAttributes.defer_until,
                taskAttributes.due_date,
                recurringParentEndDate
            );
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        try {
            const validProjectId = await validateProjectAccess(
                project_id,
                req.currentUser.id
            );
            if (validProjectId) taskAttributes.project_id = validProjectId;
        } catch (error) {
            return res
                .status(error.message === 'Forbidden' ? 403 : 400)
                .json({ error: error.message });
        }

        try {
            const validParentId = await validateParentTaskAccess(
                parent_task_id,
                req.currentUser.id
            );
            if (validParentId) taskAttributes.parent_task_id = validParentId;
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        const task = await taskRepository.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);
        await createSubtasks(task.id, subtasks, req.currentUser.id);

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!taskWithAssociations) {
            logError('Failed to reload created task:', task.id);
            const fallbackTask = {
                ...task.toJSON(),
                tags: [],
                Project: null,
                subtasks: [],
                today_move_count: 0,
                due_date: task.due_date
                    ? task.due_date instanceof Date
                        ? task.due_date.toISOString().split('T')[0]
                        : new Date(task.due_date).toISOString().split('T')[0]
                    : null,
                completed_at: task.completed_at
                    ? task.completed_at instanceof Date
                        ? task.completed_at.toISOString()
                        : new Date(task.completed_at).toISOString()
                    : null,
            };
            return res.status(201).json(fallbackTask);
        }

        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        res.status(201).json(serializedTask);
    } catch (error) {
        logError('Error creating task:', error);
        logError('Error stack:', error.stack);
        logError('Error name:', error.name);
        res.status(400).json({
            error: 'There was a problem creating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.get('/task/:uid', requireTaskReadAccess, async (req, res) => {
    try {
        const task = await taskRepository.findByUid(req.params.uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(
            task,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        res.json(serializedTask);
    } catch (error) {
        logError('Error fetching task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/task/:uid', requireTaskWriteAccess, async (req, res) => {
    try {
        const {
            status,
            project_id,
            parent_task_id,
            tags,
            Tags,
            subtasks,
            recurrence_type,
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekday,
            recurrence_weekdays,
            recurrence_month_day,
            recurrence_week_of_month,
            completion_based,
            update_parent_recurrence,
        } = req.body;

        const tagsData = tags || Tags;

        const task = await taskRepository.findByUid(req.params.uid, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const oldValues = captureOldValues(task);
        const oldStatus = task.status;

        if (update_parent_recurrence && task.recurring_parent_id) {
            const parentTask = await taskRepository.findByIdAndUser(
                task.recurring_parent_id,
                req.currentUser.id
            );

            if (parentTask) {
                await parentTask.update({
                    recurrence_type:
                        recurrence_type !== undefined
                            ? recurrence_type
                            : parentTask.recurrence_type,
                    recurrence_interval:
                        recurrence_interval !== undefined
                            ? recurrence_interval
                            : parentTask.recurrence_interval,
                    recurrence_end_date:
                        recurrence_end_date !== undefined
                            ? recurrence_end_date
                            : parentTask.recurrence_end_date,
                    recurrence_weekday:
                        recurrence_weekday !== undefined
                            ? recurrence_weekday
                            : parentTask.recurrence_weekday,
                    recurrence_weekdays:
                        recurrence_weekdays !== undefined
                            ? recurrence_weekdays
                            : parentTask.recurrence_weekdays,
                    recurrence_month_day:
                        recurrence_month_day !== undefined
                            ? recurrence_month_day
                            : parentTask.recurrence_month_day,
                    recurrence_week_of_month:
                        recurrence_week_of_month !== undefined
                            ? recurrence_week_of_month
                            : parentTask.recurrence_week_of_month,
                    completion_based:
                        completion_based !== undefined
                            ? completion_based
                            : parentTask.completion_based,
                });
            }
        }

        const timezone = getSafeTimezone(req.currentUser.timezone);
        const taskAttributes = buildUpdateAttributes(req.body, task, timezone);

        try {
            const finalDeferUntil =
                taskAttributes.defer_until !== undefined
                    ? taskAttributes.defer_until
                    : task.defer_until;
            const finalDueDate =
                taskAttributes.due_date !== undefined
                    ? taskAttributes.due_date
                    : task.due_date;

            const recurringParentEndDate = await getRecurringParentEndDate(
                task.recurring_parent_id,
                req.currentUser.id
            );

            validateDeferUntilAndDueDate(
                finalDeferUntil,
                finalDueDate,
                recurringParentEndDate
            );
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        await handleCompletionStatus(taskAttributes, status, task);

        if (project_id !== undefined) {
            try {
                const validProjectId = await validateProjectAccess(
                    project_id,
                    req.currentUser.id
                );
                taskAttributes.project_id = validProjectId;
            } catch (error) {
                return res
                    .status(error.message === 'Forbidden' ? 403 : 400)
                    .json({ error: error.message });
            }
        }

        if (parent_task_id !== undefined) {
            if (parent_task_id && parent_task_id.toString().trim()) {
                try {
                    const validParentId = await validateParentTaskAccess(
                        parent_task_id,
                        req.currentUser.id
                    );
                    taskAttributes.parent_task_id = validParentId;
                } catch (error) {
                    return res.status(400).json({ error: error.message });
                }
            } else {
                taskAttributes.parent_task_id = null;
            }
        }

        const recurrenceFields = [
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_weekdays',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        const recurrenceChanged = await handleRecurrenceUpdate(
            task,
            recurrenceFields,
            req.body
        );

        const resolveFinalValue = (field) =>
            taskAttributes[field] !== undefined
                ? taskAttributes[field]
                : task[field];

        const finalRecurrenceType = resolveFinalValue('recurrence_type');
        const finalCompletionBased = resolveFinalValue('completion_based');
        const finalDueDateBeforeAdvance =
            taskAttributes.due_date !== undefined
                ? taskAttributes.due_date
                : task.due_date;

        let recurringCompletionPayload = null;
        let recurrenceAdvanceInfo = null;

        if (
            status !== undefined &&
            (taskAttributes.status === Task.STATUS.DONE ||
                taskAttributes.status === 'done') &&
            finalRecurrenceType &&
            finalRecurrenceType !== 'none' &&
            !task.recurring_parent_id
        ) {
            const completedAt = new Date();
            const hasOriginalDueDate =
                finalDueDateBeforeAdvance !== undefined &&
                finalDueDateBeforeAdvance !== null &&
                finalDueDateBeforeAdvance !== '';
            const originalDueDate = hasOriginalDueDate
                ? new Date(finalDueDateBeforeAdvance)
                : new Date(completedAt);
            const recurrenceContext = {
                ...(typeof task.get === 'function'
                    ? task.get({ plain: true })
                    : task),
                recurrence_type: finalRecurrenceType,
                recurrence_interval: resolveFinalValue('recurrence_interval'),
                recurrence_end_date: resolveFinalValue('recurrence_end_date'),
                recurrence_weekday: resolveFinalValue('recurrence_weekday'),
                recurrence_weekdays: resolveFinalValue('recurrence_weekdays'),
                recurrence_month_day: resolveFinalValue('recurrence_month_day'),
                recurrence_week_of_month: resolveFinalValue(
                    'recurrence_week_of_month'
                ),
                completion_based: finalCompletionBased,
                due_date: originalDueDate,
            };

            const baseDate = finalCompletionBased
                ? completedAt
                : new Date(originalDueDate);
            const nextDueDate = calculateNextDueDate(
                recurrenceContext,
                baseDate
            );

            recurringCompletionPayload = {
                task_id: task.id,
                completed_at: completedAt,
                original_due_date: new Date(originalDueDate),
                skipped: false,
            };
            recurrenceAdvanceInfo = {
                originalDueDate: new Date(originalDueDate),
                completedAt,
                nextDueDate,
            };

            if (
                nextDueDate &&
                shouldGenerateNextTask(recurrenceContext, nextDueDate)
            ) {
                taskAttributes.status = Task.STATUS.NOT_STARTED;
                taskAttributes.completed_at = null;
                taskAttributes.due_date = nextDueDate;
            }
        }

        console.log('[routes.js] Before task.update - taskAttributes:', {
            status: taskAttributes.status,
            completed_at: taskAttributes.completed_at,
        });

        await task.update(taskAttributes);
        const updatedTask = await taskRepository.findById(task.id, {
        include: [
        {
            model: Project,
            as: 'Project',
            attributes: ['id', 'uid', 'name'],
        },
    ]   ,
        });
        const wasJustCompleted =
        oldStatus !== Task.STATUS.DONE &&
        oldStatus !== 'done' &&
        (updatedTask.status === Task.STATUS.DONE ||
        updatedTask.status === 'done');

        if (wasJustCompleted) {
            taskEvents.emit('task.completed', {
            id: updatedTask.id,
            uid: updatedTask.uid,
            name: updatedTask.name,
            status: updatedTask.status,
            completed_at: updatedTask.completed_at,
            completed_by: req.currentUser.id,
            project: updatedTask.Project
        ? {
              id: updatedTask.Project.id,
              uid: updatedTask.Project.uid,
              name: updatedTask.Project.name,
          }
        : null,
        });
        }
        console.log('[routes.js] After task.update - task values:', {
            id: task.id,
            status: task.status,
            completed_at: task.completed_at,
        });

        if (
            taskAttributes.status !== undefined &&
            taskAttributes.status !== Task.STATUS.DONE &&
            taskAttributes.status !== 'done' &&
            task.completed_at !== null
        ) {
            console.log(
                '[routes.js] DEFENSIVE CHECK TRIGGERED - Force clearing completed_at'
            );
            await task.update({ completed_at: null });
            console.log(
                '[routes.js] After defensive update - completed_at:',
                task.completed_at
            );
        }

        if (status !== undefined) {
            await handleParentChildOnStatusChange(
                task,
                oldStatus,
                taskAttributes.status,
                req.currentUser.id
            );
        }

        if (recurringCompletionPayload) {
            await RecurringCompletion.create(recurringCompletionPayload);
            try {
                await logEvent({
                    taskId: task.id,
                    userId: req.currentUser.id,
                    eventType: 'recurring_occurrence_completed',
                    fieldName: 'recurrence',
                    oldValue: recurrenceAdvanceInfo
                        ? recurrenceAdvanceInfo.originalDueDate
                        : null,
                    newValue: recurrenceAdvanceInfo
                        ? recurrenceAdvanceInfo.nextDueDate
                        : null,
                    metadata: {
                        action: 'recurring_occurrence_completed',
                        original_due_date:
                            recurrenceAdvanceInfo?.originalDueDate?.toISOString?.() ??
                            recurrenceAdvanceInfo?.originalDueDate,
                        next_due_date:
                            recurrenceAdvanceInfo?.nextDueDate?.toISOString?.() ??
                            null,
                        completion_based: finalCompletionBased,
                    },
                });
            } catch (eventError) {
                logError(
                    'Error logging recurring occurrence completion event:',
                    eventError
                );
            }
        }

        await updateTaskTags(task, tagsData, req.currentUser.id);
        await updateSubtasks(task.id, subtasks, req.currentUser.id);
        await logTaskChanges(
            task,
            oldValues,
            req.body,
            tagsData,
            req.currentUser.id
        );

        const taskWithAssociations = await taskRepository.findById(task.id, {
            include: TASK_INCLUDES_WITH_SUBTASKS,
        });

        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        res.json(serializedTask);
    } catch (error) {
        logError('Error updating task:', error);
        res.status(400).json({
            error: 'There was a problem updating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.delete('/task/:uid', requireTaskWriteAccess, async (req, res) => {
    try {
        const task = await taskRepository.findByUid(req.params.uid);

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const taskId = task.id;

        const childTasks = await taskRepository.findRecurringChildren(taskId);

        if (childTasks.length > 0) {
            const now = new Date();

            const futureInstances = childTasks.filter((child) => {
                if (!child.due_date) return true;
                return new Date(child.due_date) > now;
            });

            const pastInstances = childTasks.filter((child) => {
                if (!child.due_date) return false;
                return new Date(child.due_date) <= now;
            });

            for (const futureInstance of futureInstances) {
                await futureInstance.destroy();
            }

            for (const pastInstance of pastInstances) {
                await pastInstance.update({
                    recurring_parent_id: null,
                    recurrence_type: 'none',
                    recurrence_interval: null,
                    recurrence_end_date: null,
                    recurrence_weekday: null,
                    recurrence_month_day: null,
                    recurrence_week_of_month: null,
                    completion_based: false,
                });
            }
        }

        await sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            await TaskEvent.destroy({
                where: { task_id: taskId },
                force: true,
            });

            await sequelize.query('DELETE FROM tasks_tags WHERE task_id = ?', {
                replacements: [taskId],
            });

            await taskRepository.clearRecurringParent(taskId);

            await task.destroy({ force: true });
        } finally {
            await sequelize.query('PRAGMA foreign_keys = ON');
        }

        res.json({ message: 'Task successfully deleted' });
    } catch (error) {
        res.status(400).json({
            error: 'There was a problem deleting the task.',
        });
    }
});

router.get('/task/:uid/subtasks', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const task = await taskRepository.findByUid(req.params.uid);
        if (!task) {
            return res.json([]);
        }

        const result = await getSubtasks(
            task.id,
            req.currentUser.id,
            req.currentUser.timezone
        );

        if (result.error === 'Forbidden') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (result.error === 'Not found') {
            return res.json([]);
        }

        res.json(result.subtasks);
    } catch (error) {
        logError('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 💡 متنساش تعمل استدعاء للـ Permissions Service فوق في أول الملف لو مش موجودة
// const { getAccess, ACCESS } = require('../../services/permissionsService'); // عدل المسار حسب مكان الملف

router.get('/task/:uid/next-iterations', async (req, res) => {
    try {
        if (!isValidUid(req.params.uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }

        const task = await taskRepository.findByUid(req.params.uid);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // 🌟 التعديل السحري: استخدام نظام الصلاحيات المركزي بدل الشرط القديم
        const accessLevel = await getAccess(
            req.currentUser.id,
            'task',
            req.params.uid
        );

        if (accessLevel === ACCESS.NONE) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return res.json({ iterations: [] });
        }

        const iterations = await calculateNextIterations(
            task,
            req.query.startFromDate,
            req.currentUser.timezone
        );

        res.json({ iterations });
    } catch (error) {
        logError('Error getting next iterations:', error);
        res.status(500).json({ error: 'Failed to get next iterations' });
    }
});

// ─── Task Assignment Routes (Admin Only) ──────────────────────────────────────

// ✅ استخدام الصلاحية المخصصة بدل الأدمن المطلق
// ✅ استخدام الصلاحية المخصصة بدل الأدمن المطلق
router.put(
    '/task/:uid/assign-multiple',
    requirePermission(ACTIONS.ASSIGN_TASK),
    async (req, res) => {
        try {
            const userIdsArray = Array.isArray(req.body)
                ? req.body
                : req.body.user_ids || [];

            const task = await taskRepository.findByUid(req.params.uid);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            // 1. جلب التكليفات الحالية (قبل الحذف) لمقارنتها بالجديدة
            const currentAssignments = await TaskAssignment.findAll({
                where: { task_id: task.id },
            });
            const currentUserIds = currentAssignments.map((a) =>
                a.user_id.toString()
            );
            const newUserIdsStr = userIdsArray.map((id) => id.toString());

            // 2. استخراج الموظفين الجدد فقط (عشان نبعتلهم إشعار هما بس ومنعملش إزعاج للباقي)
            const newlyAssignedIds = newUserIdsStr.filter(
                (id) => !currentUserIds.includes(id)
            );

            // 3. تنظيف التكليفات القديمة
            await TaskAssignment.destroy({ where: { task_id: task.id } });

            // 4. إضافة التكليفات الجديدة
            if (userIdsArray.length > 0) {
                const assignments = userIdsArray.map((userId) => ({
                    task_id: task.id,
                    user_id: parseInt(userId, 10),
                    assigned_by: req.currentUser.id,
                }));

                await TaskAssignment.bulkCreate(assignments);

                // 🌟 إرسال الإشعار للموظفين الجدد "فقط"
                for (const userId of newlyAssignedIds) {
                    taskEvents.emit('task.assigned', {
                        taskId: task.id,
                        taskName: task.name,
                        assignedToUserId: parseInt(userId, 10),
                        assignedByUserId: req.currentUser.id,
                    });
                }
            }

            // 🌟 التحديث اللحظي (Real-time Sync)
            // نطلق حدث عام بأن هذه المهمة تم تحديثها، ليقوم الـ WebSocket/SSE بإبلاغ باقي المتصفحات
            taskEvents.emit('task.updated', {
                task_id: task.id,
                uid: task.uid,
                action: 'assignments_changed',
            });

            // 5. جلب المهمة بالبيانات الجديدة (عشان الفرانتد يقدر يقرأ صور وأسماء الموظفين فوراً)
            const taskWithAssociations = await taskRepository.findById(
                task.id,
                {
                    include: TASK_INCLUDES_WITH_SUBTASKS,
                }
            );

            const serializedTask = await serializeTask(
                taskWithAssociations,
                req.currentUser.timezone,
                { skipDisplayNameTransform: true }
            );

            // نرد بالـ Task كاملة بدل رسالة نصية لتطابق توقعات الـ Frontend
            res.json(serializedTask);
        } catch (error) {
            console.error('Assign multiple error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.delete(
    '/task/:uid/assign/:user_id',
    requirePermission(ACTIONS.ASSIGN_TASK),
    async (req, res) => {
        try {
            const { user_id } = req.params;
            const task = await taskRepository.findByUid(req.params.uid);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const deletedRows = await TaskAssignment.destroy({
                where: { task_id: task.id, user_id: parseInt(user_id) },
            });

            if (deletedRows === 0) {
                return res
                    .status(404)
                    .json({ error: 'Assignment not found for this user' });
            }

            // تسجيل الحدث في الـ audit log فقط (مش إشعار)
            try {
                await logEvent({
                    taskId: task.id,
                    userId: req.currentUser.id,
                    eventType: 'task_updated',
                    fieldName: 'assignee',
                    oldValue: user_id.toString(),
                    newValue: null,
                    metadata: { unassigned_from: user_id },
                });
            } catch (eventErr) {
                console.log(
                    'Non-fatal error logging unassignment event:',
                    eventErr.message
                );
            }

            res.json({ message: 'Task unassigned successfully' });
        } catch (error) {
            console.error('Error unassigning task:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Mount sub-routers
router.use(attachmentsRouter);
router.use(commentsRouter);
router.use(eventsRouter);

module.exports = router;
