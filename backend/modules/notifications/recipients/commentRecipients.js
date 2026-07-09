'use strict';

const { User } = require('../../../models');
const { ACTIONS } = require('../../../config/permissions');
const { getUserIdsWithPermission } = require('./permissionRecipients');
const { uniqueUserIds } = require('./utils');

function extractMentionUserIds(content = '') {
    const userIds = new Set();
    const mentionRegex = /@\[.+?\]\(user:(\d+)\)/g;

    for (const match of content.matchAll(mentionRegex)) {
        userIds.add(Number(match[1]));
    }

    return [...userIds];
}
function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

async function resolveMentionRecipients({ content, authorUserId }) {
    const mentionedIds = extractMentionUserIds(content).filter(
        (userId) => userId !== authorUserId
    );

    return uniqueUserIds(mentionedIds);
}

async function resolveCommentAddedRecipients({
    authorUserId,
    excludeUserIds = [],
}) {
    const adminUserIds = await getUserIdsWithPermission(
        ACTIONS.VIEW_TEAM_ACTIVITY
    );

    return uniqueUserIds(adminUserIds).filter(
        (userId) =>
            userId !== authorUserId && !excludeUserIds.includes(userId)
    );
}

module.exports = {
    resolveMentionRecipients,
    resolveCommentAddedRecipients,
};