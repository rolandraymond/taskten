'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('task_assignments', {
            task_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE', // لو التاسك اتمسحت التكليف يتلغي
            },
            user_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE', // لو اليوزر اتمسح تكليفاته تتلغي
            },
            assigned_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE', // الأدمن اللي عمل التكليف
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('task_assignments');
    },
};
