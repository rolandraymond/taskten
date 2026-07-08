const pushService = require('../../push/service');

async function send(notification, options = {}) {
    try {
        const userIds = options.userIds || [notification.user_id];

        const payload = {
            title: notification.title || 'Tasksten7',
            body: notification.message || '',
            url: notification.data?.url || notification.data?.taskUrl || '/',
            notification_uid: notification.uid,
            type: notification.type,
            data: notification.data || {},
        };

        const sent = await pushService.sendToUsers(userIds, payload);

        if (sent) {
            await notification.markChannelAsSent('push');
        }

        return sent;
    } catch (error) {
        console.error('[Notifications][Push] Failed:', error);
        return false;
    }
}

module.exports = {
    send,
};