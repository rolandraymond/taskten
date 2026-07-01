'use strict';

const adminRepository = require('./repository');
const {
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
} = require('./validation');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
    UnauthorizedError,
    ConflictError,
} = require('../../shared/errors');
const { isAdmin } = require('../../services/rolesService');

class AdminService {
    /**
     * Check if requester is admin or if bootstrapping (no roles yet).
     */
    async verifyAdminOrBootstrap(requesterId) {
        if (!requesterId) {
            throw new UnauthorizedError('Authentication required');
        }

        const requester = await adminRepository.findUserUidById(requesterId);
        if (!requester) {
            throw new UnauthorizedError('Authentication required');
        }

        const requesterIsAdmin = await isAdmin(requester.uid);
        const existingRolesCount = await adminRepository.countRoles();

        if (!requesterIsAdmin && existingRolesCount > 0) {
            throw new ForbiddenError('Forbidden');
        }

        return true;
    }

    /**
     * Check if requester is admin.
     */
    async verifyAdmin(requesterId) {
        if (!requesterId) {
            throw new UnauthorizedError('Authentication required');
        }

        const user = await adminRepository.findUserUidById(requesterId);
        if (!user) {
            throw new UnauthorizedError('Authentication required');
        }

        const admin = await isAdmin(user.uid);
        if (!admin) {
            throw new ForbiddenError('Forbidden');
        }

        return true;
    }

    /**
     * Set admin role for a user.
     */
    async setAdminRole(requesterId, body) {
        await this.verifyAdminOrBootstrap(requesterId);

        const { user_id, is_admin: makeAdmin } = validateSetAdminRole(body);

        const user = await adminRepository.findUserById(user_id);
        if (!user) {
            throw new ValidationError('Invalid user_id');
        }

        const [role] = await adminRepository.findOrCreateRole(
            user_id,
            makeAdmin
        );

        // ✅ التعديل هنا: بنحدث القيمتين مع بعض عشان نرضي التستات والنظام الجديد
        role.is_admin = makeAdmin;
        role.role_name = makeAdmin ? 'admin' : 'user';
        await role.save();

        return { user_id, is_admin: role.is_admin };
    }

    /**
     * List all users with roles.
     */
    /**
     * List all users with roles.
     */
    async listUsers(requesterId) {
        await this.verifyAdmin(requesterId);

        const users = await adminRepository.findAllUsers();
        const roles = await adminRepository.findAllRoles();

        const roleMap = new Map();
        for (const r of roles) {
            const userId = r.getDataValue
                ? (r.getDataValue('user_id') ?? r.getDataValue('userId'))
                : (r.user_id ?? r.userId);

            const isAdminVal = r.getDataValue
                ? (r.getDataValue('is_admin') ?? r.getDataValue('isAdmin'))
                : (r.is_admin ?? r.isAdmin);

            const isActuallyAdmin =
                isAdminVal === true ||
                isAdminVal === 1 ||
                isAdminVal === '1' ||
                isAdminVal === 'true';

            const roleNameVal = r.getDataValue
                ? (r.getDataValue('role_name') ?? r.getDataValue('roleName'))
                : (r.role_name ?? r.roleName);

            // ✅ التعديل هنا: أولوية الـ Admin لو الـ role_name لسه على الديفولت
            let finalRole = roleNameVal;
            if (!finalRole || finalRole === 'user') {
                finalRole = isActuallyAdmin ? 'admin' : 'user';
            }

            roleMap.set(userId, finalRole);
        }

        return users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            surname: u.surname,
            created_at: u.created_at,
            role: roleMap.get(u.id) || 'user',
        }));
    }

    /**
     * Create a new user.
     */
    async createUser(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const { email, password, name, surname, role } =
            validateCreateUser(body);

        const userData = { email, password };
        if (name) userData.name = name;
        if (surname) userData.surname = surname;

        let user;
        try {
            user = await adminRepository.createUser(userData);
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        // بـ
        const makeAdmin = role === 'admin' || role === 'co_admin';
        const [userRole, roleCreated] = await adminRepository.findOrCreateRole(
            user.id,
            makeAdmin
        );
        if (!roleCreated) {
            userRole.is_admin = makeAdmin;
            userRole.role_name = role || 'user'; // ✅ حفظ الـ role_name
            await userRole.save();
        } else {
            userRole.role_name = role || 'user';
            await userRole.save();
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role: userRole.role_name, // ✅ نرجع الرول الجديد للفرونت إند
        };
    }

    /**
     * Update a user.
     */
    async updateUser(requesterId, userId, body) {
        await this.verifyAdmin(requesterId);

        const id = validateUserId(userId);
        const user = await adminRepository.findUserById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { email, password, name, surname, role } = body || {};

        if (email !== undefined && email !== null) {
            validateEmail(email);
            user.email = email;
        }

        if (password && password.trim() !== '') {
            validatePassword(password);
            user.password = password;
            user.changed('password_digest', true);
        }

        if (name !== undefined) user.name = name || null;
        if (surname !== undefined) user.surname = surname || null;

        try {
            await user.save();
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        if (role !== undefined) {
            const makeAdmin = role === 'admin' || role === 'co_admin';
            const [userRole] = await adminRepository.findOrCreateRole(
                user.id,
                makeAdmin
            );

            // ✅ نحدث الـ is_admin والـ role_name مع بعض
            userRole.is_admin = makeAdmin;
            userRole.role_name = role;
            await userRole.save();
        }

        const userRole = await adminRepository.findRoleByUserId(user.id);

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            role:
                userRole?.role_name ||
                userRole?.roleName ||
                (userRole?.is_admin === true ||
                userRole?.isAdmin === true ||
                userRole?.is_admin === 1
                    ? 'admin'
                    : 'user'),
        };
    }

    /**
     * Delete a user.
     */
    async deleteUser(requesterId, userId) {
        await this.verifyAdmin(requesterId);

        const id = validateUserId(userId);

        if (id === requesterId) {
            throw new ValidationError('Cannot delete your own account');
        }

        const result = await adminRepository.deleteUserWithData(
            id,
            requesterId
        );

        if (!result.success) {
            if (result.status === 404) {
                throw new NotFoundError(result.error);
            }
            throw new ValidationError(result.error);
        }

        return null;
    }

    /**
     * Toggle registration setting.
     */
    async toggleRegistration(requesterId, body) {
        await this.verifyAdmin(requesterId);

        const { enabled } = validateToggleRegistration(body);

        const {
            setRegistrationEnabled,
        } = require('../auth/registrationService');
        await setRegistrationEnabled(enabled);

        return { enabled };
    }
}

module.exports = new AdminService();
