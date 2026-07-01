'use strict';

const express = require('express');
const router = express.Router();
const habitsController = require('./controller');
const { requireAuth } = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const habitsRepository = require('./repository');
const habitService = require('./habitService');

// ─── User Routes ──────────────────────────────────────────────────────────────
router.get('/habits', requireAuth, habitsController.getAll);
router.post('/habits', requireAuth, habitsController.create);
router.post(
    '/habits/:uid/complete',
    requireAuth,
    habitsController.logCompletion
);
router.get(
    '/habits/:uid/completions',
    requireAuth,
    habitsController.getCompletions
);
router.delete(
    '/habits/:uid/completions/:completionId',
    requireAuth,
    habitsController.deleteCompletion
);
router.get('/habits/:uid/stats', requireAuth, habitsController.getStats);
router.put('/habits/:uid', requireAuth, habitsController.update);
router.delete('/habits/:uid', requireAuth, habitsController.delete);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId/habits?period=30
 * Admin يشوف كل عادات أي يوزر مع إحصائياتها الكاملة
 */
router.get(
    '/admin/users/:userId/habits',
    requireAdmin,
    async (req, res, next) => {
        try {
            const targetUserId = parseInt(req.params.userId, 10);
            if (!targetUserId || isNaN(targetUserId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            const period = Math.min(parseInt(req.query.period, 10) || 30, 365);

            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);
            startDate.setHours(0, 0, 0, 0);

            const habits = await habitsRepository.findAllByUser(targetUserId);

            if (!habits || habits.length === 0) {
                return res.json([]);
            }

            const result = await Promise.all(
                habits.map(async (habit) => {
                    const [stats, completions] = await Promise.all([
                        habitService.getHabitStats(habit, startDate, endDate),
                        habitsRepository.findCompletions(
                            habit.id,
                            startDate,
                            endDate
                        ),
                    ]);

                    return {
                        id: habit.id,
                        uid: habit.uid,
                        name: habit.name,
                        recurrence_type: habit.recurrence_type,
                        habit_current_streak: habit.habit_current_streak,
                        habit_best_streak: habit.habit_best_streak,
                        habit_total_completions: habit.habit_total_completions,
                        habit_last_completion_at:
                            habit.habit_last_completion_at,
                        created_at: habit.created_at,
                        status: habit.status,
                        stats: {
                            completionRate:
                                stats.completionRate !== null
                                    ? Math.round(stats.completionRate)
                                    : null,
                            periodCompletions: stats.totalCompletions,
                            // مصفوفة التواريخ اللي اتكملت فيها العادة (YYYY-MM-DD)
                            completionDates: completions.map(
                                (c) =>
                                    new Date(c.completed_at)
                                        .toISOString()
                                        .split('T')[0]
                            ),
                        },
                    };
                })
            );

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
