import React, { useEffect, useMemo, useState } from 'react';
import {
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';
import NewTask from '../Task/NewTask';
import TaskList from '../Task/TaskList';
import { TFunction } from 'i18next';

interface ProjectTasksSectionProps {
    project: Project | null;
    displayTasks: Task[];
    taskStatusFilter: 'all' | 'active' | 'completed';
    showAutoSuggestForm: boolean;
    onAddNextAction: (projectId: number, description: string) => void;
    onDismissNextAction: () => void;
    onTaskCreate: (taskName: string) => Promise<void>;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    allProjects: Project[];
    showCompleted: boolean;
    taskSearchQuery: string;
    t: TFunction;
}

const UNKNOWN_DATE_KEY = '__unknown__';

const getLocalDateKey = (value: string | Date): string | null => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getDateFromKey = (dateKey: string): Date | null => {
    const [year, month, day] = dateKey.split('-').map(Number);

    if (!year || !month || !day) {
        return null;
    }

    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const ProjectTasksSection: React.FC<ProjectTasksSectionProps> = ({
    project,
    displayTasks,
    taskStatusFilter,
    showAutoSuggestForm,
    onAddNextAction,
    onDismissNextAction,
    onTaskCreate,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    onToggleToday,
    allProjects,
    showCompleted,
    taskSearchQuery,
    t,
}) => {
    const [expandedCompletedDays, setExpandedCompletedDays] = useState<
        Record<string, boolean>
    >({});

    const [currentDayKey, setCurrentDayKey] = useState(
        () => getLocalDateKey(new Date()) || ''
    );

    /*
     * Recalculate "Today" when midnight passes.
     *
     * No API call and no WebSocket event are needed here because
     * the task data itself did not change — only the current day changed.
     */
useEffect(() => {
    if (taskStatusFilter === 'active') {
        return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const scheduleNextMidnight = () => {
        const now = new Date();

        const nextMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            0,
            0,
            1,
            0
        );

        const delay = Math.max(
            1000,
            nextMidnight.getTime() - now.getTime()
        );

        timer = setTimeout(() => {
            setCurrentDayKey(getLocalDateKey(new Date()) || '');
            scheduleNextMidnight();
        }, delay);
    };

    scheduleNextMidnight();

    return () => {
        clearTimeout(timer);
    };
}, [taskStatusFilter]);

    const completedTasks = useMemo(() => {
        return displayTasks.filter(
            (task) =>
                task.status === 'done' ||
                task.status === 'archived' ||
                task.status === 2 ||
                task.status === 3
        );
    }, [displayTasks]);
    /*
     * displayTasks stays our source of truth.
     *
     * We do NOT copy tasks into another state.
     * This is derived data, so useMemo is the correct place.
     */
        const completedTaskGroups = useMemo(() => {
            if (taskStatusFilter === 'active') {
                return [];
            }

            const groups = new Map<string, Task[]>();

            completedTasks.forEach((task) => {
                const dateKey = task.completed_at
                    ? getLocalDateKey(task.completed_at)
                    : null;

                const groupKey = dateKey || UNKNOWN_DATE_KEY;

                const currentTasks = groups.get(groupKey);

                if (currentTasks) {
                    currentTasks.push(task);
                } else {
                    groups.set(groupKey, [task]);
                }
            });

            return Array.from(groups.entries())
                .sort(([dateA], [dateB]) => {
                    if (dateA === UNKNOWN_DATE_KEY) return 1;
                    if (dateB === UNKNOWN_DATE_KEY) return -1;

                    return dateB.localeCompare(dateA);
                })
                .map(([dateKey, tasks]) => ({
                    dateKey,
                    tasks,
                }));
        }, [completedTasks, taskStatusFilter]);

    const yesterdayKey = useMemo(() => {
        const today = getDateFromKey(currentDayKey);

        if (!today) {
            return '';
        }

        today.setDate(today.getDate() - 1);

        return getLocalDateKey(today) || '';
    }, [currentDayKey]);

    const getCompletedDayLabel = (dateKey: string) => {
        if (dateKey === UNKNOWN_DATE_KEY) {
            return t(
                'tasks.unknownCompletionDate',
                'Unknown completion date'
            );
        }

        if (dateKey === currentDayKey) {
            return t('tasks.today', 'Today');
        }

        if (dateKey === yesterdayKey) {
            return t('tasks.yesterday', 'Yesterday');
        }

        const date = getDateFromKey(dateKey);

        if (!date) {
            return dateKey;
        }

        return new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    };

    const toggleCompletedDay = (dateKey: string) => {
        setExpandedCompletedDays((prev) => {
            const currentlyExpanded =
                prev[dateKey] ??
                (dateKey === currentDayKey &&
                    dateKey !== UNKNOWN_DATE_KEY);

            return {
                ...prev,
                [dateKey]: !currentlyExpanded,
            };
        });
    };

    const renderTaskList = (tasks: Task[]) => (
        <TaskList
            tasks={tasks}
            onTaskUpdate={onTaskUpdate}
            onTaskCompletionToggle={onTaskCompletionToggle}
            onTaskDelete={onTaskDelete}
            projects={allProjects}
            hideProjectName={true}
            onToggleToday={onToggleToday}
            showCompletedTasks={showCompleted}
        />
    );

    const renderCompletedGroups = () => (
    <div className="space-y-2">
        {completedTaskGroups.map(({ dateKey, tasks }) => {
            const isExpanded =
                expandedCompletedDays[dateKey] ??
                (dateKey === currentDayKey &&
                    dateKey !== UNKNOWN_DATE_KEY);

            return (
                <div
                    key={dateKey}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                    <button
                        type="button"
                        onClick={() => toggleCompletedDay(dateKey)}
                        aria-expanded={isExpanded}
                        className="w-full flex items-center justify-between gap-4 px-1 py-3 text-left rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                                <ChevronDownIcon className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                            ) : (
                                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                            )}

                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                {getCompletedDayLabel(dateKey)}
                            </span>
                        </div>

                        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                            {tasks.length}
                        </span>
                    </button>

                    {isExpanded && (
                        <div className="pb-3">
                            {renderTaskList(tasks)}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

    const activeTasks = useMemo(() => {
    return displayTasks.filter(
        (task) =>
            task.status === 'not_started' ||
            task.status === 'in_progress' ||
            task.status === 'waiting' ||
            task.status === 0 ||
            task.status === 1 ||
            task.status === 4
    );
}, [displayTasks]);


    return (
        <div className="xl:col-span-2 flex flex-col gap-2">
            {showAutoSuggestForm && (
                <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                    <AutoSuggestNextActionBox
                        onAddAction={(actionDescription) => {
                            if (project?.id) {
                                onAddNextAction(
                                    project.id,
                                    actionDescription
                                );
                            }
                        }}
                        onDismiss={onDismissNextAction}
                    />
                </div>
            )}

            <div className="transition-all duration-300 ease-in-out overflow-visible opacity-100 transform translate-y-0">
                <NewTask onTaskCreate={onTaskCreate} />
            </div>

            <div className="transition-all duration-300 ease-in-out overflow-visible">
                {displayTasks.length > 0 ? (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0 overflow-visible">
                    {taskStatusFilter === 'active' &&
                        renderTaskList(displayTasks)}

                    {taskStatusFilter === 'all' && (
                        <div className="space-y-6">
                            {activeTasks.length > 0 && (
                                <div>
                                    <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t('tasks.open', 'Open')}
                                    </div>

                                    {renderTaskList(activeTasks)}
                                </div>
                            )}

                            {completedTasks.length > 0 && (
                                <div>
                                    <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t('tasks.completed', 'Completed')}
                                    </div>

                                    {renderCompletedGroups()}
                                </div>
                            )}
                        </div>
                    )}

                    {taskStatusFilter === 'completed' &&
                        renderCompletedGroups()}
                    </div>
                ) : (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                        <p className="text-gray-500 dark:text-gray-400">
                            {taskSearchQuery.trim()
                                ? t(
                                      'tasks.noTasksAvailable',
                                      'No tasks available.'
                                  )
                                : showCompleted
                                  ? t(
                                        'project.noCompletedTasks',
                                        'No completed tasks.'
                                    )
                                  : t(
                                        'project.noTasks',
                                        'No tasks.'
                                    )}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectTasksSection;