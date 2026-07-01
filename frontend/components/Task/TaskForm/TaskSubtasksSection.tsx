import React, { useRef, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import TaskPriorityIcon from '../../Shared/Icons/TaskPriorityIcon';
import { toggleTaskCompletion } from '../../../utils/tasksService';
import SubtaskAssigneeSelector from '../TaskDetails/SubtaskAssigneeSelector';

interface TaskSubtasksSectionProps {
    parentTaskId: number;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSubtaskUpdate?: (subtask: Task) => Promise<void>;
    onSave?: (subtasks: Task[]) => void;
}

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({
    parentTaskId,
    subtasks,
    onSubtasksChange,
    onSubtaskUpdate,
    onSave,
}) => {
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const { t } = useTranslation();
    const subtasksSectionRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            const modalScrollContainer = document.querySelector(
                '.absolute.inset-0.overflow-y-auto'
            ) as HTMLElement | null;

            if (modalScrollContainer) {
                modalScrollContainer.scrollTo({
                    top: modalScrollContainer.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 100);
    };

    const pushSubtasksUpdate = (updatedSubtasks: Task[]) => {
        onSubtasksChange(updatedSubtasks);
        onSave?.(updatedSubtasks);
    };

    const replaceSubtask = (index: number, updatedSubtask: Task) => {
        const updatedSubtasks = subtasks.map((subtask, i) =>
            i === index ? updatedSubtask : subtask
        );
        onSubtasksChange(updatedSubtasks);
        return updatedSubtasks;
    };

    const handleCreateSubtask = () => {
        const trimmedName = newSubtaskName.trim();
        if (!trimmedName) return;

        const newSubtask: Task = {
            name: trimmedName,
            status: 'not_started',
            priority: 'low',
            today: false,
            parent_task_id: parentTaskId,
            isNew: true,
            _isNew: true,
            completed_at: null,
            assignees: [],
        } as Task;

        const updatedSubtasks = [...subtasks, newSubtask];
        pushSubtasksUpdate(updatedSubtasks);
        setNewSubtaskName('');
        scrollToBottom();
    };

    const handleDeleteSubtask = (index: number) => {
        const updatedSubtasks = subtasks.filter((_, i) => i !== index);
        pushSubtasksUpdate(updatedSubtasks);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateSubtask();
        }
    };

    const handleEditSubtask = (index: number) => {
        setEditingIndex(index);
        setEditingName(subtasks[index].name);
    };

    const handleSaveEdit = () => {
        const trimmedName = editingName.trim();
        if (!trimmedName || editingIndex === null) return;

        const updatedSubtasks = subtasks.map((subtask, index) => {
            if (index !== editingIndex) return subtask;

            const isNameChanged = subtask.name !== trimmedName;
            const isNew =
                (subtask as any)._isNew || (subtask as any).isNew || false;
            const isEdited = !isNew && isNameChanged;

            return {
                ...subtask,
                name: trimmedName,
                isNew,
                isEdited,
                _isNew: isNew,
                _isEdited: isEdited,
            };
        });

        pushSubtasksUpdate(updatedSubtasks);
        setEditingIndex(null);
        setEditingName('');
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingName('');
    };

    const handleToggleNewSubtaskCompletion = (index: number) => {
        const updatedSubtasks = subtasks.map((subtask, i) => {
            if (i !== index) return subtask;

            const isDone = subtask.status === 'done' || subtask.status === 2;
            const newStatus = isDone
                ? ('not_started' as const)
                : ('done' as const);
            const hasId =
                subtask.id &&
                !((subtask as any)._isNew || (subtask as any).isNew);

            return {
                ...subtask,
                status: newStatus,
                completed_at: isDone ? null : new Date().toISOString(),
                _statusChanged: hasId,
            };
        });

        onSubtasksChange(updatedSubtasks);
    };

    const handleToggleSubtaskCompletion = async (
        subtask: Task,
        index: number
    ) => {
        const isPersisted =
            Boolean(subtask.id) &&
            Boolean(subtask.uid) &&
            !((subtask as any)._isNew || (subtask as any).isNew);

        if (isPersisted) {
            try {
                const updatedSubtask = await toggleTaskCompletion(subtask.uid!);

                if (onSubtaskUpdate) {
                    await onSubtaskUpdate(updatedSubtask);
                } else {
                    replaceSubtask(index, updatedSubtask);
                }
            } catch (error) {
                console.error('Error toggling subtask completion:', error);
            }
            return;
        }

        handleToggleNewSubtaskCompletion(index);
    };

    /* const handleAssigneeUpdated = async (
        index: number,
        updatedSubtask: Task
    ) => {
        replaceSubtask(index, updatedSubtask);
        if (onSubtaskUpdate) {
            await onSubtaskUpdate(updatedSubtask);
        }
    }; */

    return (
        <div ref={subtasksSectionRef} className="space-y-3">
            {isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                <div className="space-y-1">
                    {subtasks.map((subtask, index) => (
                        <div
                            key={subtask.id || subtask.uid || index}
                            className="rounded-lg border-2 border-gray-50 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
                        >
                            {editingIndex === index ? (
                                <div className="flex items-center space-x-3 overflow-hidden px-3 py-2.5">
                                    <div className="flex-shrink-0">
                                        <TaskPriorityIcon
                                            priority={subtask.priority || 'low'}
                                            status={
                                                subtask.status || 'not_started'
                                            }
                                            onToggleCompletion={() =>
                                                void handleToggleSubtaskCompletion(
                                                    subtask,
                                                    index
                                                )
                                            }
                                        />
                                    </div>

                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) =>
                                            setEditingName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveEdit();
                                            } else if (e.key === 'Escape') {
                                                handleCancelEdit();
                                            }
                                        }}
                                        onBlur={handleSaveEdit}
                                        className="flex-1 overflow-hidden rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
                                        autoFocus
                                    />

                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                                        title={t('actions.cancel', 'Cancel')}
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-3 overflow-visible px-3 py-2.5">
                                    <div className="flex min-w-0 flex-1 items-start space-x-3 overflow-visible">
                                        <div className="flex-shrink-0 pt-0.5">
                                            <TaskPriorityIcon
                                                priority={
                                                    subtask.priority || 'low'
                                                }
                                                status={
                                                    subtask.status ||
                                                    'not_started'
                                                }
                                                onToggleCompletion={() =>
                                                    void handleToggleSubtaskCompletion(
                                                        subtask,
                                                        index
                                                    )
                                                }
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-2">
                                            <span
                                                className={`block cursor-pointer break-words text-sm hover:text-blue-600 dark:hover:text-blue-400 ${
                                                    subtask.status === 'done' ||
                                                    subtask.status === 2 ||
                                                    subtask.status ===
                                                        'archived' ||
                                                    subtask.status === 3
                                                        ? 'text-gray-500 dark:text-gray-400'
                                                        : 'text-gray-900 dark:text-gray-100'
                                                }`}
                                                onClick={() =>
                                                    handleEditSubtask(index)
                                                }
                                                title={t(
                                                    'actions.clickToEdit',
                                                    'Click to edit'
                                                )}
                                            >
                                                {subtask.name}
                                            </span>

                                            <SubtaskAssigneeSelector
                                                subtask={subtask}
                                                onUpdated={(updatedSubtask) => {
                                                    // 🔥 Deep Immutable Update: الطريقة الوحيدة اللي بتجبر React يعمل ريفرش للشاشة فوراً
                                                    const newSubtasks =
                                                        subtasks.map((st, i) =>
                                                            i === index
                                                                ? {
                                                                      ...st,
                                                                      assignees:
                                                                          updatedSubtask.assignees,
                                                                  }
                                                                : st
                                                        );

                                                    onSubtasksChange(
                                                        newSubtasks
                                                    ); // إبلاغ الـ Parent بالتحديث
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleDeleteSubtask(index)
                                        }
                                        className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                        title={t('actions.delete', 'Delete')}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('subtasks.noSubtasks', 'No subtasks yet')}
                </div>
            )}

            <div className="flex items-center space-x-2">
                <input
                    ref={addInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('subtasks.placeholder', 'Add a subtask...')}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                    type="button"
                    onClick={handleCreateSubtask}
                    disabled={!newSubtaskName.trim()}
                    className="rounded-md bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title={t('actions.add', 'Add')}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default TaskSubtasksSection;
