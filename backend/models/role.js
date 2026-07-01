const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Role = sequelize.define(
        'Role',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
            },
            is_admin: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            // ✅ الحقل الجديد — القيم: 'admin' | 'co_admin' | 'client' | 'user'
            role_name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'user',
            },
        },
        {
            tableName: 'roles',
        }
    );

    // Constants للـ role names
    Role.ROLES = {
        ADMIN: 'admin',
        CO_ADMIN: 'co_admin',
        CLIENT: 'client',
        USER: 'user',
    };

    return Role;
};
