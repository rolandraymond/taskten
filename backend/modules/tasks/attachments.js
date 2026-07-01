const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const config = getConfig();
const { TaskAttachment, Task } = require('../../models');
const { uid } = require('../../utils/uid');
const { logError } = require('../../services/logService');
const {
    validateFileType,
    deleteFileFromDisk,
    getFileUrl,
} = require('../../utils/attachment-utils');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const permissionsService = require('../../services/permissionsService');
const {
    createResourceLimiter,
    authenticatedApiLimiter,
} = require('../../middleware/rateLimiter');

const router = express.Router();

// Ensure authenticated
router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(config.uploadPath, 'tasks');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.fileUploadLimitMB * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        if (validateFileType(file.mimetype)) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    },
});

// ==========================================
// 1. Upload Attachment (Supports Both Routes)
// Old: /upload/task-attachment (uses req.body.taskUid)
// New: /task/:taskUid/attachments (uses req.params.taskUid)
// ==========================================
router.post(
    ['/upload/task-attachment', '/task/:taskUid/attachments'],
    createResourceLimiter,
    upload.single('file'),
    async (req, res) => {
        try {
            // ✅ السحر هنا: لو جيالك من المسار الجديد خده من params، لو من القديم خده من body
            const taskUid = req.params.taskUid || req.body.taskUid;
            const userId = req.authUserId;

            if (!taskUid) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res.status(400).json({ error: 'Task UID is required' });
            }

            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res.status(404).json({ error: 'Task not found' });
            }

            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res
                    .status(403)
                    .json({ error: 'Not authorized to upload to this task' });
            }

            const attachmentCount = await TaskAttachment.count({
                where: { task_id: task.id },
            });
            if (attachmentCount >= 20) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res
                    .status(400)
                    .json({ error: 'Maximum 20 attachments allowed per task' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const attachment = await TaskAttachment.create({
                uid: uid(),
                task_id: task.id,
                user_id: userId,
                original_filename: req.file.originalname,
                stored_filename: req.file.filename,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                file_path: `tasks/${req.file.filename}`,
            });

            res.status(201).json({
                ...attachment.toJSON(),
                file_url: getFileUrl(req.file.filename),
            });
        } catch (error) {
            logError('Error uploading attachment:', error);
            if (req.file) await deleteFileFromDisk(req.file.path);
            res.status(500).json({
                error: 'Failed to upload attachment',
                details: error.message,
            });
        }
    }
);

// ==========================================
// 2. Get All Attachments (Supports Both Routes)
// ==========================================
router.get(
    ['/tasks/:taskUid/attachments', '/task/:taskUid/attachments'],
    async (req, res) => {
        try {
            const { taskUid } = req.params;
            const userId = req.authUserId;

            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.ro) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to view this task' });
            }

            const attachments = await TaskAttachment.findAll({
                where: { task_id: task.id },
                order: [['created_at', 'ASC']],
            });

            const attachmentsWithUrls = attachments.map((att) => ({
                ...att.toJSON(),
                file_url: getFileUrl(att.stored_filename),
            }));

            res.json(attachmentsWithUrls);
        } catch (error) {
            logError('Error fetching attachments:', error);
            res.status(500).json({
                error: 'Failed to fetch attachments',
                details: error.message,
            });
        }
    }
);

// ==========================================
// 3. Delete Attachment (Supports Both Routes)
// ==========================================
router.delete(
    [
        '/tasks/:taskUid/attachments/:attachmentUid',
        '/task/:taskUid/attachments/:attachmentUid',
    ],
    createResourceLimiter,
    async (req, res) => {
        try {
            const { taskUid, attachmentUid } = req.params;
            const userId = req.authUserId;

            const task = await Task.findOne({ where: { uid: taskUid } });
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const access = await permissionsService.getAccess(
                userId,
                'task',
                taskUid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to modify this task' });
            }

            const attachment = await TaskAttachment.findOne({
                where: { uid: attachmentUid, task_id: task.id },
            });

            if (!attachment)
                return res.status(404).json({ error: 'Attachment not found' });

            const filePath = path.join(config.uploadPath, attachment.file_path);
            await deleteFileFromDisk(filePath);
            await attachment.destroy();

            res.json({ message: 'Attachment deleted successfully' });
        } catch (error) {
            logError('Error deleting attachment:', error);
            res.status(500).json({
                error: 'Failed to delete attachment',
                details: error.message,
            });
        }
    }
);

// ==========================================
// 4. Download Attachment (Supports Both Routes)
// Old: /attachments/:attachmentUid/download
// New: /task/:taskUid/attachments/:attachmentUid/download
// ==========================================
router.get(
    [
        '/attachments/:attachmentUid/download',
        '/task/:taskUid/attachments/:attachmentUid/download',
    ],
    authenticatedApiLimiter,
    async (req, res) => {
        try {
            const { attachmentUid } = req.params;
            const userId = req.authUserId;

            const attachment = await TaskAttachment.findOne({
                where: { uid: attachmentUid },
                include: [{ model: Task, required: true }],
            });

            if (!attachment)
                return res.status(404).json({ error: 'Attachment not found' });

            // Using the task associated with the attachment ensures old routes still work perfectly
            const access = await permissionsService.getAccess(
                userId,
                'task',
                attachment.Task.uid
            );
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.ro) {
                return res
                    .status(403)
                    .json({ error: 'Not authorized to download this file' });
            }

            const filePath = path.join(config.uploadPath, attachment.file_path);
            res.download(filePath, attachment.original_filename);
        } catch (error) {
            logError('Error downloading attachment:', error);
            res.status(500).json({
                error: 'Failed to download attachment',
                details: error.message,
            });
        }
    }
);

module.exports = router;
