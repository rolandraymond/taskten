'use strict';

// ─── الـ Roles المتاحة في النظام ─────────────────────────────────────────────
const ROLES = {
    ADMIN: 'admin',
    CO_ADMIN: 'co_admin',
    CLIENT: 'client',
    USER: 'user',
};

// ─── الـ Actions المتاحة (زودها لما تزود feature جديدة) ──────────────────────
const ACTIONS = {
    // User Management
    MANAGE_USERS: 'manage_users',

    // Tasks
    CREATE_TASK: 'create_task',
    UPDATE_ANY_TASK: 'update_any_task',
    DELETE_ANY_TASK: 'delete_any_task',
    ASSIGN_TASK: 'assign_task',
    VIEW_ASSIGNED_TASKS: 'view_assigned_tasks',

    // Projects
    CREATE_PROJECT: 'create_project',
    DELETE_PROJECT: 'delete_project',
    VIEW_PROJECTS: 'view_projects',

    // Admin Panel
    ACCESS_ADMIN_PANEL: 'access_admin_panel',
};

// ─── ربط كل Role بصلاحياته ───────────────────────────────────────────────────
// لو زدت Role جديد → زوده هنا فقط، مش في أي ملف تاني
const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: [
        ACTIONS.MANAGE_USERS,
        ACTIONS.CREATE_TASK,
        ACTIONS.UPDATE_ANY_TASK,
        ACTIONS.DELETE_ANY_TASK,
        ACTIONS.ASSIGN_TASK,
        ACTIONS.VIEW_ASSIGNED_TASKS,
        ACTIONS.CREATE_PROJECT,
        ACTIONS.DELETE_PROJECT,
        ACTIONS.VIEW_PROJECTS,
        ACTIONS.ACCESS_ADMIN_PANEL,
    ],
    [ROLES.CO_ADMIN]: [
        ACTIONS.CREATE_TASK,
        ACTIONS.UPDATE_ANY_TASK,
        ACTIONS.ASSIGN_TASK,
        ACTIONS.VIEW_ASSIGNED_TASKS,
        ACTIONS.CREATE_PROJECT,
        ACTIONS.VIEW_PROJECTS,
    ],
    [ROLES.CLIENT]: [ACTIONS.VIEW_ASSIGNED_TASKS, ACTIONS.VIEW_PROJECTS],
    [ROLES.USER]: [
        ACTIONS.CREATE_TASK,
        ACTIONS.VIEW_ASSIGNED_TASKS,
        ACTIONS.VIEW_PROJECTS,
    ],
};

/**
 * هل الـ Role معاه الصلاحية دي؟
 * @param {string} role
 * @param {string} action
 * @returns {boolean}
 */
function roleHasPermission(role, action) {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes(action);
}

module.exports = { ROLES, ACTIONS, ROLE_PERMISSIONS, roleHasPermission };
