export interface User {
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    language: string;
    appearance: string;
    timezone: string;
    avatarUrl?: string; // للملف الشخصي
    is_admin?: boolean;
    /* role?: {            // 👈 (الحل) تم إضافة role لحل الخطأ رقم 1
        is_admin?: boolean;
        [key: string]: any;
    }; */
    // ✅ الـ role الجديد — القيم: 'admin' | 'co_admin' | 'client' | 'user'
    id?: number;
    avatar_image?: string | null;
    role?: 'admin' | 'co_admin' | 'client' | 'user';
    label?: string;
}

/**
 * تمثيل مختصر للمستخدم في واجهة اختيار المكلفين (Picker)
 * مطابق للـ Backend Response من /api/assignment-picker
 */
export interface Assignee {
    id: number;
    uid: string;
    label?: string; // الاسم المجمع أو الإيميل
    isAdmin: boolean;
    name?: string;
    email?: string;
    avatar?: string | null;
    avatar_image?: string | null;
    // ✅ الـ role الجديد — القيم: 'admin' | 'co_admin' | 'client' | 'user'
    surname?: string;
    role?: 'admin' | 'co_admin' | 'client' | 'user';
}
