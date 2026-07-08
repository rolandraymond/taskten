'use strict';

const permissionRecipients = require('./permissionRecipients');
const taskRecipients = require('./taskRecipients');

function uniqueUserIds(userIds) {
    return [...new Set(userIds.filter(Boolean))];
}

module.exports = {
    permissionRecipients,
    taskRecipients,
    uniqueUserIds,
};