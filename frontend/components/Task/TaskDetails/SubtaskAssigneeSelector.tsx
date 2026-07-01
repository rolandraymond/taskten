import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    CheckIcon,
    ChevronDownIcon,
    MagnifyingGlassIcon,
    UserPlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import { User as StoreUser } from '../../../entities/User';
import { useStore } from '../../../store/useStore';
import { assignSubtask } from '../../../utils/tasksService';

interface SubtaskAssigneeSelectorProps {
    subtask: Task;
    disabled?: boolean;
    onUpdated?: (updatedSubtask: Task) => void;
}

type PickerUser = {
    id: number;
    uid?: string;
    label?: string;
    name?: string;
    surname?: string;
    email?: string;
    avatar?: string | null;
    avatar_image?: string | null;
    role?: 'admin' | 'co_admin' | 'client' | 'user';
};

type DropdownStyle = React.CSSProperties & {
    position: 'fixed';
};

const toPickerUser = (user: StoreUser & Partial<PickerUser>): PickerUser => ({
    id: (user as any).id ?? 0,
    uid: user.uid,
    label: (user as any).label,
    name: user.name,
    surname: user.surname,
    email: user.email,
    avatar: (user as any).avatar ?? null,
    avatar_image: (user as any).avatar_image ?? null,
    role: user.role,
});

const getUserLabel = (user: Partial<PickerUser>): string => {
    return (
        user.label?.trim() ||
        [user.name, user.surname].filter(Boolean).join(' ').trim() ||
        user.email?.trim() ||
        'Unknown'
    );
};

const getAvatarLabel = (label: string): string => {
    const parts = label.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

// 🌟 مكون جديد للتعامل مع الصور والـ Fallback
const AvatarDisplay: React.FC<{ user: Partial<PickerUser>; className: string }> = ({ user, className }) => {
    const [imgError, setImgError] = useState(false);
    const label = getUserLabel(user);
    
    if (user.avatar_image && !imgError) {
        // إذا كان المسار لا يبدأ بـ http، نضيف له /api (تعديل حسب إعدادات السيرفر لديك)
        const imgSrc = user.avatar_image.startsWith('http') 
            ? user.avatar_image 
            : `${user.avatar_image}`;
            
        return (
            <img 
                src={imgSrc} 
                alt={label} 
                onError={() => setImgError(true)} 
                className={`object-cover ${className}`} 
            />
        );
    }
    
    return (
        <div className={`flex items-center justify-center overflow-hidden bg-gray-100 font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300 ${className}`}>
            {getAvatarLabel(label)}
        </div>
    );
};

const SubtaskAssigneeSelector: React.FC<SubtaskAssigneeSelectorProps> = ({
    subtask,
    disabled = false,
    onUpdated,
}) => {
    const { t } = useTranslation();

    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const storeUsers = useStore((state) => state.usersStore.users);
    const usersLoading = useStore((state) => state.usersStore.isLoading);
    const loadUsers = useStore((state) => state.usersStore.loadUsers);

    const users = useMemo<PickerUser[]>(
        () => storeUsers.map((user) => toPickerUser(user as StoreUser & Partial<PickerUser>)),
        [storeUsers]
    );

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedAssignees, setSelectedAssignees] = useState<PickerUser[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle | null>(null);

    const isPersisted = Boolean(subtask?.uid);
    const resolvedDisabled = disabled || !isPersisted;

    const syncFromSubtask = () => {
        const assignees = (subtask.assignees ?? []) as PickerUser[];
        const ids = assignees
            .map((assignee: any) => Number(assignee?.id))
            .filter((id) => Number.isFinite(id));

        setSelectedIds(ids);
        setSelectedAssignees(assignees);
    };

    useEffect(() => {
        syncFromSubtask();
    }, [subtask.uid, subtask.assignees]);

    useEffect(() => {
        if (!storeUsers.length && !usersLoading) {
            void loadUsers();
        }
    }, [loadUsers, storeUsers.length, usersLoading]);

    useEffect(() => {
        if (selectedIds.length === 0 || users.length === 0) return;

        const merged = selectedIds
            .map((id) => {
                const fromUsers = users.find((u) => u.id === id);
                const fromLocal = selectedAssignees.find((a) => a.id === id);
                return (fromUsers || fromLocal) as PickerUser | undefined;
            })
            .filter(Boolean) as PickerUser[];

        if (merged.length > 0) {
            setSelectedAssignees((prev) => {
                const prevIds = prev.map((p) => p.id).join(',');
                const nextIds = merged.map((m) => m.id).join(',');
                return prevIds === nextIds ? prev : merged;
            });
        }
    }, [selectedIds, users, selectedAssignees]);

    const updateDropdownPosition = () => {
        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 12;
        const preferredWidth = 380;
        const width = Math.min(preferredWidth, viewportWidth - margin * 2);

        let left = rect.right - width;
        left = Math.max(margin, Math.min(left, viewportWidth - width - margin));

        const spaceBelow = viewportHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;
        const openUpward = spaceBelow < 340 && spaceAbove > spaceBelow;

        setDropdownStyle({
            position: 'fixed',
            left,
            top: openUpward ? undefined : rect.bottom + 8,
            bottom: openUpward ? viewportHeight - rect.top + 8 : undefined,
            width,
            zIndex: 99999,
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            const button = buttonRef.current;
            const dropdown = dropdownRef.current;

            if (button?.contains(target)) return;
            if (dropdown?.contains(target)) return;

            setIsOpen(false);
            setSearch('');
        };

        const onResizeOrScroll = () => updateDropdownPosition();

        updateDropdownPosition();

        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('resize', onResizeOrScroll);
        window.addEventListener('scroll', onResizeOrScroll, true);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('resize', onResizeOrScroll);
            window.removeEventListener('scroll', onResizeOrScroll, true);
        };
    }, [isOpen]);

    const selectedUsers = useMemo(() => {
        if (selectedAssignees.length > 0) return selectedAssignees;
        return users.filter((user) => selectedIds.includes(user.id));
    }, [selectedAssignees, selectedIds, users]);

    const visibleUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;

        return users.filter((user) => {
            const label = getUserLabel(user).toLowerCase();
            const email = (user.email || '').toLowerCase();
            const role = (user.role || '').toLowerCase();

            return label.includes(q) || email.includes(q) || role.includes(q);
        });
    }, [search, users]);

    const commitSelection = async (nextIds: number[]) => {
        if (!subtask.uid || resolvedDisabled || isSaving) return;

        const previousIds = selectedIds;
        const previousAssignees = selectedAssignees;

        const nextAssignees = nextIds
            .map((id) => users.find((u) => u.id === id))
            .filter(Boolean) as PickerUser[];

        setSelectedIds(nextIds);
        setSelectedAssignees(nextAssignees);
        setIsSaving(true);

        try {
            const updatedSubtask = await assignSubtask(subtask.uid, nextIds);

            if (updatedSubtask?.assignees) {
                const normalized = (updatedSubtask.assignees as any[]).map(
                    (a) => ({
                        id: Number(a.id),
                        uid: a.uid,
                        label: a.label,
                        name: a.name,
                        surname: a.surname,
                        email: a.email,
                        avatar: a.avatar ?? null,
                        avatar_image: a.avatar_image ?? null,
                        role: a.role,
                    })
                ) as PickerUser[];

                setSelectedAssignees(normalized);
                setSelectedIds(
                    normalized
                        .map((a) => Number(a.id))
                        .filter((id) => Number.isFinite(id))
                );
            }

            const mergedSubtask: Task = {
                ...subtask,
                assignees: nextAssignees.map((a) => ({
                    id: Number(a.id),
                    uid: a.uid,
                    name: a.name,
                    surname: a.surname,
                    email: a.email,
                    avatar_image: a.avatar_image ?? null,
                    role: a.role,
                })),
            };
            onUpdated?.(mergedSubtask);
        } catch (error) {
            console.error('Failed to assign subtask users:', error);
            setSelectedIds(previousIds);
            setSelectedAssignees(previousAssignees);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleUser = async (userId: number) => {
        const nextIds = selectedIds.includes(userId)
            ? selectedIds.filter((id) => id !== userId)
            : [...selectedIds, userId];

        await commitSelection(nextIds);
    };

    const clearAll = async () => {
        await commitSelection([]);
    };

    const compactAssignees = selectedUsers.slice(0, 2);
    const hiddenCount = Math.max(0, selectedUsers.length - compactAssignees.length);

    const dropdown =
        isOpen && !resolvedDisabled && dropdownStyle
            ? createPortal(
                  <div
                      ref={dropdownRef}
                      style={dropdownStyle}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                  >
                      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                          <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {t('subtasks.assignees.title', 'Assign users')}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {selectedUsers.length > 0
                                      ? t('subtasks.assignees.selectedCount', '{{count}} selected', { count: selectedUsers.length })
                                      : t('subtasks.assignees.noneSelected', 'No assignees yet')}
                              </p>
                          </div>

                          <div className="flex items-center gap-1">
                              {selectedIds.length > 0 && (
                                  <button
                                      type="button"
                                      onClick={clearAll}
                                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                  >
                                      {t('actions.clear', 'Clear')}
                                  </button>
                              )}
                              <button
                                  type="button"
                                  onClick={() => {
                                      setIsOpen(false);
                                      setSearch('');
                                  }}
                                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                  title={t('actions.close', 'Close')}
                              >
                                  <XMarkIcon className="h-4 w-4" />
                              </button>
                          </div>
                      </div>

                      <div className="border-b border-gray-100 p-3 dark:border-gray-800">
                          <div className="relative">
                              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <input
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder={t('common.search', 'Search')}
                                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
                                  autoFocus
                              />
                          </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                          {usersLoading ? (
                              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                  {t('loading.users', 'Loading users...')}
                              </div>
                          ) : visibleUsers.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                  {t('subtasks.assignees.emptyState', 'No users found')}
                              </div>
                          ) : (
                              <div className="space-y-1">
                                  {visibleUsers.map((user) => {
                                      const label = getUserLabel(user);
                                      const isSelected = selectedIds.includes(user.id);

                                      return (
                                          <button
                                              key={user.id}
                                              type="button"
                                              onClick={() => void toggleUser(user.id)}
                                              className={[
                                                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                                                  isSelected
                                                      ? 'bg-blue-50 dark:bg-blue-950/30'
                                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/80',
                                              ].join(' ')}
                                          >
                                              {/* 🌟 استخدام المكون الجديد لصور الموظفين */}
                                              <AvatarDisplay user={user} className="h-9 w-9 shrink-0 rounded-full text-xs" />

                                              <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2">
                                                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                          {label}
                                                      </p>
                                                      {user.role === 'admin' && (
                                                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                                              Admin
                                                          </span>
                                                      )}
                                                  </div>
                                                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                      {user.email || user.uid}
                                                  </p>
                                              </div>

                                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600">
                                                  {isSelected ? (
                                                      <CheckIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                                  ) : null}
                                              </div>
                                          </button>
                                      );
                                  })}
                              </div>
                          )}
                      </div>

                      {selectedUsers.length > 0 && (
                          <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                              <div className="flex flex-wrap items-center gap-1.5">
                                  {compactAssignees.map((user) => {
                                      const label = getUserLabel(user);

                                      return (
                                          <span
                                              key={user.id}
                                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                          >
                                              {/* 🌟 استخدام المكون الجديد في الفقاعات الصغيرة */}
                                              <AvatarDisplay user={user} className="h-4 w-4 rounded-full text-[10px]" />
                                              <span className="max-w-[120px] truncate">{label}</span>
                                          </span>
                                      );
                                  })}

                                  {hiddenCount > 0 && (
                                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                          +{hiddenCount}
                                      </span>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            <div className="inline-flex items-center">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => {
                        if (resolvedDisabled) return;
                        const next = !isOpen;
                        setIsOpen(next);
                        setSearch('');
                        if (next) {
                            setTimeout(() => updateDropdownPosition(), 0);
                        }
                    }}
                    disabled={resolvedDisabled}
                    className={[
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition',
                        'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/70',
                        'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500/50 dark:hover:bg-gray-800',
                        resolvedDisabled ? 'cursor-not-allowed opacity-50' : 'shadow-sm',
                    ].join(' ')}
                    title={
                        resolvedDisabled
                            ? t('subtasks.assignees.locked', 'Save the subtask first to assign users')
                            : t('subtasks.assignees.title', 'Assign users')
                    }
                >
                    <UserPlusIcon className="h-4 w-4" />
                    <span className="max-w-[180px] truncate">
                        {selectedUsers.length > 0
                            ? selectedUsers.map((user) => getUserLabel(user)).join(', ')
                            : t('subtasks.assignees.empty', 'Assignees')}
                    </span>
                    <ChevronDownIcon className="h-4 w-4" />
                </button>

                {isSaving && (
                    <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {t('common.saving', 'Saving...')}
                    </span>
                )}
            </div>

            {dropdown}
        </>
    );
};

export default SubtaskAssigneeSelector;