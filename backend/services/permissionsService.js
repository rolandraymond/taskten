const { Op } = require('sequelize');
const {
    Project,
    Task,
    Note,
    Permission,
    TaskAssignment,
    User,
} = require('../models');
// ✅ 1. استيراد دالة getUserRole عشان نستخدمها في الاستثناءات
const { isAdmin, getUserRole } = require('./rolesService');

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

    if (await isAdmin(numericUserId)) return ACCESS.ADMIN;

    // ملكية المصادر (Ownership)
    if (resourceType === 'project') {
        const proj = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['id', 'user_id'], // ✅ طلبنا الـ id لاستخدامه في التاسكات
            raw: true,
        });
        if (!proj) return ACCESS.NONE;

        // 1. المالك الأساسي للمشروع
        if (proj.user_id === numericUserId) return ACCESS.RW;

        // 2. 👑 استثناء الـ Co-Admin: لو معاه تاسك جوه المشروع، افتحله المشروع!
        const role = await getUserRole(numericUserId);
        if (role === 'co_admin') {
            const projectTasks = await Task.findAll({
                where: { project_id: proj.id },
                attributes: ['id'],
                raw: true,
            });

            if (projectTasks.length > 0) {
                const taskIds = projectTasks.map((t) => t.id);
                const isAssigned = await TaskAssignment.findOne({
                    where: {
                        task_id: { [Op.in]: taskIds },
                        user_id: numericUserId,
                    },
                    raw: true,
                });

                // لو الـ Co-Admin ليه أي تاسك هنا، اديله الصلاحية
                if (isAssigned) return ACCESS.RW;
            }
        }
    } else if (resourceType === 'task') {
        const t = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['id', 'user_id', 'project_id'],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === numericUserId) return ACCESS.RW;

        const isAssigned = await TaskAssignment.findOne({
            where: { task_id: t.id, user_id: numericUserId },
            raw: true,
        });
        if (isAssigned) return ACCESS.RW;

        if (t.project_id) {
            const project = await Project.findOne({
                where: { id: t.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    numericUserId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) return projectAccess;
            }
        }
    } else if (resourceType === 'note') {
        const n = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!n) return ACCESS.NONE;
        if (n.user_id === numericUserId) return ACCESS.RW;

        if (n.project_id) {
            const project = await Project.findOne({
                where: { id: n.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    numericUserId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) return projectAccess;
            }
        }
    }

    const perm = await Permission.findOne({
        where: {
            user_id: numericUserId,
            resource_type: resourceType,
            resource_uid: resourceUid,
        },
        attributes: ['access_level'],
        raw: true,
    });

    return perm ? perm.access_level : ACCESS.NONE;
}

async function ownershipOrPermissionWhere(resourceType, userId, cache = null) {
    const cacheKey = `permission_${resourceType}_${userId}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const numericUserId = !isNaN(Number(userId)) ? Number(userId) : null;
    // 👇 التعديل السحري: كسر قاعدة العزل لو المستخدم أدمن 👇
    // استدعينا دالة isAdmin اللي متعملها import فوق
    if (await isAdmin(numericUserId)) {
        // بنرجع شرط دايماً صحيح (id IS NOT NULL) عشان يشتغل بأمان جوه الـ Op.or في Sequelize
        // ده معناه: "هاتلي كل الداتا بدون أي فلاتر"
        const adminResult = { id: { [Op.ne]: null } };
        if (cache) cache.set(cacheKey, adminResult);
        return adminResult;
    }
    // 👆 ------------------------------------------------ 👆
    const sharedUids = await getSharedUidsForUser(resourceType, numericUserId);

    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser(
            'project',
            numericUserId
        );

        let sharedProjectIds = [];
        if (sharedProjectUids.length > 0) {
            const projects = await Project.findAll({
                where: { uid: { [Op.in]: sharedProjectUids } },
                attributes: ['id'],
                raw: true,
            });
            sharedProjectIds = projects.map((p) => p.id);
        }

        const conditions = [{ user_id: numericUserId }];

        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } });
        }

        if (sharedProjectIds.length > 0) {
            conditions.push({ project_id: { [Op.in]: sharedProjectIds } });
        }

        if (resourceType === 'task') {
            const assignedTasks = await TaskAssignment.findAll({
                where: { user_id: numericUserId },
                attributes: ['task_id'],
                raw: true,
            });
            if (assignedTasks.length > 0) {
                const assignedIds = assignedTasks.map((a) => a.task_id);
                conditions.push({ id: { [Op.in]: assignedIds } });
            }
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // ✅ التعديل الخاص بظهور المشروع في القوائم
    const conditions = [{ user_id: numericUserId }];

    if (sharedUids.length > 0) {
        conditions.push({ uid: { [Op.in]: sharedUids } });
    }

    // 👑 استثناء الـ Co-Admin للقوائم الجانبية (Sidebar)
    if (resourceType === 'project') {
        const role = await getUserRole(numericUserId);
        if (role === 'co_admin') {
            const assignedTasks = await TaskAssignment.findAll({
                where: { user_id: numericUserId },
                attributes: ['task_id'],
                raw: true,
            });
            if (assignedTasks.length > 0) {
                const taskIds = assignedTasks.map((a) => a.task_id);
                const tasksWithProjects = await Task.findAll({
                    where: {
                        id: { [Op.in]: taskIds },
                        project_id: { [Op.ne]: null },
                    },
                    attributes: ['project_id'],
                    raw: true,
                });
                if (tasksWithProjects.length > 0) {
                    const projectIds = tasksWithProjects.map(
                        (t) => t.project_id
                    );
                    conditions.push({ id: { [Op.in]: projectIds } });
                }
            }
        }
    }

    const result = { [Op.or]: conditions };
    if (cache) cache.set(cacheKey, result);
    return result;
}

module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
};
