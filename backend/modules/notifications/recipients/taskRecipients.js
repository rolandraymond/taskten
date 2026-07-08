'use strict';

const { Task, TaskAssignment } = require('../../../models');
const { ACTIONS } = require('../../../config/permissions');
const { getUserIdsWithPermission } = require('./permissionRecipients');
function uniqueUserIds(userIds) {
    return [...new Set(userIds.filter(Boolean))];
}
async function getTaskById(taskId) {
    return Task.findByPk(taskId, {
        attributes: ['id', 'uid', 'user_id', 'name'],
    });
}

async function getTaskAssigneeIds(taskId) {
    const assignments = await TaskAssignment.findAll({
        where: {
            task_id: taskId,
        },
        attributes: ['user_id'],
    });

    return assignments.map((assignment) => assignment.user_id);
}

async function resolveTaskAssignedRecipients({ assignedToUserId }) {
    return uniqueUserIds([assignedToUserId]);
}

async function resolveTaskCompletedRecipients({ taskId }) {
    const task = await getTaskById(taskId);

    if (!task) {
        return [];
    }

    const assigneeIds = await getTaskAssigneeIds(task.id);
    const teamActivityUserIds = await getUserIdsWithPermission(
        ACTIONS.VIEW_TEAM_ACTIVITY
    );

    return uniqueUserIds([...assigneeIds, ...teamActivityUserIds]);
}

async function resolveTaskCommentRecipients({ taskId, authorUserId }) {
    const task = await getTaskById(taskId);

    if (!task) {
        return [];
    }

    const assigneeIds = await getTaskAssigneeIds(task.id);

    return uniqueUserIds([
        task.user_id,
        ...assigneeIds,
    ]).filter((userId) => userId !== authorUserId);
}

module.exports = {
    getTaskById,
    getTaskAssigneeIds,
    resolveTaskAssignedRecipients,
    resolveTaskCompletedRecipients,
    resolveTaskCommentRecipients,
};