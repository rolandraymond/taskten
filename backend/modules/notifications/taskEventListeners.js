'use strict';

// ✅ نجيب الـ EventEmitter من taskEvents.js مش events.js
// events.js هو Express Router — taskEvents.js هو الـ domain event bus
const taskEvents = require('../tasks/taskEvents'); // ← التعديل هنا فقط

const notificationsService = require('./service');
const { logError } = require('../../services/logService');

/**
 * بيسجّل كل الـ listeners المتعلقة بإشعارات التاسكات.
 * يُستدعى مرة واحدة فقط في app.js داخل startServer()
 */
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
    console.log('[Push] task.completed event:', event);

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
}

module.exports = { registerTaskNotificationListeners };
