async function send(notification) {
    try {
        if (!notification.message) {
            return false;
        }

        if (notification.wasChannelRecentlySent('telegram')) {
            return false;
        }

        const telegramService = require('../../telegram/telegramNotificationService');

        const UserModel = notification.sequelize.models.User;
        const user = await UserModel.findByPk(notification.user_id, {
            attributes: [
                'id',
                'name',
                'surname',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });

        if (!user || !telegramService.isTelegramConfigured(user)) {
            return false;
        }

        await telegramService.sendTelegramNotification(user, {
            title: notification.title,
            message: notification.message,
            data: notification.data,
            level: notification.level || 'info',
        });

        await notification.markChannelAsSent('telegram');
        return true;
    } catch (error) {
        console.error('[Notifications][Telegram] Failed:', error);
        return false;
    }
}

module.exports = {
    send,
};