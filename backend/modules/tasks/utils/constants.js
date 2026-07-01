// 1. ضفنا User في الاستيراد من الـ models
const { Tag, Project, Task, User, TaskAssignment } = require('../../../models');
const TASK_INCLUDES = [
    {
        model: Tag,
        attributes: ['id', 'name', 'uid'],
        through: { attributes: [] },
    },
    {
        model: Project,
        attributes: ['id', 'name', 'uid', 'image_url'],
        required: false,
    },
    // 🔥 السطور الجديدة الخاصة بالموظفين (Assignees) 🔥
    {
        model: User,
        as: 'Assignees', // نفس الاسم اللي الفرونت إند بيقراه
        attributes: ['id', 'name', 'email', 'avatar_image'], // الداتا اللي هترجع للموظف (ممكن تزود الصورة لو محتاجها)
        through: { attributes: [] }, // عشان ننظف الرد من بيانات جدول الربط (task_assignments)
        required: false, // عشان لو التاسك لسه مفيش حد ماسكها، التاسك نفسها ترجع عادي
    },
];

const TASK_INCLUDES_WITH_SUBTASKS = [
    ...TASK_INCLUDES,
    {
        model: Task,
        as: 'Subtasks',
        required: false,
        separate: true,
        order: [
            ['order', 'ASC'],
            ['created_at', 'ASC'],
        ],
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
            },
            {
                model: Project,
                attributes: ['id', 'name', 'uid', 'image_url'],
                required: false,
            },
            {
                model: TaskAssignment,
                as: 'TaskAssignments',
                required: false,
                include: [
                    {
                        model: User,
                        as: 'AssignedUser',
                        attributes: [
                            'id',
                            'name',
                            'surname',
                            'email',
                            'uid',
                            'avatar_image',
                        ],
                    },
                ],
            },
        ],
    },
];

module.exports = {
    TASK_INCLUDES,
    TASK_INCLUDES_WITH_SUBTASKS,
};
