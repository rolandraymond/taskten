'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'task_comments', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            is_edited: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            edited_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'task_comments', ['uid'], {
            name: 'task_comments_uid',
            unique: true,
        });
        await safeAddIndex(queryInterface, 'task_comments', ['task_id'], {
            name: 'task_comments_task_id',
        });
        await safeAddIndex(queryInterface, 'task_comments', ['user_id'], {
            name: 'task_comments_user_id',
        });
        await safeAddIndex(
            queryInterface,
            'task_comments',
            ['task_id', 'created_at'],
            { name: 'task_comments_task_id_created_at' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('task_comments');
    },
};
