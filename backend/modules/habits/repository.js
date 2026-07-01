'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Task, RecurringCompletion } = require('../../models');
const { Op } = require('sequelize');

class HabitsRepository extends BaseRepository {
    constructor() {
        super(Task);
    }

    // ─── User Methods ──────────────────────────────────────────────────────────

    async findAllByUser(userId) {
        return this.model.findAll({
            where: {
                user_id: userId,
                habit_mode: true,
                status: { [Op.ne]: 3 }, // مش archived
            },
            order: [['created_at', 'DESC']],
        });
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({
            where: { uid, user_id: userId },
        });
    }

    async createHabit(userId, data) {
        return this.model.create({
            ...data,
            user_id: userId,
            habit_mode: true,
            status: 0,
        });
    }

    // ─── Completions ───────────────────────────────────────────────────────────

    async findCompletions(taskId, startDate, endDate) {
        return RecurringCompletion.findAll({
            where: {
                task_id: taskId,
                skipped: false,
                completed_at: { [Op.between]: [startDate, endDate] },
            },
            order: [['completed_at', 'DESC']],
        });
    }

    async findCompletionById(completionId, taskId) {
        return RecurringCompletion.findOne({
            where: { id: completionId, task_id: taskId },
        });
    }

    // ─── Admin Methods ─────────────────────────────────────────────────────────

    /**
     * جلب إجمالي الـ completions لكل العادات في فترة معينة (للـ team overview)
     */
    async findAllCompletionsForPeriod(userIds, startDate, endDate) {
        const habits = await this.model.findAll({
            where: {
                user_id: { [Op.in]: userIds },
                habit_mode: true,
            },
            attributes: ['id', 'user_id'],
        });

        if (!habits.length) return {};

        const habitIds = habits.map((h) => h.id);
        const completions = await RecurringCompletion.findAll({
            where: {
                task_id: { [Op.in]: habitIds },
                skipped: false,
                completed_at: { [Op.between]: [startDate, endDate] },
            },
        });

        // تجميع الـ completions per userId
        const habitUserMap = new Map(habits.map((h) => [h.id, h.user_id]));
        const result = {};
        completions.forEach((c) => {
            const uid = habitUserMap.get(c.task_id);
            if (uid) {
                result[uid] = (result[uid] || 0) + 1;
            }
        });

        return result;
    }
}

module.exports = new HabitsRepository();
