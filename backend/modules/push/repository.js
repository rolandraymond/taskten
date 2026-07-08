const { PushSubscription } = require('../../models');

async function findByEndpoint(endpoint) {
    return PushSubscription.findOne({
        where: { endpoint },
    });
}

async function upsertForUser(userId, subscription, userAgent) {
    const endpoint = subscription.endpoint;
    const keys = subscription.keys || {};

    const existing = await findByEndpoint(endpoint);

    const payload = {
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent || null,
        last_seen_at: new Date(),
        revoked_at: null,
    };

    if (existing) {
        await existing.update(payload);
        return existing;
    }

    return PushSubscription.create(payload);
}

async function revokeByEndpoint(userId, endpoint) {
    const existing = await PushSubscription.findOne({
        where: {
            user_id: userId,
            endpoint,
        },
    });

    if (!existing) return null;

    await existing.update({
        revoked_at: new Date(),
    });

    return existing;
}

async function findActiveByUserIds(userIds) {
    return PushSubscription.findAll({
        where: {
            user_id: userIds,
            revoked_at: null,
        },
    });
}

module.exports = {
    findByEndpoint,
    upsertForUser,
    revokeByEndpoint,
    findActiveByUserIds,
};