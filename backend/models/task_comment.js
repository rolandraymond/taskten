const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const TaskComment = sequelize.define(
        'TaskComment',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true,
                },
            },
            is_edited: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            edited_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'task_comments',
            timestamps: true,
            indexes: [
                {
                    fields: ['uid'],
                    unique: true,
                },
                {
                    fields: ['task_id'],
                },
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['task_id', 'created_at'],
                },
            ],
        }
    );

    TaskComment.associate = function (models) {
        TaskComment.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'Task',
        });
        TaskComment.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'Author',
        });
    };

    return TaskComment;
};
