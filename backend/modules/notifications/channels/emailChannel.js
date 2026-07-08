async function send(notification) {
    try {
        const { sendEmail, isEmailEnabled } = require('../../../services/emailService');

        if (!isEmailEnabled() || !notification.message) {
            return false;
        }

        const UserModel = notification.sequelize.models.User;
        const user = await UserModel.findByPk(notification.user_id, {
            attributes: ['email', 'name'],
        });

        if (!user?.email) {
            return false;
        }

        await sendEmail({
            to: user.email,
            subject: notification.title,
            text: notification.message,
        });

        await notification.markChannelAsSent('email');
        return true;
    } catch (error) {
        console.error('[Notifications][Email] Failed:', error);
        return false;
    }
}

module.exports = {
    send,
};