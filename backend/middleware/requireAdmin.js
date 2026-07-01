'use strict';

const requirePermission = require('./requirePermission');
const { ACTIONS } = require('../config/permissions');

// ✅ Wrapper بسيط:
// أي Route قديم بيستخدم `requireAdmin`
// هيتم تمريره أوتوماتيكياً للـ Middleware الجديد للتحقق من صلاحية ACCESS_ADMIN_PANEL
const requireAdmin = requirePermission(ACTIONS.ACCESS_ADMIN_PANEL);

module.exports = requireAdmin;
