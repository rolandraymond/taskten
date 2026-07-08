const { DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
    const PushSubscription = sequelize.define(
        'PushSubscription',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false,
                defaultValue: () => uuid(),
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            endpoint: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true,
            },
            p256dh: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            auth: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            last_seen_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            revoked_at: {
            type: DataTypes.DATE,
            allowNull: true,
            },
        },
        {
            tableName: 'push_subscriptions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['endpoint'], unique: true },
            ],
        }
    );

    PushSubscription.associate = function (models) {
        PushSubscription.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    return PushSubscription;
};