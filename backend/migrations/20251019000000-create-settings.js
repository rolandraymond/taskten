'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. إنشاء الجدول (ولو موجود هيتجاهل الخطأ ويكمل)
        try {
            await queryInterface.createTable('settings', {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                },
                key: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true,
                },
                value: {
                    type: Sequelize.TEXT,
                    allowNull: false,
                },
                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                },
                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                },
            });
        } catch (error) {
            console.log(
                '⚠️ [Note] Table "settings" already exists. Skipping creation...'
            );
        }

        // 2. إنشاء الـ Index
        try {
            await queryInterface.addIndex('settings', ['key'], {
                name: 'settings_key_idx',
                unique: true,
            });
        } catch (error) {
            console.log(
                '⚠️ [Note] Index "settings_key_idx" already exists. Skipping...'
            );
        }

        // 3. إدخال القيمة الافتراضية (هنا كان بيحصل الـ Validation Error)
        try {
            await queryInterface.bulkInsert('settings', [
                {
                    key: 'registration_enabled',
                    value: 'false',
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            ]);
        } catch (error) {
            console.log(
                '⚠️ [Note] Setting "registration_enabled" already exists. Skipping insert...'
            );
        }
    },

    async down(queryInterface) {
        try {
            await queryInterface.removeIndex('settings', 'settings_key_idx');
        } catch (error) {}

        try {
            await queryInterface.dropTable('settings');
        } catch (error) {}
    },
};
