// ─── مطابق للـ Backend تماماً ─────────────────────────────────────────────────
export const ROLES = {
    ADMIN:    'admin',
    CO_ADMIN: 'co_admin',
    CLIENT:   'client',
    USER:     'user',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ACTIONS = {
    MANAGE_USERS:        'manage_users',
    CREATE_TASK:         'create_task',
    UPDATE_ANY_TASK:     'update_any_task',
    DELETE_ANY_TASK:     'delete_any_task',
    ASSIGN_TASK:         'assign_task',
    VIEW_ASSIGNED_TASKS: 'view_assigned_tasks',
    CREATE_PROJECT:      'create_project',
    DELETE_PROJECT:      'delete_project',
    VIEW_PROJECTS:       'view_projects',
    ACCESS_ADMIN_PANEL:  'access_admin_panel',
} as const;

export type Action = typeof ACTIONS[keyof typeof ACTIONS];

// ─── نسخة الفرونت إند من الصلاحيات ─────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<Role, Action[]> = {
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
    [ROLES.CLIENT]: [
        ACTIONS.VIEW_ASSIGNED_TASKS,
        ACTIONS.VIEW_PROJECTS,
    ],
    [ROLES.USER]: [
        ACTIONS.CREATE_TASK,
        ACTIONS.VIEW_ASSIGNED_TASKS,
        ACTIONS.VIEW_PROJECTS,
    ],
};