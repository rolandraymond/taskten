'use strict';

const { Role, User } = require('../models');

// Helper داخلي — مش بنـ export عشان مش جزء من الـ Public API
async function _resolveUserId(identifier) {
    if (!identifier) return null;
    if (typeof identifier === 'object' && identifier !== null)
        return identifier.id;
    if (typeof identifier === 'string' && isNaN(Number(identifier))) {
        const user = await User.findOne({
            where: { uid: identifier },
            attributes: ['id'],
        });
        return user?.id ?? null;
    }
    return Number(identifier);
}

// Helper داخلي — قراءة آمنة من Sequelize Instance أو Raw Object
function _readField(obj, snakeCase, camelCase) {
    if (obj?.getDataValue) {
        return obj.getDataValue(snakeCase) ?? obj.getDataValue(camelCase);
    }
    return obj?.[snakeCase] ?? obj?.[camelCase];
}

async function isAdmin(identifier) {
    const userId = await _resolveUserId(identifier);
    if (!userId) return false;

    const role = await Role.findOne({ where: { user_id: userId } });
    if (!role) return false;

    // ✅ نتحقق من role_name أولاً
    const roleName = _readField(role, 'role_name', 'roleName');
    if (roleName === 'admin') return true;

    // 🛑 السطر السحري اللي هيحل المشكلة: لو هو co_admin أو client، امنع فوراً إنه يتقري كأدمن!
    if (
        roleName === 'co_admin' ||
        roleName === 'client' /* || roleName === 'user' */
    )
        return false;

    // Fallback للأنظمة القديمة
    const rawIsAdmin = _readField(role, 'is_admin', 'isAdmin');
    return (
        rawIsAdmin === true ||
        rawIsAdmin === 1 ||
        rawIsAdmin === '1' ||
        rawIsAdmin === 'true'
    );
}

async function getUserRole(identifier) {
    const userId = await _resolveUserId(identifier);
    if (!userId) return 'user';

    const role = await Role.findOne({ where: { user_id: userId } });
    if (!role) return 'user';

    // ✅ role_name هو مصدر الحقيقة الأساسي
    const roleName = _readField(role, 'role_name', 'roleName');
    if (roleName && roleName !== 'user') return roleName;

    // Fallback لو role_name لسه على الديفولت 'user' لكن is_admin = true
    const rawIsAdmin = _readField(role, 'is_admin', 'isAdmin');
    if (
        rawIsAdmin === true ||
        rawIsAdmin === 1 ||
        rawIsAdmin === '1' ||
        rawIsAdmin === 'true'
    ) {
        return 'admin';
    }

    return 'user';
}

// ✅ Helper للـ Middleware — بيتحقق من دور معين أو أعلى
async function hasRole(identifier, requiredRole) {
    const role = await getUserRole(identifier);
    const hierarchy = { admin: 4, co_admin: 3, client: 2, user: 1 };
    return (hierarchy[role] ?? 0) >= (hierarchy[requiredRole] ?? 0);
}

module.exports = { isAdmin, getUserRole, hasRole };
