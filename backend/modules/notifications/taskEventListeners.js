'use strict';

const taskEvents = require('../tasks/taskEvents');
const notificationsService = require('./service');
const { logError } = require('../../services/logService');

function registerTaskNotificationListeners() {
    taskEvents.on(
        'task.assigned',
        async ({ taskId, taskName, assignedToUserId, assignedByUserId }) => {
            try {
                await notificationsService.sendTaskAssignmentNotification(
                    assignedToUserId,
                    taskId,
                    taskName,
                    assignedByUserId
                );
            } catch (error) {
                logError(
                    '[taskEventListeners] task.assigned notification failed',
                    error
                );
            }
        }
    );

    taskEvents.on('task.completed', async (event) => {
        try {
            const { Notification } = require('../../models');
            const {
                resolveTaskCompletedRecipients,
                getTaskById,
            } = require('./recipients/taskRecipients');

            const task = await getTaskById(event.id);
            if (!task) return;

            const recipientIds = await resolveTaskCompletedRecipients({
                taskId: event.id,
            });

            await Promise.all(
                recipientIds.map((userId) =>
                    Notification.createNotification({
                        userId,
                        type: 'task_completed',
                        title: 'Task Completed',
                        message: `${event.name || task.name} has been completed`,
                        data: {
                            taskId: event.id,
                            taskUid: task.uid,
                            url: `/task/${task.uid}`,
                        },
                        sources: ['web', 'push'],
                        sentAt: new Date(),
                        level: 'success',
                    })
                )
            );
        } catch (error) {
            logError(
                '[taskEventListeners] task.completed notification failed',
                error
            );
        }
    });

    taskEvents.on('comment.added', async (event) => {
    try {
        const { Notification } = require('../../models');
        const { getTaskById } = require('./recipients/taskRecipients');
        const {
            resolveMentionRecipients,
            resolveCommentAddedRecipients,
        } = require('./recipients/commentRecipients');

        const task = await getTaskById(event.taskId);
        if (!task) return;

        const mentionedUserIds = await resolveMentionRecipients({
            content: event.content,
            authorUserId: event.authorUserId,
        });

        const commentRecipientIds = await resolveCommentAddedRecipients({
            authorUserId: event.authorUserId,
            excludeUserIds: mentionedUserIds,
        });

        await Promise.all([
            ...commentRecipientIds.map((userId) =>
                Notification.createNotification({
                    userId,
                    type: 'comment_added',
                    title: 'New Comment',
                    message: `New comment on ${task.name}`,
                    data: {
                        taskId: task.id,
                        taskUid: task.uid,
                        commentUid: event.commentUid,
                        url: `/task/${task.uid}`,
                    },
                    sources: ['web', 'push'],
                    sentAt: new Date(),
                    level: 'info',
                })
            ),
            ...mentionedUserIds.map((userId) =>
                Notification.createNotification({
                    userId,
                    type: 'mention',
                    title: 'You were mentioned',
                    message: `You were mentioned in a comment on ${task.name}`,
                    data: {
                        taskId: task.id,
                        taskUid: task.uid,
                        commentUid: event.commentUid,
                        url: `/task/${task.uid}`,
                    },
                    sources: ['web', 'push'],
                    sentAt: new Date(),
                    level: 'info',
                })
            ),
        ]);
    } catch (error) {
        logError(
            '[taskEventListeners] comment.added notification failed',
            error
        );
    }
});
}

module.exports = { registerTaskNotificationListeners };