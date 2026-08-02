import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskEvent } from '../../entities/TaskEvent';
import {
    getTaskTimeline,
    getEventTypeLabel,
    getPriorityLabel,
} from '../../utils/taskEventService';
import {
    ClockIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';
import { getTodayDateString, getTomorrowDateString, getYesterdayDateString } from '../../utils/dateUtils';

interface TaskTimelineProps {
    taskUid: string | undefined;
    refreshKey?: number;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ taskUid, refreshKey }) => {
    const { t } = useTranslation();
    const [events, setEvents] = useState<TaskEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTimeline = async () => {
            if (!taskUid) {
                setLoading(false);
                setEvents([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const timeline = await getTaskTimeline(taskUid);
                const sortedTimeline = timeline.sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                );
                setEvents(sortedTimeline);
            } catch (err) {
                console.error('Error fetching task timeline:', err);
                setError(t('timeline.failedToLoad', 'Failed to load timeline'));
            } finally {
                setLoading(false);
            }
        };

        fetchTimeline();
    }, [taskUid, refreshKey]);

    const getTranslatedStatusLabel = (status: number | string): string => {
        const statusMap: Record<string | number, string> = {
            0: t('status.notStarted'),
            1: t('status.inProgress'),
            2: t('status.completed'),
            3: t('status.archived'),
            4: t('status.waiting'),
            not_started: t('status.notStarted'),
            in_progress: t('status.inProgress'),
            done: t('status.completed'),
            completed: t('status.completed'),
            archived: t('status.archived'),
            waiting: t('status.waiting'),
        };
        return statusMap[status] || t('status.unknown', { status });
    };

    // 🆕 اسم اليوزر بالكامل، مع fallback للـ ID لو مفيش user object
    const getUserDisplayName = (event: TaskEvent): string => {
        if (event.user?.name) {
            return event.user.surname
                ? `${event.user.name} ${event.user.surname}`
                : event.user.name;
        }
        return `${t('timeline.userFallback', 'User')} #${event.user_id}`;
    };

    // 🆕 حروف الأفاتار (لو مفيش صورة)
    const getUserInitials = (event: TaskEvent): string => {
        const name = event.user?.name || `U${event.user_id}`;
        return name.trim().charAt(0).toUpperCase();
    };

    const getEventDescription = (event: TaskEvent) => {
        const { event_type, old_value, new_value } = event;

        switch (event_type) {
            case 'created':
                return t('timeline.events.taskCreated');
            case 'status_changed':
            case 'completed': {
                const oldStatus = old_value?.status;
                const newStatus = new_value?.status;
                if (oldStatus !== undefined && newStatus !== undefined) {
                    return `${t('timeline.events.status')}: ${getTranslatedStatusLabel(oldStatus)} → ${getTranslatedStatusLabel(newStatus)}`;
                }
                return t('timeline.events.statusChanged');
            }
            case 'priority_changed': {
                const oldPriority = old_value?.priority;
                const newPriority = new_value?.priority;
                if (oldPriority !== undefined && newPriority !== undefined) {
                    return `${t('timeline.events.priority')}: ${getPriorityLabel(oldPriority)} → ${getPriorityLabel(newPriority)}`;
                }
                return t('timeline.events.priorityChanged');
            }
            case 'due_date_changed': {
                const oldDate = old_value?.due_date;
                const newDate = new_value?.due_date;
                if (oldDate || newDate) {
                    return `${t('timeline.events.dueDate')}: ${formatDate(oldDate)} → ${formatDate(newDate)}`;
                }
                return t('timeline.events.dueDateChanged');
            }
            case 'defer_until_changed': {
                const oldDeferDate = old_value?.defer_until;
                const newDeferDate = new_value?.defer_until;
                if (oldDeferDate || newDeferDate) {
                    return `${t('timeline.events.deferUntil')}: ${formatDate(oldDeferDate)} → ${formatDate(newDeferDate)}`;
                }
                return t('timeline.events.deferUntilChanged');
            }
            case 'recurrence_end_date_changed': {
                const oldDate = old_value?.recurrence_end_date;
                const newDate = new_value?.recurrence_end_date;
                if (oldDate || newDate) {
                    return `${t('timeline.events.recurrenceEndDate')}: ${formatDate(oldDate)} → ${formatDate(newDate)}`;
                }
                return t('timeline.events.recurrenceEndDateChanged');
            }
            case 'recurrence_type_changed': {
                const oldType = old_value?.recurrence_type;
                const newType = new_value?.recurrence_type;
                if (oldType !== undefined && newType !== undefined) {
                    const formatRecurrenceType = (type: string) => {
                        const typeMap: Record<string, string> = {
                            none: t('recurrence.none', 'None'),
                            daily: t('recurrence.daily', 'Daily'),
                            weekly: t('recurrence.weekly', 'Weekly'),
                            monthly: t('recurrence.monthly', 'Monthly'),
                            monthly_weekday: t('recurrence.monthlyWeekday', 'Monthly (weekday)'),
                            monthly_last_day: t('recurrence.monthlyLastDay', 'Monthly (last day)'),
                        };
                        return typeMap[type] || type;
                    };
                    return `${t('timeline.events.recurrenceType')}: ${formatRecurrenceType(oldType)} → ${formatRecurrenceType(newType)}`;
                }
                return t('timeline.events.recurrenceTypeChanged');
            }
            case 'recurrence_interval_changed':
                return t('timeline.events.recurrenceIntervalChanged', 'Recurrence interval updated');
            case 'recurrence_weekday_changed':
                return t('timeline.events.recurrenceWeekdayChanged', 'Recurrence weekday updated');
            case 'recurrence_month_day_changed':
                return t('timeline.events.recurrenceMonthDayChanged', 'Recurrence day of month updated');
            case 'recurrence_week_of_month_changed':
                return t('timeline.events.recurrenceWeekOfMonthChanged', 'Recurrence week of month updated');
            case 'recurring_occurrence_completed':
                return t('timeline.events.recurringOccurrenceCompleted', 'Recurring occurrence completed');
            case 'completion_based_changed':
                return t('timeline.events.completionBasedChanged');
            case 'name_changed':
                return t('timeline.events.nameUpdated');
            case 'description_changed':
                return t('timeline.events.descriptionUpdated');
            case 'note_changed':
                return t('timeline.events.noteUpdated');
            case 'project_changed':
                return t('timeline.events.projectChanged');
            case 'project_id_changed':
                return t('timeline.events.projectIdChanged');
            case 'tags_changed':
                return t('timeline.events.tagsUpdated');
            case 'archived':
                return t('timeline.events.taskArchived');
            case 'deleted':
                return t('timeline.events.taskDeleted', 'Task deleted');
            case 'restored':
                return t('timeline.events.taskRestored', 'Task restored');
            case 'today_changed':
                return t('timeline.events.todayFlagChanged');
            case 'assignee_changed': {
                const oldAssignee = old_value?.assignee;
                const newAssignee = new_value?.assignee;
                if (oldAssignee || newAssignee) {
                    return `${t('timeline.events.assignee', 'Assignee')}: ${oldAssignee || t('timeline.events.none')} → ${newAssignee || t('timeline.events.none')}`;
                }
                return t('timeline.events.assigneeChanged', 'Assignee updated');
            }
            case 'comment_added':
                return t('timeline.events.commentAdded', 'added a comment');
            default:
                return getEventTypeLabel(event_type);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('timeline.events.none');
        const date = new Date(dateString);
        const today = getTodayDateString();
        const tomorrow = getTomorrowDateString();
        const yesterday = getYesterdayDateString();
        const dateOnly = dateString.split('T')[0];

        if (dateOnly === today) return t('dateIndicators.today');
        if (dateOnly === tomorrow) return t('dateIndicators.tomorrow');
        if (dateOnly === yesterday) return t('dateIndicators.yesterday');

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return t('timeline.justNow', 'Just now');
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    // 🆕 الوقت الدقيق بالساعة والدقيقة والتاريخ الكامل
    const formatExactTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-6 w-6 mb-2 animate-spin" />
                <span className="text-sm">Loading timeline...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-red-500">
                <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">{error}</span>
            </div>
        );
    }

    if (!taskUid) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <SparklesIcon className="h-6 w-6 mb-2" />
                <span className="text-sm text-center">
                    Timeline will appear after saving
                </span>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-12 w-12 mb-3 opacity-50" />
                <span className="text-sm text-center">
                    {t('task.noActivityYet', 'No activity yet')}
                </span>
            </div>
        );
    }

    return (
        <div className="max-h-[36rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="space-y-3">
                {events.map((event) => (
                    <div key={event.id} className="relative flex gap-2.5">
                        {/* 🆕 Avatar */}
                        <div className="flex-shrink-0 mt-0.5">
                            {event.user?.avatar_image ? (
                                <img
                                    src={event.user.avatar_image}
                                    alt={getUserDisplayName(event)}
                                    className="h-7 w-7 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                />
                            ) : (
                                <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold">
                                    {getUserInitials(event)}
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 py-0.5">
                            {/* 🆕 اسم اليوزر + الـ id + الفعل */}
                            <div className="text-xs leading-tight">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {getUserDisplayName(event)}
                                </span>
                                <span className="text-gray-400 dark:text-gray-500 mx-1">
                                    (ID: {event.user_id})
                                </span>
                            </div>

                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight mt-0.5">
                                {getEventDescription(event)}
                            </div>

                            {/* 🆕 الوقت الدقيق + النسبي مع بعض */}
                            <div
                                className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                                title={new Date(event.created_at).toISOString()}
                            >
                                {formatExactTime(event.created_at)}
                                <span className="mx-1">·</span>
                                {formatTimeAgo(event.created_at)}
                            </div>

                            {/* 🆕 محتوى الكومنت */}
                            {event.event_type === 'comment_added' &&
                                event.new_value?.comment && (
                                    <div className="mt-1.5 flex items-start gap-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5">
                                        <ChatBubbleLeftIcon className="h-3.5 w-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                                            {event.new_value.comment}
                                        </span>
                                    </div>
                                )}

                            {/* الـ tags زي ما هي */}
                            {event.event_type === 'tags_changed' &&
                                event.new_value &&
                                Array.isArray(event.new_value) && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {event.new_value.map((tag: any, tagIndex: number) => (
                                            <span
                                                key={tagIndex}
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                                            >
                                                {tag.name || tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                            {/* 🆕 مصدر الحدث (web/api/telegram) لو موجود */}
                            {event.metadata?.source && event.metadata.source !== 'web' && (
                                <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                    via {event.metadata.source}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TaskTimeline;