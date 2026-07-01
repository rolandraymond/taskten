const { Task, Tag, Project, User, TaskAssignment } = require('../../../models');
const taskRepository = require('../repository');
const permissionsService = require('../../../services/permissionsService');
const { logError } = require('../../../services/logService');
const { serializeTask } = require('../core/serializers');
const { parsePriority, parseStatus } = require('../core/parsers');
const taskEventService = require('../taskEventService'); // ✅ استدعاء السيرفيس اللي بتسجل الأنشطة

async function getSubtasks(parentTaskId, userId, timezone) {
    const parent = await taskRepository.findById(parentTaskId);
    if (!parent) {
        return { error: 'Not found', subtasks: [] };
    }

    const pAccess = await permissionsService.getAccess(
        userId,
        'task',
        parent.uid
    );
    if (pAccess === 'none') {
        return { error: 'Forbidden', subtasks: null };
    }

    const subtasks = await taskRepository.findAll(
        { parent_task_id: parentTaskId },
        {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
                {
                    model: TaskAssignment,
                    as: 'TaskAssignments',
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'AssignedUser',
                            attributes: [
                                'id',
                                'name',
                                'surname',
                                'email',
                                'uid',
                                'avatar_image',
                            ],
                        },
                    ],
                },
            ],
            order: [
                ['order', 'ASC'],
                ['created_at', 'ASC'],
            ],
        }
    );

    const serializedSubtasks = await Promise.all(
        subtasks.map((subtask) => serializeTask(subtask, timezone))
    );

    return { error: null, subtasks: serializedSubtasks };
}

async function createSubtasks(parentTaskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const existingSubtasks = await taskRepository.findAll(
        { parent_task_id: parentTaskId },
        { attributes: ['order'], order: [['order', 'DESC']], limit: 1 }
    );
    const maxOrder = existingSubtasks[0]?.order ?? 0;

    const subtasksData = subtasks
        .filter((subtask) => subtask.name && subtask.name.trim())
        .map((subtask, index) => ({
            name: subtask.name.trim(),
            parent_task_id: parentTaskId,
            user_id: userId,
            priority: parsePriority(subtask.priority) || Task.PRIORITY.LOW,
            status: parseStatus(subtask.status),
            completed_at:
                subtask.status === 'done' || subtask.status === Task.STATUS.DONE
                    ? subtask.completed_at
                        ? new Date(subtask.completed_at)
                        : new Date()
                    : null,
            recurrence_type: 'none',
            completion_based: false,
            order: maxOrder + index + 1,
        }));

    await taskRepository.createMany(subtasksData);
}

async function updateSubtasks(taskId, subtasks, userId) {
    if (!subtasks || !Array.isArray(subtasks)) return;

    const existingSubtasks = await taskRepository.findChildren(taskId, userId);

    let hasChanges = false; // 🔥 متغير جديد عشان نراقب لو حصل أي تعديل فعلي للموظف

    const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
    const subtasksToDelete = existingSubtasks.filter(
        (existing) => !subtasksToKeep.find((keep) => keep.id === existing.id)
    );

    // 1. مسح مهام فرعية
    if (subtasksToDelete.length > 0) {
        hasChanges = true; // 👈 حصل تغيير
        if (
            subtasksToDelete.length === existingSubtasks.length &&
            subtasks.length === 0
        ) {
            logError(
                'WARNING: Attempting to delete all subtasks with empty array:',
                {
                    taskId,
                    userId,
                    existingCount: existingSubtasks.length,
                    providedCount: subtasks.length,
                }
            );
        }

        await taskRepository.destroyMany({
            where: {
                id: subtasksToDelete.map((s) => s.id),
                user_id: userId,
            },
        });
    }

    const allSubtasksToUpdate = subtasks.filter((s) => s.id);
    const subtasksToUpdate = subtasks.filter(
        (s) =>
            s.id &&
            ((s.isEdited && s.name && s.name.trim()) || s._statusChanged)
    );

    // 2. تحديث مهام فرعية موجودة
    if (subtasksToUpdate.length > 0 || allSubtasksToUpdate.length > 0) {
        if (subtasksToUpdate.length > 0) hasChanges = true; // 👈 حصل تغيير فعلي (مش مجرد ترتيب)

        const updatePromises = allSubtasksToUpdate.map((subtask, index) => {
            const updateData = { order: index + 1 };

            if (subtasksToUpdate.includes(subtask)) {
                if (subtask.isEdited && subtask.name && subtask.name.trim()) {
                    updateData.name = subtask.name.trim();
                }

                if (subtask._statusChanged || subtask.status !== undefined) {
                    updateData.status = parseStatus(subtask.status);
                    if (
                        updateData.status === Task.STATUS.DONE &&
                        !subtask.completed_at
                    ) {
                        updateData.completed_at = new Date();
                    } else if (updateData.status !== Task.STATUS.DONE) {
                        updateData.completed_at = null;
                    }
                }

                if (subtask.priority !== undefined) {
                    updateData.priority =
                        parsePriority(subtask.priority) || Task.PRIORITY.LOW;
                }
            }

            return taskRepository.bulkUpdate(updateData, {
                where: { id: subtask.id, user_id: userId },
            });
        });

        await Promise.all(updatePromises);
    }

    const newSubtasks = subtasks.filter(
        (s) => s.isNew && s.name && s.name.trim()
    );

    // 3. إضافة مهام فرعية جديدة
    if (newSubtasks.length > 0) {
        hasChanges = true; // 👈 حصل تغيير
        await createSubtasks(taskId, newSubtasks, userId);
    }

    // 🚀 الخطوة السحرية: لو الموظف عمل أي تعديل، نسجل الـ Event فوراً عشان يظهر للأدمن وفي الـ Timeline 🚀
    if (hasChanges) {
        try {
            await taskEventService.logEvent({
                taskId: taskId,
                userId: userId,
                // استعملنا الـ Event ده تحديداً لأنه مسموح بيه في الـ DB وإحنا برمجناه في الفرانتد يظهر باسم المهام الفرعية
                eventType: 'completion_based_changed',
                fieldName: 'completion_based',
                oldValue: null,
                newValue: {
                    subtasks_updated: true,
                    total_subtasks: subtasks.length,
                },
                metadata: { action: 'subtasks_updated' },
            });
        } catch (err) {
            logError('Error logging subtasks update event:', err);
        }
    }
}

module.exports = {
    getSubtasks,
    createSubtasks,
    updateSubtasks,
};
