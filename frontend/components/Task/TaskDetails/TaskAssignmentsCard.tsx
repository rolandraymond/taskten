import React, { useEffect, useState } from 'react';
// 1. استيراد الترجمة (i18n)
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import { Assignee } from '../../../entities/User';
import UserSelect from '../../Shared/UserSelect';
import {
    updateTaskAssignments,
    fetchTaskByUid,
} from '../../../utils/tasksService';
// 4. استيراد دالة جلب المستخدم الحالي للصلاحيات الموثوقة
import { getCurrentUser } from '../../../utils/userUtils';
// 3. استيراد الـ Global State
import { useStore } from '../../../store/useStore';
// 2. استيراد إشعارات النجاح والفشل
import { useToast } from '../../Shared/ToastContext';
// 5. استيراد مسار الـ API لجلب المستخدمين
import { getApiPath } from '../../../config/paths';


interface Props {
    task: Task;
    onRefresh?: (task: Task) => void;
}

const TaskAssignmentsCard: React.FC<Props> = ({ task, onRefresh }) => {
    // 1. تفعيل الترجمة
    const { t } = useTranslation();
    // 2. تفعيل الإشعارات
    const { showSuccessToast, showErrorToast } = useToast();
    // 3. تفعيل الـ Global State
    const tasksStore = useStore((s: any) => s.tasksStore);

    const [editing, setEditing] = useState(false);
    const [localUsers, setLocalUsers] = useState<Assignee[]>(
        task.Assignees || []
    );
    const [loading, setLoading] = useState(false);

    // 5. State لتخزين كل المستخدمين اللي هنجيبهم من الـ API
    const [allUsers, setAllUsers] = useState<Assignee[]>([]);

    const [isAdmin, setIsAdmin] = useState(false);

    // 4. التحقق من الصلاحيات بطريقة موثوقة باستخدام getCurrentUser
    useEffect(() => {
        const currentUser = getCurrentUser();
        const isSuperAdmin = !!(
            currentUser &&
            (currentUser.email === 'test@tududi.com' ||
                currentUser.is_admin ||
                currentUser.role === 'admin'||
                currentUser.role === 'co_admin') // ✅ التعديل هنا: أصبحنا نقارن النص مباشرة بـ 'admin'
        );
        // دمجنا بين الكارت القديم والجديد لضمان أعلى موثوقية
        setIsAdmin(isSuperAdmin || localStorage.getItem('isAdmin') === 'true');
    }, []);

    useEffect(() => {
        setLocalUsers(task.Assignees || []);
    }, [task.Assignees]);

    // 5. جلب قائمة المستخدمين من الـ API لو المستخدم أدمن
    useEffect(() => {
        let mounted = true;
        if (!isAdmin) return; // لو مش أدمن، مفيش داعي نستهلك الـ API

        (async () => {
            try {
                const res = await fetch(getApiPath('users'), {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) return;
                const data = await res.json();

                if (mounted && Array.isArray(data)) {
                    setAllUsers(data); // تحديث القائمة بالداتا الحقيقية
                }
            } catch (err) {
                console.error('Failed to fetch users for assignments', err);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isAdmin]);

    const handleSave = async () => {
        if (!task.uid) return;

        try {
            setLoading(true);
            const userIds = localUsers.map((u) => u.id);

            // إرسال التعديل للباك إند
            await updateTaskAssignments(task.uid, userIds);

            // جلب التاسك المحدثة بالكامل عشان نضمن إن الداتا راجعة صح
            const updatedTask = await fetchTaskByUid(task.uid);

            // 3. تحديث الـ Global Store عشان باقي التطبيق يحس بالتعديل فوراً
            const idx = tasksStore.tasks.findIndex(
                (t: Task) => t.uid === task.uid
            );
            if (idx >= 0) {
                const updatedTasks = [...tasksStore.tasks];
                updatedTasks[idx] = updatedTask;
                tasksStore.setTasks(updatedTasks);
            }

            onRefresh?.(updatedTask);

            // 2. إظهار رسالة نجاح
            showSuccessToast(
                t('task.assignmentsUpdated', 'Assignments updated successfully')
            );
            setEditing(false);
        } catch (err) {
            console.error('Failed to update assignments:', err);
            // 2. إظهار رسالة فشل
            showErrorToast(
                t('task.assignError', 'Failed to update assignments')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="border rounded-2xl p-5 space-y-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-gray-200/50 dark:border-gray-700/50 shadow-xl">
            <div className="flex justify-between items-center">
                {/* 1. استخدام الترجمة في العناوين */}
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {t('task.assignments', 'Assignments')}
                </h3>

                {/* 4. زرار التعديل بيظهر للأدمن فقط */}
                {isAdmin && !editing && (
                    <button
                        onClick={() => setEditing(true)}
                        className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                    >
                        {t('common.edit', 'Edit')}
                    </button>
                )}
            </div>

            {!editing ? (
                <div className="flex flex-wrap gap-2">
                    {localUsers.length === 0 ? (
                        <span className="text-gray-400 text-xs italic">
                            {t('task.noAssignee', 'No assignees yet')}
                        </span>
                    ) : (
                        localUsers.map((u) => (
                            <span
                                key={u.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                            >
                                {u.avatar_image || u.avatar ? (
                                    <img
                                        // 💥 الحل الـ Production-Ready: لو اللينك مش كامل، بنحط قبله رابط الباك إند 💥
                                        src={
                                            (
                                                u.avatar_image || u.avatar
                                            )?.startsWith('http')
                                                ? u.avatar_image || u.avatar
                                                : // غير البورت 8080 لو الباك إند بتاعك شغال على بورت تاني
                                                  // وفي البرودكشن ممكن تستبدل ده بـ process.env.REACT_APP_API_URL
                                                  `http://localhost:3002${u.avatar_image || u.avatar}`
                                        }
                                        alt={u.name || 'User'}
                                        className="w-4 h-4 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                                        {(u.label ||
                                            u.name ||
                                            u.email ||
                                            '?')[0].toUpperCase()}
                                    </div>
                                )}
                                {u.label || u.name || u.email}
                            </span>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* 5. تمرير قائمة المستخدمين المجلوبة من الـ API للمكون الخاص بالاختيار */}
                    <UserSelect
                        users={allUsers}
                        selected={localUsers}
                        onChange={setLocalUsers}
                    />

                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => {
                                setEditing(false);
                                setLocalUsers(task.Assignees || []);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-md shadow-indigo-500/20 transition-all"
                        >
                            {loading
                                ? t('common.saving', 'Saving...')
                                : t('common.saveChanges', 'Save Changes')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskAssignmentsCard;
