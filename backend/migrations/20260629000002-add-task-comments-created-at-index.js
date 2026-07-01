'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface) {
        await safeAddIndex(
            queryInterface,
            'task_comments',
            ['task_id', 'created_at'],
            { name: 'task_comments_task_id_created_at' }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'task_comments',
            'task_comments_task_id_created_at'
        );
    },
};
