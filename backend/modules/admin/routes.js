'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('./controller');
const requirePermission = require('../../middleware/requirePermission');
const { ACTIONS } = require('../../config/permissions');

// ✅ كل route عنده حارسه الخاص
router.post(
    '/admin/set-admin-role',
    requirePermission(ACTIONS.MANAGE_USERS),
    adminController.setAdminRole
);
router.get(
    '/admin/users',
    requirePermission(ACTIONS.ACCESS_ADMIN_PANEL),
    adminController.listUsers
);
router.post(
    '/admin/users',
    requirePermission(ACTIONS.MANAGE_USERS),
    adminController.createUser
);
router.put(
    '/admin/users/:id',
    requirePermission(ACTIONS.MANAGE_USERS),
    adminController.updateUser
);
router.delete(
    '/admin/users/:id',
    requirePermission(ACTIONS.MANAGE_USERS),
    adminController.deleteUser
);
router.post(
    '/admin/toggle-registration',
    requirePermission(ACTIONS.MANAGE_USERS),
    adminController.toggleRegistration
);
const { getUserDailyActivityFeed } = require('../tasks/taskEventService');

router.get('/admin/users/:userId/daily-activity', async (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query; // مثال: ?date=2026-06-08

        if (!date) return res.status(400).json({ error: 'Date is required' });

        const activityData = await getUserDailyActivityFeed(userId, date);
        res.json(activityData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
});
module.exports = router;
