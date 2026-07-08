'use strict';

const { User } = require('../../../models');
const { getUserRole } = require('../../../services/rolesService');
const { roleHasPermission } = require('../../../config/permissions');

async function getUsersWithPermission(action) {
    const users = await User.findAll({
    attributes: ['id', 'uid', 'name', 'surname', 'email'],
});

    const allowedUsers = [];

    for (const user of users) {
        const role = await getUserRole(user.id);

        if (roleHasPermission(role, action)) {
            allowedUsers.push(user);
        }
    }

    return allowedUsers;
}

async function getUserIdsWithPermission(action) {
    const users = await getUsersWithPermission(action);
    return users.map((user) => user.id);
}

module.exports = {
    getUsersWithPermission,
    getUserIdsWithPermission,
};