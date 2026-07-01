'use strict';

const { getUserRole } = require('../services/rolesService');
const { roleHasPermission } = require('../config/permissions');

/**
 * Middleware حارس عام — بيتحقق من الـ Action قبل ما يوصل للـ Controller
 *
 * الاستخدام:
 *   router.delete('/:uid', requirePermission(ACTIONS.DELETE_ANY_TASK), controller.delete);
 *
 * @param {string} requiredAction - الـ action المطلوب من ملف permissions.js
 */
const requirePermission = (requiredAction) => {
    return async (req, res, next) => {
        try {
            if (!req.currentUser?.id) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }

            const role = await getUserRole(req.currentUser.id);

            if (!roleHasPermission(role, requiredAction)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    required: requiredAction,
                });
            }

            // ✅ بنحط الـ role على الـ request عشان الـ Controller يقدر يستخدمه
            req.currentUserRole = role;
            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = requirePermission;
