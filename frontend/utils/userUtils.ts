import { User, Assignee } from '../entities/User';

const CURRENT_USER_KEY = 'currentUser';

// --- الأساسيات (زي ما هي) ---

export const getCurrentUser = (): User | null => {
    try {
        const userJson = localStorage.getItem(CURRENT_USER_KEY);
        if (!userJson) return null;
        return JSON.parse(userJson) as User;
    } catch (error) {
        console.error('Error getting current user from localStorage:', error);
        return null;
    }
};

export const setCurrentUser = (user: User | null): void => {
    try {
        if (user) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    } catch (error) {
        console.error('Error setting current user in localStorage:', error);
    }
};

// --- الـ Helpers الجديدة للـ Assignment UI ---

/**
 * دالة لاستخراج الحرف الأول من الاسم لعرضه كـ Placeholder للـ Avatar
 */
export const getUserInitials = (name?: string, email?: string): string => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
};

/**
 * دالة للتأكد من مسار الـ Avatar
 * لو المسار نسبي (Relative) زي ما ظبطناه في الباك إند، بنضيف له الـ Base URL
 */
export const getFullAvatarUrl = (avatarPath?: string | null): string | undefined => {
    if (!avatarPath) return undefined;
    if (avatarPath.startsWith('http')) return avatarPath;
    // هنا بنفترض إن الصور بتخدم من الـ Backend API مباشرة
    return avatarPath; 
};

/**
 * دالة لتنسيق اسم الموظف بشكل مختصر للـ Ghost UI
 */
export const formatAssigneeName = (assignee: Assignee): string => {
    return assignee.label.split(' ')[0]; // إرجاع الاسم الأول فقط للاختصار
};