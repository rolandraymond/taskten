import { useMemo } from 'react';
import { getCurrentUser } from '../utils/userUtils';
import { ROLE_PERMISSIONS, ROLES, Role, Action } from '../config/permissions';

interface UsePermissionsReturn {
    /** هل المستخدم معاه الصلاحية دي؟ */
    can: (action: Action) => boolean;
    /** الـ Role الحالي */
    role: Role;
    /** shortcuts مفيدة */
    isAdmin: boolean;
    isCoAdminOrAbove: boolean;
    isClient: boolean;
}

export const usePermissions = (): UsePermissionsReturn => {
    const user = getCurrentUser();
    const role = (user?.role as Role) || ROLES.USER;

    const permissions = useMemo(
        () => ROLE_PERMISSIONS[role] || [],
        [role]
    );

    const can = (action: Action): boolean => permissions.includes(action);

    return {
        can,
        role,
        isAdmin:           role === ROLES.ADMIN,
        isCoAdminOrAbove:  role === ROLES.ADMIN || role === ROLES.CO_ADMIN,
        isClient:          role === ROLES.CLIENT,
    };
};