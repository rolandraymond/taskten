import { getApiPath } from '../config/paths';
import { fetchWithCsrf } from './csrfService'; 
import { Assignee } from '../entities/User';

export const getAssignmentPicker = async (): Promise<Assignee[]> => {
    const res = await fetchWithCsrf(getApiPath('users/assignment-picker'), {
        method: 'GET',
        credentials: 'include', 
    });

    if (!res.ok) {
        throw new Error('Failed to fetch assignment picker list');
    }

    const data = await res.json();

    return (data || []).map((user: any) => ({
        id: user.id,
        uid: user.uid,
        label: user.label || user.email || 'Unknown',
        avatar: user.avatar || null,
        isAdmin: user.role === 'admin' || user.isAdmin === true, 
        role: user.role || 'user' // 👈 الإضافة الجديدة عشان يدعم الـ roles الجداد
    }));
};
// أضف هذه الدالة في أسفل الملف
export const updateUserRole = async (userId: number, role: string) => {
    const res = await fetchWithCsrf(getApiPath('admin/set-admin-role'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // افترضت إن الـ Controller بيستقبل user_id و role
        body: JSON.stringify({ user_id: userId, role: role }) 
    });

    if (!res.ok) {
        throw new Error('Failed to update user role');
    }
    return res.json();
};