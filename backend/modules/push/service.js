const repository = require('./repository');
const { webpush, isConfigured } = require('./vapid');

async function subscribe(userId, subscription, userAgent) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        const error = new Error('Invalid push subscription');
        error.status = 400;
        throw error;
    }

    return repository.upsertForUser(userId, subscription, userAgent);
}

async function unsubscribe(userId, endpoint) {
    if (!endpoint) {
        const error = new Error('Endpoint is required');
        error.status = 400;
        throw error;
    }

    return repository.revokeByEndpoint(userId, endpoint);
}

async function sendToUsers(userIds, payload) {
    if (!isConfigured || !Array.isArray(userIds) || userIds.length === 0) {
        return false;
    }

    const subscriptions = await repository.findActiveByUserIds(userIds);

    await Promise.all(
        subscriptions.map(async (record) => {
            const subscription = {
                endpoint: record.endpoint,
                keys: {
                    p256dh: record.p256dh,
                    auth: record.auth,
                },
            };

            try {
                await webpush.sendNotification(
                    subscription,
                    JSON.stringify(payload)
                );
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await record.update({ revoked_at: new Date() });
                } else {
                    console.error('[Push] Failed to send notification:', error.message);
                }
            }
        })
    );

    return subscriptions.length > 0;
}

module.exports = {
    subscribe,
    unsubscribe,
    sendToUsers,
};