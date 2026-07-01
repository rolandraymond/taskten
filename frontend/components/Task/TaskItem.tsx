import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// Entities & Constants
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { isTaskCompleted } from '../../constants/taskStatus';

// UI Components
import TaskHeader from './TaskHeader';
import TaskPriorityIcon from '../Shared/Icons/TaskPriorityIcon';
import ConfirmDialog from '../Shared/ConfirmDialog';

// Hooks & Services
import { useToast } from '../Shared/ToastContext';
import { toggleTaskCompletion, fetchSubtasks } from '../../utils/tasksService';
import { isTaskOverdueInTodayPlan } from '../../utils/dateUtils';
import { getApiPath } from '../../config/paths';

// ----------------------------------------------------------------------

interface SubtasksDisplayProps {
    loadingSubtasks: boolean;
    subtasks: Task[];
    onTaskClick: (event: React.MouseEvent) => void;
    loadSubtasks: () => Promise<void>;
    onSubtaskUpdate: (updatedSubtask: Task) => void;
}

const getPriorityBorderClassName = (priority?: Task['priority'] | number): string => {
    let normalizedPriority = priority;
    if (typeof normalizedPriority === 'number') {
        const priorityNames: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
        normalizedPriority = priorityNames[normalizedPriority] || undefined;
    }

    switch (normalizedPriority) {
        case 'high': return 'border-l-4 border-l-red-500';
        case 'medium': return 'border-l-4 border-l-yellow-400';
        case 'low': return 'border-l-4 border-l-blue-400';
        default: return 'border-l-4 border-l-transparent';
    }
};

const SubtasksDisplay: React.FC<SubtasksDisplayProps> = ({
    loadingSubtasks,
    subtasks,
    onTaskClick,
    loadSubtasks,
    onSubtaskUpdate,
}) => {
    const { t } = useTranslation();

    if (loadingSubtasks) {
        return (
            <div className="ml-[10%] py-2 text-xs text-gray-400 animate-pulse">
                {t('loading.subtasks', 'Loading subtasks...')}
            </div>
        );
    }

    if (subtasks.length === 0) {
        return (
            <div className="ml-[10%] py-2 text-xs text-gray-500 italic">
                {t('subtasks.noSubtasks', 'No subtasks found')}
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 space-y-2 relative z-0"
        >
            {subtasks.map((subtask) => {
                const borderClass = isTaskCompleted(subtask.status)
                    ? 'border-l-4 border-l-green-500'
                    : getPriorityBorderClassName(subtask.priority);
                
                return (
                    <div key={subtask.id} className="ml-[10%]">
                        <div
                            className={`rounded-lg shadow-sm bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm relative transition-all duration-300 hover:ring-1 hover:ring-blue-500/30 cursor-pointer ${borderClass}`}
                            onClick={onTaskClick}
                        >
                            <div className="px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <TaskPriorityIcon
                                        priority={subtask.priority || 'low'}
                                        status={subtask.status || 'not_started'}
                                        onToggleCompletion={async () => {
                                            if (!subtask.uid) return;
                                            try {
                                                const updated = await toggleTaskCompletion(subtask.uid, subtask);
                                                if (updated.parent_child_logic_executed) {
                                                    setTimeout(() => window.location.reload(), 200);
                                                    return;
                                                }
                                                onSubtaskUpdate(updated);
                                            } catch (error) {
                                                console.error('Error toggling subtask:', error);
                                                await loadSubtasks();
                                            }
                                        }}
                                    />
                                    <span className={`text-sm truncate transition-all duration-300 ${
                                        isTaskCompleted(subtask.status)
                                            ? 'text-gray-400 dark:text-gray-500 line-through'
                                            : 'text-gray-700 dark:text-gray-200'
                                    }`}>
                                        {subtask.original_name || subtask.name}
                                    </span>
                                </div>
                                {isTaskCompleted(subtask.status) && (
                                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 px-1.5 rounded-full">✓</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </motion.div>
    );
};

interface TaskItemProps {
    task: Task;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    isUpcomingView?: boolean;
    showCompletedTasks?: boolean;
    isInCompletedSection?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({
    task,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    isUpcomingView = false,
    showCompletedTasks = false,
    isInCompletedSection = false,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [subtasks, setSubtasks] = useState<Task[]>(task.subtasks || []);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [showSubtasks, setShowSubtasks] = useState(false);

    const project = useMemo(() => 
        task.Project || projects.find((p) => p.id === task.project_id)
    , [task.Project, projects, task.project_id]);

    const completionPercentage = useMemo(() => {
        if (subtasks.length === 0) return 0;
        const done = subtasks.filter(st => isTaskCompleted(st.status)).length;
        return Math.round((done / subtasks.length) * 100);
    }, [subtasks]);

    const isOverdue = useMemo(() => isTaskOverdueInTodayPlan(task), [task]);
    const isInProgress = task.status === 'in_progress' || task.status === 1;

    useEffect(() => {
        if (task.subtasks) setSubtasks(task.subtasks);
    }, [task.subtasks]);

    const loadSubtasks = useCallback(async () => {
        if (!task.uid) return;
        setLoadingSubtasks(true);
        try {
            const data = await fetchSubtasks(task.uid);
            setSubtasks(data);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
        } finally {
            setLoadingSubtasks(false);
        }
    }, [task.uid]);

    const handleTaskClick = () => {
        if (!task.uid) return;
        const fromState = { state: { from: location.pathname + location.search } };
        navigate(task.habit_mode ? `/habit/${task.uid}` : `/task/${task.uid}`, fromState);
    };

    const handleSubtasksToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showSubtasks && subtasks.length === 0) {
            await loadSubtasks();
        }
        setShowSubtasks(!showSubtasks);
    };

    const handleToggleCompletion = async () => {
        if (!task.uid || !task.id) return;
        try {
            const isCompleting = !isTaskCompleted(task.status);
            if (isCompleting && isUpcomingView && !showCompletedTasks) {
                setIsAnimatingOut(true);
                await new Promise(r => setTimeout(r, 300));
            }

            const response = await toggleTaskCompletion(task.uid, task);

            if (onTaskCompletionToggle) {
                onTaskCompletionToggle(response);
            } else {
                const merged = {
                    ...task,
                    ...response,
                    subtasks: response.subtasks || task.subtasks || [],
                };
                await onTaskUpdate(merged);
            }

            if (response.parent_child_logic_executed) {
                setTimeout(async () => {
                    try {
                        const res = await fetch(getApiPath(`task/${task.uid}`));
                        if (res.ok) onTaskUpdate(await res.json());
                    } catch { // FIX: Removed unused 'err' here
                        window.location.reload();
                    }
                }, 200);
            }
        } catch (error) {
            console.error('Toggle failed:', error);
            showErrorToast(t('errors.updateFailed'));
            setIsAnimatingOut(false);
        }
    };

    const priorityBorderClass = (isInCompletedSection || isTaskCompleted(task.status))
        ? 'border-l-4 border-l-green-500'
        : getPriorityBorderClassName(task.priority);

    return (
        <div className={`relative transition-all duration-500 ${isStatusMenuOpen ? 'z-[10001]' : 'z-0'}`}>
            <motion.div
                layout
                className={`
                    group rounded-xl shadow-sm bg-white dark:bg-gray-900 relative overflow-visible 
                    transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-700
                    ${priorityBorderClass}
                    ${isInProgress ? 'ring-2 ring-blue-500/40 dark:ring-blue-600/40' : ''}
                    ${isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
                `}
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between min-h-[56px]">
                    <TaskHeader
                        task={task}
                        project={project}
                        onTaskClick={handleTaskClick}
                        onToggleCompletion={handleToggleCompletion}
                        hideProjectName={hideProjectName}
                        onToggleToday={onToggleToday}
                        onTaskUpdate={onTaskUpdate}
                        isOverdue={isOverdue}
                        showSubtasks={showSubtasks}
                        hasSubtasks={(task.subtasks?.length || 0) > 0 || subtasks.length > 0 || loadingSubtasks}
                        onSubtasksToggle={handleSubtasksToggle}
                        onEdit={() => navigate(`/task/${task.uid}`)}
                        onDelete={() => setIsConfirmDialogOpen(true)}
                        isUpcomingView={isUpcomingView}
                        onMenuOpenChange={setIsStatusMenuOpen}
                    />

                    <AnimatePresence>
                        {task.Assignees && task.Assignees.length > 0 && (
                            <div className="flex items-center px-4 pb-3 md:pb-0 -space-x-2 ml-10 md:ml-0 group/avatars transition-transform hover:translate-x-1">
                                {task.Assignees.slice(0, 3).map((assignee: any, idx) => (
                                    <motion.img
                                        key={assignee.uid || idx}
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        src={assignee.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.name || 'User')}&background=random&color=fff`}
                                        alt={assignee.name || 'User'}
                                        className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 object-cover shadow-sm ring-1 ring-gray-100/10 grayscale group-hover/avatars:grayscale-0 transition-all duration-500"
                                        title={assignee.name || 'User'}
                                    />
                                ))}
                                {task.Assignees.length > 3 && (
                                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 text-[10px] font-bold text-gray-500">
                                        +{task.Assignees.length - 3}
                                    </div>
                                )}
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {subtasks.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden opacity-100 rounded-b-xl">
                        <div className="w-full h-full bg-gray-100 dark:bg-gray-800/50">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${completionPercentage}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-emerald-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            />
                        </div>
                    </div>
                )}
            </motion.div>

            <AnimatePresence>
                {showSubtasks && !(task.status === 'archived' || task.status === 3) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <SubtasksDisplay
                            loadingSubtasks={loadingSubtasks}
                            subtasks={subtasks}
                            onTaskClick={(ev) => {
                                ev.stopPropagation();
                                handleTaskClick();
                            }}
                            loadSubtasks={loadSubtasks}
                            onSubtaskUpdate={(updated) => {
                                setSubtasks(prev => prev.map(s => s.id === updated.id ? updated : s));
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {isConfirmDialogOpen && (
                <ConfirmDialog
                    title={t('tasks.deleteConfirmTitle', 'Delete Task')}
                    message={t('tasks.deleteConfirmMessage', { name: task.name })}
                    onConfirm={() => {
                        onTaskDelete(task.uid!);
                        setIsConfirmDialogOpen(false);
                    }}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}
        </div>
    );
};

export default React.memo(TaskItem);