'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const config = getConfig();
const router = express.Router();
const usersController = require('./controller');
const usersService = require('./service'); // 👈 لازم نضيف ده عشان نستخدمه تحت
const {
    apiKeyManagementLimiter,
    createResourceLimiter,
} = require('../../middleware/rateLimiter');

// 1. استدعاء ميدل وير الأدمن
const requireAdmin = require('../../middleware/requireAdmin');
// 👇 ضيف السطرين دول
const requirePermission = require('../../middleware/requirePermission');
const { ACTIONS } = require('../../config/permissions');
// --- إعدادات Multer (زي ما هي) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(config.uploadPath, 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const userId = req.currentUser?.id || req.session?.userId;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter,
});

// --- المسارات (Routes) ---

// 2. مسارات الأدمن والـ Co-admin (أي حد معاه صلاحية تعيين تاسك يقدر يشوف المستخدمين)
router.get(
    '/users',
    requirePermission(ACTIONS.ASSIGN_TASK),
    usersController.list
);

router.get(
    '/users/assignment-picker',
    requirePermission(ACTIONS.ASSIGN_TASK),
    async (req, res) => {
        try {
            const users = await usersService.getAssignmentPickerList();
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch assignment list' });
        }
    }
);

// 3. مسارات البروفايل (Profile Routes - للمستخدم الحالي)
router.get('/profile', usersController.getProfile);
router.patch('/profile', usersController.updateProfile);

// Avatar
router.post(
    '/profile/avatar',
    createResourceLimiter,
    upload.single('avatar'),
    usersController.uploadAvatar
);
router.delete(
    '/profile/avatar',
    createResourceLimiter,
    usersController.deleteAvatar
);

// Password
router.post('/profile/change-password', usersController.changePassword);

// API keys
router.get(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    usersController.listApiKeys
);
router.post(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    usersController.createApiKey
);
router.post(
    '/profile/api-keys/:id/revoke',
    apiKeyManagementLimiter,
    usersController.revokeApiKey
);
router.delete(
    '/profile/api-keys/:id',
    apiKeyManagementLimiter,
    usersController.deleteApiKey
);

// Task summary
router.post('/profile/task-summary/toggle', usersController.toggleTaskSummary);
router.post(
    '/profile/task-summary/frequency',
    usersController.updateTaskSummaryFrequency
);
router.post(
    '/profile/task-summary/send-now',
    usersController.sendTaskSummaryNow
);
router.get(
    '/profile/task-summary/status',
    usersController.getTaskSummaryStatus
);

// UI Settings
router.put('/profile/today-settings', usersController.updateTodaySettings);
router.put('/profile/sidebar-settings', usersController.updateSidebarSettings);
router.put('/profile/ui-settings', usersController.updateUiSettings);

module.exports = router;
