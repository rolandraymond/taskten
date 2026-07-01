const path = require('path');
const fs = require('fs').promises;
const { logError } = require('../services/logService');
const { getConfig } = require('../config/config');

const config = getConfig();

// Allowed MIME types and their extensions
const ALLOWED_TYPES = {
    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
    ],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    // Images
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg'],
    'image/webp': ['.webp'],
    // Spreadsheets
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
    ],
    'text/csv': ['.csv'],
    // Archives
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
};

/**
 * Validate if file type is allowed
 */
function validateFileType(mimetype) {
    return !!ALLOWED_TYPES[mimetype];
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimetype) {
    const extensions = ALLOWED_TYPES[mimetype];
    return extensions ? extensions[0] : '';
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file is an image
 */
function isImageFile(mimetype) {
    return mimetype.startsWith('image/');
}

/**
 * Check if file is a PDF
 */
function isPdfFile(mimetype) {
    return mimetype === 'application/pdf';
}

/**
 * Check if file is a text file
 */
function isTextFile(mimetype) {
    return mimetype.startsWith('text/');
}

/**
 * Delete file from disk safely (Test & Production Ready)
 */
async function deleteFileFromDisk(filepath) {
    if (!filepath) return false;

    try {
        const uploadDir = path.resolve(config.uploadPath);
        let targetPath;

        // 1. التفرقة بين مسارات الـ Tests (المطلقة) ومسارات الداتابيز (النسبية)
        if (path.isAbsolute(filepath)) {
            targetPath = path.normalize(filepath);
        } else {
            targetPath = path.normalize(path.join(uploadDir, filepath));
        }

        // 2. الحماية الأمنية الصارمة (Security Check)
        // التأكد إن المسار النهائي يقع حصراً داخل مجلد المرفقات
        const relativePath = path.relative(uploadDir, targetPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            logError(
                'Security Alert: Attempt to delete file outside upload directory:',
                filepath
            );
            return false; // Test expects this for path traversal attempts
        }

        // 3. مسح الملف
        await fs.unlink(targetPath);
        return true;
    } catch (error) {
        // الـ Tests تتوقع إرجاع false إذا كان الملف غير موجود (ENOENT) أو فشل الحذف
        return false;
    }
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
        return true;
    } catch (error) {
        logError('Error creating upload directory:', error);
        return false;
    }
}

/**
 * Get file URL for serving
 */
function getFileUrl(storedFilename) {
    return `/api/uploads/tasks/${storedFilename}`;
}

module.exports = {
    ALLOWED_TYPES,
    validateFileType,
    getExtensionFromMimeType,
    formatFileSize,
    isImageFile,
    isPdfFile,
    isTextFile,
    deleteFileFromDisk,
    ensureUploadDir,
    getFileUrl,
};
