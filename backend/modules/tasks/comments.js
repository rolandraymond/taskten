const express = require('express');
const { Op } = require('sequelize');
const { Task, TaskComment, User } = require('../../models');
const { uid } = require('../../utils/uid');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const permissionsService = require('../../services/permissionsService');
const { logCommentAdded } = require('./taskEventService');
const { logError } = require('../../services/logService');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

const ACCESS_LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
const AUTHOR_ATTRIBUTES = ['id', 'name', 'surname', 'email'];

router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});

function hasAccess(access, minimum) {
    return (ACCESS_LEVELS[access] || 0) >= ACCESS_LEVELS[minimum];
}

function buildCommentIdentifier(commentId) {
    const id = Number(commentId);
    if (Number.isInteger(id) && String(id) === String(commentId)) {
        return { [Op.or]: [{ id }, { uid: commentId }] };
    }
    return { uid: commentId };
}

async function getTaskWithAccess(taskUid, userId, minimumAccess) {
    const task = await Task.findOne({ where: { uid: taskUid } });
    if (!task) {
        return { error: { status: 404, message: 'Task not found' } };
    }

    const access = await permissionsService.getAccess(userId, 'task', taskUid);
    if (!hasAccess(access, minimumAccess)) {
        return {
            error: {
                status: 403,
                message: 'Not authorized to access this task',
            },
        };
    }

    return { task, access };
}

async function findCommentForTask(taskId, commentId) {
    return await TaskComment.findOne({
        where: {
            task_id: taskId,
            ...buildCommentIdentifier(commentId),
        },
        include: [
            {
                model: User,
                as: 'Author',
                attributes: AUTHOR_ATTRIBUTES,
            },
        ],
    });
}

function serializeComment(comment) {
    return comment.toJSON ? comment.toJSON() : comment;
}

router.get('/task/:uid/comments', async (req, res) => {
    try {
        const result = await getTaskWithAccess(
            req.params.uid,
            req.authUserId,
            'ro'
        );
        if (result.error) {
            return res.status(result.error.status).json({
                error: result.error.message,
            });
        }

        const comments = await TaskComment.findAll({
            where: { task_id: result.task.id },
            order: [
                ['created_at', 'ASC'],
                ['id', 'ASC'],
            ],
            include: [
                {
                    model: User,
                    as: 'Author',
                    attributes: AUTHOR_ATTRIBUTES,
                },
            ],
        });

        res.json(comments.map(serializeComment));
    } catch (error) {
        logError('Error fetching task comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

router.post(
    '/task/:uid/comments',
    createResourceLimiter,
    async (req, res) => {
        try {
            const content = String(req.body.content || '').trim();
            if (!content) {
                return res
                    .status(400)
                    .json({ error: 'Comment content is required' });
            }

            const result = await getTaskWithAccess(
                req.params.uid,
                req.authUserId,
                'rw'
            );
            if (result.error) {
                return res.status(result.error.status).json({
                    error: result.error.message,
                });
            }

            const comment = await TaskComment.create({
                uid: uid(),
                task_id: result.task.id,
                user_id: req.authUserId,
                content,
            });

            const commentWithAuthor = await findCommentForTask(
                result.task.id,
                comment.uid
            );

            logCommentAdded(result.task.id, req.authUserId, content, {
                comment_uid: comment.uid,
            }).catch((eventError) => {
                logError('Error logging comment_added event:', eventError);
            });

            res.status(201).json(serializeComment(commentWithAuthor));
        } catch (error) {
            logError('Error creating task comment:', error);
            res.status(500).json({ error: 'Failed to create comment' });
        }
    }
);

router.patch(
    '/task/:uid/comments/:commentId',
    createResourceLimiter,
    async (req, res) => {
        try {
            const content = String(req.body.content || '').trim();
            if (!content) {
                return res
                    .status(400)
                    .json({ error: 'Comment content is required' });
            }

            const result = await getTaskWithAccess(
                req.params.uid,
                req.authUserId,
                'rw'
            );
            if (result.error) {
                return res.status(result.error.status).json({
                    error: result.error.message,
                });
            }

            const comment = await findCommentForTask(
                result.task.id,
                req.params.commentId
            );
            if (!comment) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            if (comment.user_id !== req.authUserId) {
                return res
                    .status(403)
                    .json({ error: 'Only the comment author can edit it' });
            }

            await comment.update({
                content,
                is_edited: true,
                edited_at: new Date(),
            });

            const updatedComment = await findCommentForTask(
                result.task.id,
                comment.uid
            );

            res.json(serializeComment(updatedComment));
        } catch (error) {
            logError('Error updating task comment:', error);
            res.status(500).json({ error: 'Failed to update comment' });
        }
    }
);

router.delete(
    '/task/:uid/comments/:commentId',
    createResourceLimiter,
    async (req, res) => {
        try {
            const result = await getTaskWithAccess(
                req.params.uid,
                req.authUserId,
                'rw'
            );
            if (result.error) {
                return res.status(result.error.status).json({
                    error: result.error.message,
                });
            }

            const comment = await findCommentForTask(
                result.task.id,
                req.params.commentId
            );
            if (!comment) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            const canDelete =
                comment.user_id === req.authUserId ||
                result.access === permissionsService.ACCESS?.ADMIN ||
                result.access === 'admin';
            if (!canDelete) {
                return res.status(403).json({
                    error: 'Only the comment author or an admin can delete it',
                });
            }

            await comment.destroy();
            res.json({ message: 'Comment deleted successfully' });
        } catch (error) {
            logError('Error deleting task comment:', error);
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    }
);

module.exports = router;
