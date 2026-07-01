const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskAssignment = sequelize.define(
        'TaskAssignment',
        {
            task_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
            },
            assigned_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: 'task_assignments',
            // 🔥 دمجنا الـ hooks هنا جوه الأوبجيكت التالت عشان Sequelize يشوفها
            /* hooks: {
                afterCreate: async (assignment, options) => {
                    const notificationsService = require('../modules/notifications/service');
                    // ⚠️ ملحوظة: الـ Service محتاج taskName وإنت مش معاك هنا غير ID
                    // ده سبب تاني يخلينا نفضل الـ Notification في الـ Route مش هنا
                    await notificationsService.sendTaskAssignmentNotification(
                        assignment.user_id,
                        assignment.task_id,
                        "Task Name Placeholder", // محتاج Query هنا عشان تجيب الاسم
                        assignment.assigned_by
                    );
                },
            }, */
        }
    );

    return TaskAssignment;
};
