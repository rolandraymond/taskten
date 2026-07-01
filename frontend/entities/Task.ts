import { Tag } from './Tag';
import { Project } from './Project';
import { Attachment } from './Attachment';
import { Assignee } from './User';

// ─── TaskAssignee (من الـ serializer) ─────────────────────────────────────────
export interface TaskAssignee {
    id: number;
    uid?: string;
    label?: string;
    name?: string;
    surname?: string;
    email?: string;
    avatar?: string | null;
    avatar_image?: string | null;
    isAdmin?: boolean;
    role?: 'admin' | 'co_admin' | 'client' | 'user';
}

// ─── Task (merged) ────────────────────────────────────────────────────────────
export interface Task {
    id?: number;
    uid?: string;
    name: string;
    original_name?: string;
    description?: string;
    status: StatusType | number;
    priority?: PriorityType | number;
    today?: boolean;
    due_date?: string | null;
    defer_until?: string;
    start_date?: string | null;
    note?: string;
    tags?: Tag[];
    project_id?: number | null;
    area_id?: number | null;
    parent_task_id?: number | null;
    Project?: Project;
    created_at?: string;
    updated_at?: string;
    recurrence_type?: RecurrenceType;
    recurrence_interval?: number;
    recurrence_end_date?: string;
    recurrence_weekday?: number;
    recurrence_weekdays?: number[];
    recurrence_month_day?: number;
    recurrence_week_of_month?: number;
    completion_based?: boolean;
    recurring_parent_id?: number;
    recurring_parent_uid?: string;
    completed_at: string | null;
    subtasks?: Task[];
    parent_child_logic_executed?: boolean;
    attachments?: Attachment[];
    subtasks_count?: number;

    // Main task assignees (belongsToMany via TaskAssignment)
    Assignees?: Assignee[];
    // Serialized assignees from backend serializer (lowercase)
    assignees?: TaskAssignee[];

    // Internal frontend-only flags
    isNew?: boolean;
    _isNew?: boolean;
    isEdited?: boolean;
    _isEdited?: boolean;
    _statusChanged?: boolean;

    // Habit fields
    habit_mode?: boolean;
    habit_target_count?: number;
    habit_frequency_period?: 'daily' | 'weekly' | 'monthly';
    habit_streak_mode?: 'calendar' | 'scheduled';
    habit_flexibility_mode?: 'strict' | 'flexible';
    habit_current_streak?: number;
    habit_best_streak?: number;
    habit_total_completions?: number;
    habit_last_completion_at?: string;

    [key: string]: any;
}

export type StatusType =
    | 'not_started'
    | 'in_progress'
    | 'done'
    | 'archived'
    | 'waiting'
    | 'cancelled'
    | 'planned';

export type PriorityType = 'low' | 'medium' | 'high' | null | undefined;

export type RecurrenceType =
    | 'none'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'monthly_weekday'
    | 'monthly_last_day';