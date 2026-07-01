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
}

module.exports = { registerTaskNotificationListeners };
