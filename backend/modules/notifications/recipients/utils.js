'use strict';

function uniqueUserIds(userIds) {
    return [...new Set(userIds.filter(Boolean))];
}

module.exports = {
    uniqueUserIds,
};