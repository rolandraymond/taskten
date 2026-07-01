'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('roles', 'role_name', {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'user',
        });

        // بنحوّل الـ admins الموجودين تلقائياً
        await queryInterface.sequelize.query(`
            UPDATE roles SET role_name = 'admin' WHERE is_admin = 1
        `);
        await queryInterface.sequelize.query(`
            UPDATE roles SET role_name = 'user' WHERE is_admin = 0
        `);
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('roles', 'role_name');
    },
};
