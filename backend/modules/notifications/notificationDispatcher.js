const emailChannel = require('./channels/emailChannel');
const telegramChannel = require('./channels/telegramChannel');
const pushChannel = require('./channels/pushChannel');

const channels = {
    email: emailChannel,
    telegram: telegramChannel,
    push: pushChannel,
};

const ignoredChannels = new Set(['web']);

async function dispatch(notification, options = {}) {
    const requestedChannels = options.channels || notification.sources || [];

    const results = {};

    for (const channelName of requestedChannels) {
        if (ignoredChannels.has(channelName)) {
            continue;
        }

        const channel = channels[channelName];

        if (!channel) {
            console.warn(`[Notifications] Unknown channel ignored: ${channelName}`);
            continue;
        }

        results[channelName] = await channel.send(notification, options);
    }

    return results;
}

module.exports = {
    dispatch,
};