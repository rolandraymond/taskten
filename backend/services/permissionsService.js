const { Op } = require('sequelize');
const {
    Project,
    Task,
    Note,
    Permission,
    TaskAssignment,
    User,
} = require('../models');

const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };

async function getSharedUidsForUser(resourceType, userId) {
    const rows = await Permission.findAll({
        where: { user_id: userId, resource_type: resourceType },
        attributes: ['resource_uid'],
        raw: true,
    });
    const set = new Set(rows.map((r) => r.resource_uid));
    return Array.from(set);
}

async function getAccess(userId, resourceType, resourceUid) {
    let numericUserId = !isNaN(Number(userId)) ? Number(userId) : null;

    if (numericUserId === null && typeof userId === 'string') {
        const user = await User.findOne({
            where: { uid: userId },
            attributes: ['id'],
            raw: true,
        });

        numericUserId = user ? user.id : null;
    }

    if (!numericUserId) return ACCESS.NONE;

    if (await isAdmin(numericUserId)) {
        return ACCESS.ADMIN;
    }

    if (resourceType === 'project') {
        const project = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['id', 'user_id'],
            raw: true,
        });

        if (!project) {
            return ACCESS.NONE;
        }

        // Owner of the Section
        if (project.user_id === numericUserId) {
            return ACCESS.RW;
        }
    } else if (resourceType === 'task') {
        const task = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['id', 'user_id', 'project_id'],
            raw: true,
        });

        if (!task) {
            return ACCESS.NONE;
        }

        // Task owner
        if (task.user_id === numericUserId) {
            return ACCESS.RW;
        }

        // Direct task assignment.
        // Important: this lets the Team Leader keep access to the task
        // even after the parent Section is revoked.
        const isAssigned = await TaskAssignment.findOne({
            where: {
                task_id: task.id,
                user_id: numericUserId,
            },
            raw: true,
        });

        if (isAssigned) {
            return ACCESS.RW;
        }

        // Access inherited from the Section
        if (task.project_id) {
            const project = await Project.findOne({
                where: { id: task.project_id },
                attributes: ['uid'],
                raw: true,
            });

            if (project) {
                const projectAccess = await getAccess(
                    numericUserId,
                    'project',
                    project.uid
                );

                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess;
                }
            }
        }
    } else if (resourceType === 'note') {
        const note = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });

        if (!note) {
            return ACCESS.NONE;
        }

        if (note.user_id === numericUserId) {
            return ACCESS.RW;
        }

        if (note.project_id) {
            const project = await Project.findOne({
                where: { id: note.project_id },
                attributes: ['uid'],
                raw: true,
            });

            if (project) {
                const projectAccess = await getAccess(
                    numericUserId,
                    'project',
                    project.uid
                );

                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess;
                }
            }
        }
    }

    // Direct permission on the requested resource
    const permission = await Permission.findOne({
        where: {
            user_id: numericUserId,
            resource_type: resourceType,
            resource_uid: resourceUid,
        },
        attributes: ['access_level'],
        raw: true,
    });

    return permission ? permission.access_level : ACCESS.NONE;
}

async function ownershipOrPermissionWhere(resourceType, userId, cache = null) {
    const cacheKey = `permission_${resourceType}_${userId}`;

    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const numericUserId = !isNaN(Number(userId)) ? Number(userId) : null;

    if (await isAdmin(numericUserId)) {
        const adminResult = {
            id: {
                [Op.ne]: null,
            },
        };

        if (cache) {
            cache.set(cacheKey, adminResult);
        }

        return adminResult;
    }

    const sharedUids = await getSharedUidsForUser(
        resourceType,
        numericUserId
    );

    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser(
            'project',
            numericUserId
        );

        let sharedProjectIds = [];

        if (sharedProjectUids.length > 0) {
            const projects = await Project.findAll({
                where: {
                    uid: {
                        [Op.in]: sharedProjectUids,
                    },
                },
                attributes: ['id'],
                raw: true,
            });

            sharedProjectIds = projects.map(
                (project) => project.id
            );
        }

        const conditions = [
            {
                user_id: numericUserId,
            },
        ];

        if (sharedUids.length > 0) {
            conditions.push({
                uid: {
                    [Op.in]: sharedUids,
                },
            });
        }

        if (sharedProjectIds.length > 0) {
            conditions.push({
                project_id: {
                    [Op.in]: sharedProjectIds,
                },
            });
        }

        if (resourceType === 'task') {
            const assignedTasks = await TaskAssignment.findAll({
                where: {
                    user_id: numericUserId,
                },
                attributes: ['task_id'],
                raw: true,
            });

            if (assignedTasks.length > 0) {
                const assignedTaskIds = assignedTasks.map(
                    (assignment) => assignment.task_id
                );

                conditions.push({
                    id: {
                        [Op.in]: assignedTaskIds,
                    },
                });
            }
        }

        const result = {
            [Op.or]: conditions,
        };

        if (cache) {
            cache.set(cacheKey, result);
        }

        return result;
    }

    // Projects / Sections and other direct resources
    const conditions = [
        {
            user_id: numericUserId,
        },
    ];

    if (sharedUids.length > 0) {
        conditions.push({
            uid: {
                [Op.in]: sharedUids,
            },
        });
    }

    const result = {
        [Op.or]: conditions,
    };

    if (cache) {
        cache.set(cacheKey, result);
    }

    return result;
}

async function getUsersWithTaskAccess(taskUid) {
    const users = await User.findAll({
        attributes: ['id', 'uid', 'name', 'surname', 'email', 'avatar_image'],
    });

    const allowedUsers = [];

    for (const user of users) {
        const access = await getAccess(user.id, 'task', taskUid);

        if (access !== ACCESS.NONE) {
            const fullName = [user.name, user.surname]
                .filter(Boolean)
                .join(' ')
                .trim();

            allowedUsers.push({
                id: user.id,
                uid: user.uid,
                label: fullName || user.email || 'Unknown user',
                email: user.email,
                avatar: user.avatar_image || null,
                access,
            });
        }
    }

    return allowedUsers;
}
module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
    getUsersWithTaskAccess,
};
