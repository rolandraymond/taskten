'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('push_subscriptions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      uid: { type: Sequelize.STRING, allowNull: false, unique: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth: { type: Sequelize.TEXT, allowNull: false },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('push_subscriptions', ['user_id']);
    await queryInterface.addIndex('push_subscriptions', ['endpoint'], {
      unique: true,
      name: 'push_subscriptions_endpoint_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('push_subscriptions');
  },
};