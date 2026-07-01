import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivitySummary = { totalActions: number; productivityScore: number };

type ActivityFeedItem = {
    id: number;
    time: string;
    taskName: string;
    taskUid: string | null;
    actionText: string;
    points: number;
    iconType:
        | 'info'
        | 'plus'
        | 'play'
        | 'check'
        | 'edit'
        | 'calendar'
        | 'flag'
        | 'list'
        | 'update';
    details?: { old: unknown; new: unknown };
    isSubtask?: boolean;
    parentTaskUid?: string | null;
};

type MonthlySeriesPoint = {
    date: string;
    score: number;
    points: number;
};

type DailyActivityResponse = {
    date: string;
    userId: number;
    summary: ActivitySummary;
    feed: ActivityFeedItem[];
    monthlySeries?: MonthlySeriesPoint[];
    teamAverageScore?: number;
    strategicMetrics?: {
        targetScore?: number;
        targetFocusScore?: number;
        targetExecutionRate?: number;
    };
};

type UserItem = {
    id: number;
    name?: string | null;
    surname?: string | null;
    email?: string | null;
};

type Tone = 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' | 'violet';

type Insight = { title: string; body: string; tone: Tone };

type TaskPulse = {
    taskUid: string;
    taskName: string;
    totalActions: number;
    totalPoints: number;
    completed: number;
    edits: number;
    starts: number;
    lastAction: string;
    isSubtask?: boolean;
    parentTaskUid?: string | null;
};

type AlertItem = {
    title: string;
    body: string;
    tone: Tone;
    priority: 'high' | 'medium' | 'low';
};

// ✅ نوع جديد للعادات
type HabitStat = {
    id: number;
    uid: string;
    name: string;
    recurrence_type: string;
    habit_current_streak: number;
    habit_best_streak: number;
    habit_total_completions: number;
    habit_last_completion_at: string | null;
    created_at: string;
    status: number;
    stats: {
        completionRate: number | null;
        periodCompletions: number;
        completionDates: string[]; // YYYY-MM-DD
    };
};

type StrategicThresholds = {
    targetScore: number;
    burnoutEditLimit: number;
    focusMinHours: number;
    concentrationMax: number;
    roiMultiplier: number;
};

type ResourceCell = {
    hour: number;
    label: string;
    score: number;
    count: number;
};

type CreativeSignal = {
    title: string;
    body: string;
    tone: Tone;
    accent: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' | 'violet';
};

type StuckTaskInsight = TaskPulse & {
    completionRate: number;
    editPressure: number;
    stuckScore: number;
    severity: 'high' | 'medium' | 'low';
    reason: string;
};

type ManagerDigest = {
    headline: string;
    body: string;
    statusTone: Tone;
    bullets: Array<{ label: string; value: string }>;
    nextActions: string[];
};

type StrategicCategory =
    | 'planning'
    | 'design'
    | 'quality'
    | 'delivery'
    | 'collaboration'
    | 'discovery'
    | 'execution';

type TeamSnapshot = {
    user: UserItem;
    totalActions: number;
    productivityScore: number;
    executionRate: number;
    averagePoints: number;
    activeCount: number;
    status: 'healthy' | 'risky' | 'overloaded' | 'idle';
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_META: Record<
    ActivityFeedItem['iconType'],
    { label: string; icon: string; className: string }
> = {
    info: {
        label: 'معلومة',
        icon: 'ℹ️',
        className: 'bg-slate-100 text-slate-700',
    },
    plus: {
        label: 'إنشاء',
        icon: '➕',
        className: 'bg-emerald-50 text-emerald-700',
    },
    play: {
        label: 'بدء',
        icon: '▶️',
        className: 'bg-indigo-50 text-indigo-700',
    },
    check: {
        label: 'إنجاز',
        icon: '✅',
        className: 'bg-green-50 text-green-700',
    },
    edit: {
        label: 'تعديل',
        icon: '✏️',
        className: 'bg-amber-50 text-amber-700',
    },
    calendar: {
        label: 'موعد',
        icon: '📅',
        className: 'bg-violet-50 text-violet-700',
    },
    flag: {
        label: 'أولوية',
        icon: '🚩',
        className: 'bg-rose-50 text-rose-700',
    },
    list: {
        label: 'قائمة',
        icon: '📋',
        className: 'bg-cyan-50 text-cyan-700',
    },
    update: {
        label: 'تحديث',
        icon: '⚡',
        className: 'bg-slate-100 text-slate-700',
    },
};

const FILTERS: Array<'all' | ActivityFeedItem['iconType']> = [
    'all',
    'check',
    'play',
    'plus',
    'edit',
    'calendar',
    'flag',
    'list',
    'update',
];

const TIME_BUCKETS = [
    { key: 'morning', label: 'Morning', from: 5, to: 11, tone: 'blue' as Tone },
    {
        key: 'afternoon',
        label: 'Afternoon',
        from: 12,
        to: 16,
        tone: 'amber' as Tone,
    },
    {
        key: 'evening',
        label: 'Evening',
        from: 17,
        to: 20,
        tone: 'violet' as Tone,
    },
    { key: 'night', label: 'Night', from: 21, to: 23, tone: 'rose' as Tone },
    { key: 'late', label: 'Late Night', from: 0, to: 4, tone: 'slate' as Tone },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cx = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ');

const formatUserLabel = (user: UserItem) => {
    const fullName = [user.name, user.surname].filter(Boolean).join(' ').trim();
    return fullName || user.email || `User #${user.id}`;
};

const formatTime = (value: string) => {
    try {
        return new Intl.DateTimeFormat('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(new Date(value));
    } catch {
        return value;
    }
};

const formatDate = (value: string) => {
    try {
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }).format(new Date(value));
    } catch {
        return value;
    }
};

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const getCurrentMonthRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        start: toInputDate(start),
        end: toInputDate(today),
    };
};

const buildDateRange = (startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    const dates: string[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
        dates.push(toInputDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
};

const openTask = (
    item: ActivityFeedItem & {
        isSubtask?: boolean;
        parentTaskUid?: string | null;
    }
) => {
    const targetUid =
        item.isSubtask && item.parentTaskUid
            ? item.parentTaskUid
            : item.taskUid;
    if (!targetUid) return;
    window.location.assign(`/task/${targetUid}`);
};


const getStatusLabel = (status: TeamSnapshot['status']) => {
    switch (status) {
        case 'healthy':
            return 'Healthy';
        case 'risky':
            return 'Risky';
        case 'overloaded':
            return 'Overloaded';
        case 'idle':
        default:
            return 'Idle';
    }
};

const getStatusTone = (status: TeamSnapshot['status']): Tone => {
    switch (status) {
        case 'healthy':
            return 'emerald';
        case 'risky':
            return 'amber';
        case 'overloaded':
            return 'rose';
        case 'idle':
        default:
            return 'slate';
    }
};

const getStatusBarClass = (status: TeamSnapshot['status']) => {
    switch (status) {
        case 'healthy':
            return 'bg-emerald-400';
        case 'risky':
            return 'bg-amber-400';
        case 'overloaded':
            return 'bg-rose-400';
        case 'idle':
        default:
            return 'bg-slate-300';
    }
};

const getHourBucket = (dateString: string) => {
    const hour = new Date(dateString).getHours();
    return (
        TIME_BUCKETS.find((item) => {
            if (item.key === 'late') return hour >= 0 && hour <= 4;
            return hour >= item.from && hour <= item.to;
        }) || TIME_BUCKETS[0]
    );
};
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const avg = (values: number[]) =>
    values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

const toFixedNumber = (value: number, digits = 0) =>
    Number(value.toFixed(digits));

const buildSparklinePoints = (values: number[], width = 120, height = 42) => {
    if (!values.length) return '';
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(1, max - min);
    return values
        .map((value, index) => {
            const x =
                values.length === 1
                    ? width / 2
                    : (index / (values.length - 1)) * width;
            const y = height - ((value - min) / span) * (height - 4) - 2;
            return `${x},${y}`;
        })
        .join(' ');
};

const formatRatio = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}x`;

const classifyTaskGoal = (
    taskName: string,
    actionText?: string
): StrategicCategory => {
    const textValue = `${taskName} ${actionText || ''}`.toLowerCase();
    if (
        /(plan|planning|roadmap|strategy|strategic|scope|analysis)/i.test(
            textValue
        )
    )
        return 'planning';
    if (/(design|ux|ui|prototype|mockup|brand)/i.test(textValue))
        return 'design';
    if (/(fix|bug|issue|debug|patch|hotfix)/i.test(textValue)) return 'quality';
    if (/(ship|release|deploy|launch|done|complete|close)/i.test(textValue))
        return 'delivery';
    if (/(call|meeting|sync|review|feedback|align)/i.test(textValue))
        return 'collaboration';
    if (/(research|investigate|discover|learn)/i.test(textValue))
        return 'discovery';
    return 'execution';
};

const getComplexityScore = (pulse: TaskPulse) =>
    clamp(
        pulse.totalActions * 12 +
            pulse.edits * 8 +
            pulse.starts * 10 +
            pulse.completed * 15,
        10,
        100
    );

const buildHeatmap = (feed: ActivityFeedItem[]): ResourceCell[] => {
    const counts = Array.from({ length: 24 }, (_, hour) => {
        const filtered = feed.filter(
            (item) => new Date(item.time).getHours() === hour
        );
        const score = clamp(
            filtered.reduce((sum, item) => sum + item.points, 0) +
                filtered.length * 2,
            0,
            100
        );
        return {
            hour,
            label: `${hour.toString().padStart(2, '0')}:00`,
            score,
            count: filtered.length,
        };
    });
    return counts;
};

const scoreToTone = (score: number): Tone =>
    score >= 75
        ? 'emerald'
        : score >= 55
          ? 'blue'
          : score >= 35
            ? 'amber'
            : 'rose';

const buildCreativeSignals = (params: {
    decisionVelocity: number;
    momentum: number;
    ownershipBias: number;
    burnoutScore: number;
    alignmentScore: number;
}): CreativeSignal[] => {
    const {
        decisionVelocity,
        momentum,
        ownershipBias,
        burnoutScore,
        alignmentScore,
    } = params;
    return [
        {
            title: 'Decision Velocity Index',
            body: `${decisionVelocity.toFixed(1)} قرارات/ساعة محسوبة من نمط الحركة والإنهاءات.`,
            tone: scoreToTone(clamp(decisionVelocity * 10, 0, 100)),
            accent: 'blue',
        },
        {
            title: 'Momentum Oscillator',
            body: `${momentum >= 0 ? 'صعود' : 'هبوط'} في الزخم التشغيلي بمؤشر ${momentum.toFixed(1)}%.`,
            tone: momentum >= 0 ? 'emerald' : 'rose',
            accent: momentum >= 0 ? 'emerald' : 'rose',
        },
        {
            title: 'Ownership Bias',
            body: `${ownershipBias.toFixed(0)}% من النشاط يميل للإنشاء مقابل التنفيذ المباشر.`,
            tone: ownershipBias >= 50 ? 'violet' : 'slate',
            accent: 'violet',
        },
        {
            title: 'Risk Radar',
            body:
                burnoutScore >= 70
                    ? 'إشارة ضغط مرتفع تستدعي إعادة توزيع الحمل.'
                    : 'التحميل الحالي يبدو تحت السيطرة.',
            tone: burnoutScore >= 70 ? 'rose' : 'emerald',
            accent: burnoutScore >= 70 ? 'rose' : 'emerald',
        },
        {
            title: 'Narrative Fit',
            body: `ملاءمة السلوك مع أهداف المؤسسة عند ${alignmentScore}% مع توصيات تكتيكية فورية.`,
            tone: scoreToTone(alignmentScore),
            accent: 'amber',
        },
    ];
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const StatCard = ({
    title,
    value,
    hint,
    accent,
    trend,
    onClick,
    icon,
}: {
    title: string;
    value: React.ReactNode;
    hint?: string;
    accent: 'slate' | 'emerald' | 'blue' | 'violet' | 'amber' | 'rose';
    trend?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
}) => {
    const accentClasses: Record<typeof accent, string> = {
        slate: 'from-slate-50 via-white to-slate-100/70 border-slate-200',
        emerald:
            'from-emerald-50 via-white to-emerald-100/70 border-emerald-200',
        blue: 'from-blue-50 via-white to-blue-100/70 border-blue-200',
        violet: 'from-violet-50 via-white to-violet-100/70 border-violet-200',
        amber: 'from-amber-50 via-white to-amber-100/70 border-amber-200',
        rose: 'from-rose-50 via-white to-rose-100/70 border-rose-200',
    };
    const pillClasses: Record<typeof accent, string> = {
        slate: 'bg-slate-900 text-white',
        emerald: 'bg-emerald-600 text-white',
        blue: 'bg-blue-600 text-white',
        violet: 'bg-violet-600 text-white',
        amber: 'bg-amber-500 text-white',
        rose: 'bg-rose-600 text-white',
    };
    const barClasses: Record<typeof accent, string> = {
        slate: 'bg-slate-900',
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
        violet: 'bg-violet-500',
        amber: 'bg-amber-500',
        rose: 'bg-rose-500',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                'group relative w-full text-left outline-none transition duration-300',
                onClick
                    ? 'hover:-translate-y-1 focus-visible:-translate-y-1'
                    : 'cursor-default'
            )}
        >
            <div
                className={cx(
                    'relative overflow-hidden rounded-[34px] border p-[1px] shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300',
                    accentClasses[accent]
                )}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.45),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_28%)]" />
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/50 blur-3xl dark:bg-white/10" />
                <div className="absolute -bottom-14 left-0 h-28 w-28 rounded-full bg-white/35 blur-3xl dark:bg-white/8" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/15" />

                <div className="relative rounded-[33px] border border-white/70 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
                    <div className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {title}
                                </div>

                                <div className="mt-4 flex items-end gap-3">
                                    <div className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                                        {value}
                                    </div>

                                    {trend && (
                                        <span
                                            className={cx(
                                                'mb-1 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-white/70 dark:ring-white/10',
                                                pillClasses[accent]
                                            )}
                                        >
                                            {trend}
                                        </span>
                                    )}
                                </div>

                                {hint && (
                                    <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        {hint}
                                    </p>
                                )}
                            </div>

                            <div
                                className={cx(
                                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border text-lg shadow-sm ring-1 ring-white/70 backdrop-blur-xl transition duration-300 group-hover:scale-105',
                                    pillClasses[accent]
                                )}
                            >
                                {icon || '✦'}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Performance signal
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Enterprise
                                </span>
                            </div>

                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                    className={cx(
                                        'h-full rounded-full transition-all duration-500',
                                        barClasses[accent]
                                    )}
                                    style={{ width: onClick ? '82%' : '68%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
};

const ActivityRow = ({ item }: { item: ActivityFeedItem }) => {
    const meta = ICON_META[item.iconType] || ICON_META.info;
    const clickable = Boolean(item.taskUid);

    return (
        <button
            type="button"
            onClick={() => openTask(item)}
            disabled={!clickable}
            className={cx(
                'group relative w-full overflow-hidden rounded-[30px] border text-left transition-all duration-300',
                clickable
                    ? `
                    border-slate-200/70
                    bg-white/85
                    shadow-[0_10px_40px_rgba(15,23,42,0.08)]
                    hover:-translate-y-1
                    hover:border-blue-300/60
                    hover:shadow-[0_20px_60px_rgba(59,130,246,0.15)]

                    dark:border-white/10
                    dark:bg-slate-900/70
                    dark:hover:border-blue-500/30
                    dark:hover:shadow-[0_20px_60px_rgba(37,99,235,0.18)]
                `
                    : `
                    cursor-default
                    border-slate-200/60
                    bg-slate-50/80

                    dark:border-white/10
                    dark:bg-slate-900/50
                `
            )}
        >
            {/* Accent Strip */}
            <div className="absolute inset-y-0 left-0 w-[4px] bg-gradient-to-b from-blue-500 via-violet-500 to-emerald-500" />

            {/* Glow */}
            <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />
            </div>

            {/* Shine */}
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-0 transition duration-700 group-hover:translate-x-full group-hover:opacity-100 dark:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.06),transparent)]" />

            <div className="relative p-5">
                <div className="flex gap-4">
                    {/* Icon */}
                    <div
                        className={cx(
                            `
                            flex h-14 w-14 shrink-0 items-center justify-center
                            rounded-[20px]
                            shadow-lg
                            ring-1
                            ring-black/5
                            backdrop-blur-xl

                            dark:ring-white/10
                            `,
                            meta.className
                        )}
                    >
                        <span className="text-xl">{meta.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                                {/* Header */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="truncate text-base font-black text-slate-900 dark:text-white sm:text-lg">
                                        {item.actionText}
                                    </h4>

                                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                        {meta.label}
                                    </span>

                                    {item.isSubtask && (
                                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                                            Subtask
                                        </span>
                                    )}

                                    {clickable && (
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 opacity-0 transition-all duration-300 group-hover:opacity-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                                            Open Task →
                                        </span>
                                    )}
                                </div>

                                {/* Task Name */}
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Task:
                                    </span>

                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {item.taskName}
                                    </span>

                                    {item.parentTaskUid && (
                                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                            Parent Linked
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right Side */}
                            <div className="shrink-0">
                                <div className="rounded-[18px] border border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="text-right">
                                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                            +{item.points}
                                        </div>

                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                            Points
                                        </div>

                                        <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                                            {formatTime(item.time)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
};

const InsightCard = ({
    title,
    body,
    tone = 'slate',
}: {
    title: string;
    body: string;
    tone?: Tone;
}) => {
    const tones: Record<Tone, string> = {
        slate:
            'from-slate-50 to-slate-100 border-slate-200 text-slate-800 dark:from-slate-900/90 dark:to-slate-800 dark:border-slate-700 dark:text-slate-100',
        emerald:
            'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900 dark:from-emerald-950/40 dark:to-emerald-900/50 dark:border-emerald-500/20 dark:text-emerald-100',
        blue:
            'from-blue-50 to-blue-100 border-blue-200 text-blue-900 dark:from-blue-950/40 dark:to-blue-900/50 dark:border-blue-500/20 dark:text-blue-100',
        amber:
            'from-amber-50 to-amber-100 border-amber-200 text-amber-950 dark:from-amber-950/40 dark:to-amber-900/50 dark:border-amber-500/20 dark:text-amber-100',
        rose:
            'from-rose-50 to-rose-100 border-rose-200 text-rose-900 dark:from-rose-950/40 dark:to-rose-900/50 dark:border-rose-500/20 dark:text-rose-100',
        violet:
            'from-violet-50 to-violet-100 border-violet-200 text-violet-900 dark:from-violet-950/40 dark:to-violet-900/50 dark:border-violet-500/20 dark:text-violet-100',
    };
    return (
        <div
            className={cx(
                'relative overflow-hidden rounded-[28px] border bg-gradient-to-br p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ring-1 ring-white/60',
                tones[tone]
            )}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.55),_transparent_34%)]" />
            <div className="relative flex gap-3">
                <div
                    className={cx(
                        'mt-1 h-9 w-1 rounded-full',
                        tone === 'emerald'
                            ? 'bg-emerald-500'
                            : tone === 'blue'
                              ? 'bg-blue-500'
                              : tone === 'amber'
                                ? 'bg-amber-500'
                                : tone === 'rose'
                                  ? 'bg-rose-500'
                                  : tone === 'violet'
                                    ? 'bg-violet-500'
                                    : 'bg-slate-400'
                    )}
                />
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-black tracking-tight">
                        {title}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700/90">
                        {body}
                    </div>
                </div>
            </div>
        </div>
    );
};

type TeamRankingRow = {
    snapshot: TeamSnapshot;
    rank: number;
    onSelect: () => void;
    active: boolean;
};

const TeamRankRow = ({ snapshot, rank, onSelect, active }: TeamRankingRow) => {
    const barWidth = clamp(snapshot.productivityScore, 0, 100);
    const statusTone = getStatusTone(snapshot.status);
    const statusBarClass = getStatusBarClass(snapshot.status);

    const accentClasses: Record<Tone, string> = {
        slate: 'from-slate-50 to-slate-100 border-slate-200',
        emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
        blue: 'from-blue-50 to-blue-100 border-blue-200',
        amber: 'from-amber-50 to-amber-100 border-amber-200',
        rose: 'from-rose-50 to-rose-100 border-rose-200',
        violet: 'from-violet-50 to-violet-100 border-violet-200',
    };

    const ringTone: Record<Tone, string> = {
        slate: 'bg-slate-900 text-white',
        emerald: 'bg-emerald-600 text-white',
        blue: 'bg-blue-600 text-white',
        amber: 'bg-amber-500 text-white',
        rose: 'bg-rose-600 text-white',
        violet: 'bg-violet-600 text-white',
    };

    const medal =
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '•';

    return (
        <button
            type="button"
            onClick={onSelect}
            className={cx(
                'group relative w-full overflow-hidden rounded-[32px] border p-4 text-left transition-all duration-300 outline-none',
                'ring-1 ring-black/5 dark:ring-white/10',
                active
                    ? 'border-slate-900/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_28px_90px_rgba(2,6,23,0.55)] dark:border-white/10'
                    : `${accentClasses[statusTone]} bg-gradient-to-br from-white via-slate-50 to-slate-100/80 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.16)] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)]`,
                'focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950'
            )}
        >
            <div
                className={cx(
                    'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    active
                        ? 'bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_30%)]'
                        : 'bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.85),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.08),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.06),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.08),_transparent_28%)]'
                )}
            />

            <div className="relative flex items-center gap-4">
                <div
                    className={cx(
                        'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-sm ring-1 transition-transform duration-300 group-hover:scale-105',
                        active
                            ? 'bg-white/10 text-white ring-white/10'
                            : `${ringTone[statusTone]} ring-white/60 dark:ring-white/10`
                    )}
                >
                    <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
                    <span className="relative">{medal}</span>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div
                                className={cx(
                                    'truncate text-base font-black tracking-tight sm:text-[17px]',
                                    active
                                        ? 'text-white'
                                        : 'text-slate-950 dark:text-white'
                                )}
                            >
                                {formatUserLabel(snapshot.user)}
                            </div>

                            <div
                                className={cx(
                                    'mt-1 text-xs leading-5',
                                    active
                                        ? 'text-slate-300'
                                        : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                {snapshot.totalActions} actions · KPI{' '}
                                {snapshot.productivityScore} ·{' '}
                                {Math.round(snapshot.executionRate)}% exec ·{' '}
                                {formatRatio(snapshot.averagePoints || 0)} avg
                            </div>
                        </div>

                        <span
                            className={cx(
                                'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm backdrop-blur',
                                active
                                    ? 'bg-white/10 text-white ring-1 ring-white/10'
                                    : statusTone === 'emerald'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                      : statusTone === 'amber'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                        : statusTone === 'rose'
                                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                          : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
                            )}
                        >
                            {getStatusLabel(snapshot.status)}
                        </span>
                    </div>

                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <div
                            className={cx(
                                'h-full rounded-full transition-all duration-500',
                                active ? 'bg-white' : statusBarClass
                            )}
                            style={{ width: `${barWidth}%` }}
                        />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span
                            className={cx(
                                'text-[11px] font-semibold uppercase tracking-[0.22em]',
                                active
                                    ? 'text-white/50'
                                    : 'text-slate-400 dark:text-slate-500'
                            )}
                        >
                            performance level
                        </span>

                        <span
                            className={cx(
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                active
                                    ? 'bg-white/10 text-white'
                                    : 'bg-slate-950/5 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                            )}
                        >
                            {snapshot.status === 'healthy'
                                ? 'Stable'
                                : snapshot.status === 'risky'
                                  ? 'Needs attention'
                                  : snapshot.status === 'overloaded'
                                    ? 'Overloaded'
                                    : 'Idle'}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
};

const SectionTitle = ({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                Strategic View
            </div>
            <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {title}
            </h3>
            {subtitle && (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    {subtitle}
                </p>
            )}
        </div>
        {action}
    </div>
);

const Sparkline = ({
    values,
    tone = 'blue',
}: {
    values: number[];
    tone?: Tone;
}) => {
    const tones: Record<Tone, string> = {
        slate: 'text-slate-500',
        emerald: 'text-emerald-600',
        blue: 'text-blue-600',
        amber: 'text-amber-600',
        rose: 'text-rose-600',
        violet: 'text-violet-600',
    };
    return (
        <svg viewBox="0 0 120 42" className={`h-10 w-full ${tones[tone]}`}>
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={buildSparklinePoints(values)}
            />
        </svg>
    );
};

const RadialMeter = ({
    value,
    label,
    tone = 'blue',
}: {
    value: number;
    label: string;
    tone?: Tone;
}) => {
    const colors: Record<Tone, string> = {
        slate: 'stroke-slate-400',
        emerald: 'stroke-emerald-500',
        blue: 'stroke-blue-500',
        amber: 'stroke-amber-500',
        rose: 'stroke-rose-500',
        violet: 'stroke-violet-500',
    };
    const normalized = clamp(value, 0, 100);
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const dash = circumference - (normalized / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/75 backdrop-blur-xl p-4 shadow-sm">
            <div className="relative h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="stroke-slate-100"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={dash}
                        strokeLinecap="round"
                        className={colors[tone]}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-2xl font-black text-slate-950">
                        {normalized}%
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        {label}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HeatmapMatrix = ({ cells }: { cells: ResourceCell[] }) => {
    const gridTone: Record<Tone, string> = {
        slate: 'bg-slate-200',
        emerald: 'bg-emerald-400',
        blue: 'bg-blue-400',
        amber: 'bg-amber-400',
        rose: 'bg-rose-400',
        violet: 'bg-violet-400',
    };
    return (
        <div className="grid grid-cols-6 gap-2">
            {cells.map((cell) => {
                const tone = scoreToTone(cell.score);
                return (
                    <div
                        key={cell.hour}
                        title={`${cell.label} • ${cell.count} actions`}
                        className={`flex h-10 flex-col items-center justify-center rounded-2xl border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:text-slate-100 ${gridTone[tone]}`}
                        style={{ opacity: 0.25 + cell.score / 120 }}
                    >
                        <span>{cell.hour.toString().padStart(2, '0')}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ✅ Mini Calendar للعادات
const MiniCalendar = ({
    completionDates,
    period,
}: {
    completionDates: string[];
    period: number;
}) => {
    const days = Array.from({ length: period }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (period - 1 - i));
        return d.toISOString().split('T')[0];
    });

    const completionSet = new Set(completionDates);

    return (
        <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    Consistency Timeline
                </span>

                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    <span>Low</span>

                    <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="h-2 w-2 rounded-full bg-emerald-300 dark:bg-emerald-800" />
                        <div className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-600" />
                    </div>

                    <span>High</span>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {days.map((day) => {
                    const completed = completionSet.has(day);

                    return (
                        <div
                            key={day}
                            title={day}
                            className={`
                                group relative aspect-square rounded-xl
                                transition-all duration-300
                                ${
                                    completed
                                        ? `
                                            border border-emerald-300/60
                                            bg-gradient-to-br
                                            from-emerald-300
                                            via-emerald-400
                                            to-emerald-500
                                            shadow-[0_6px_20px_rgba(16,185,129,0.35)]
                                            dark:border-emerald-500/20
                                        `
                                        : `
                                            border border-slate-200
                                            bg-slate-100
                                            dark:border-slate-700
                                            dark:bg-slate-800
                                        `
                                }
                                hover:scale-110
                                hover:-translate-y-0.5
                            `}
                        >
                            {completed && (
                                <>
                                    <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                                    <div className="absolute inset-x-1 top-1 h-px bg-white/60" />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ✅ كارت العادة الواحدة

const HabitCard = ({ habit, period, onOpen }: { habit: HabitStat; period: number; onOpen?: () => void }) => {
    const recurrenceMeta: Record<string, { label: string; className: string }> =
        {
            daily: { label: 'يومي', className: 'bg-blue-50 text-blue-700' },
            weekly: {
                label: 'أسبوعي',
                className: 'bg-violet-50 text-violet-700',
            },
            monthly: { label: 'شهري', className: 'bg-amber-50 text-amber-700' },
        };
    const badge = recurrenceMeta[habit.recurrence_type] || {
        label: habit.recurrence_type,
        className: 'bg-slate-100 text-slate-700',
    };

    const rate = habit.stats.completionRate;
    const rateBarColor =
        rate === null
            ? 'bg-slate-200'
            : rate >= 70
              ? 'bg-emerald-500'
              : rate >= 40
                ? 'bg-amber-500'
                : 'bg-rose-500';

    const streakEmoji =
        habit.habit_current_streak >= 7
            ? '🔥'
            : habit.habit_current_streak >= 3
              ? '✨'
              : habit.habit_current_streak > 0
                ? '⚡'
                : '💤';

    const coverage = clamp(
        Math.round((habit.stats.periodCompletions / Math.max(1, period)) * 100),
        0,
        100
    );

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group relative w-full overflow-hidden rounded-[30px] border border-white/10 bg-white/80 p-5 text-left shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.75),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.06),_transparent_28%)] opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-black text-slate-950 dark:text-white">
                            {habit.name}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span
                                className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                            >
                                {badge.label}
                            </span>
                            <span className="rounded-full bg-slate-950/5 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                {coverage}% coverage
                            </span>
                        </div>
                    </div>
                    <div className="shrink-0 rounded-2xl bg-slate-950 px-3 py-2 text-center text-white shadow-lg">
                        <div className="text-xl">{streakEmoji}</div>
                        <div className="text-lg font-black leading-none">
                            {habit.habit_current_streak}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-white/70 dark:text-slate-600">
                            streak
                        </div>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                        { v: habit.habit_current_streak, l: 'Current' },
                        { v: habit.habit_best_streak, l: 'Best' },
                        { v: habit.stats.periodCompletions, l: 'Done' },
                    ].map((s) => (
                        <div
                            key={s.l}
                            className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"
                        >
                            <div className="text-lg font-black text-slate-950 dark:text-white">
                                {s.v}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {s.l}
                            </div>
                        </div>
                    ))}
                </div>

                {rate !== null && (
                    <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-500">
                                Completion rate
                            </span>
                            <span className="font-black text-slate-700">
                                {rate}%
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                            <div
                                className={`h-full rounded-full transition-all ${rateBarColor}`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 p-3">
                    <MiniCalendar
                        completionDates={habit.stats.completionDates}
                        period={period}
                    />
                </div>

                {habit.habit_last_completion_at && (
                    <div className="mt-3 text-xs text-slate-400">
                        آخر إنجاز:{' '}
                        {new Date(
                            habit.habit_last_completion_at
                        ).toLocaleDateString('ar-EG')}
                    </div>
                )}
            </div>
        </button>
    );
};



const HabitDrawer = ({
    habit,
    period,
    onClose,
    onOpenTask,
}: {
    habit: HabitStat | null;
    period: number;
    onClose: () => void;
    onOpenTask?: (habit: HabitStat) => void;
}) => {
    if (!habit) return null;

    const completionDates = habit.stats.completionDates || [];
    const completionSet = new Set(completionDates);
    const periodDays = Array.from({ length: period }, (_, index) => {
        const d = new Date();
        d.setDate(d.getDate() - (period - 1 - index));
        return toInputDate(d);
    });
    const consistencyScore = clamp(
        Math.round((completionDates.length / Math.max(1, period)) * 100),
        0,
        100
    );
    const completionRate = habit.stats.completionRate ?? consistencyScore;
    const missedDays = Math.max(0, period - completionDates.length);
    const totalCompletions = habit.habit_total_completions;

    const weekdayLabels = [
        'الأحد',
        'الاثنين',
        'الثلاثاء',
        'الأربعاء',
        'الخميس',
        'الجمعة',
        'السبت',
    ];
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    completionDates.forEach((date) => {
        const day = new Date(date).getDay();
        weekdayCounts[day] += 1;
    });
    const topWeekdayIndex = weekdayCounts.indexOf(
        Math.max(...weekdayCounts, 0)
    );
    const topWeekdayLabel = weekdayLabels[topWeekdayIndex] || '—';

    const halfPoint = Math.ceil(periodDays.length / 2);
    const firstHalfCompletions = periodDays
        .slice(0, halfPoint)
        .filter((day) => completionSet.has(day)).length;
    const secondHalfCompletions = periodDays
        .slice(halfPoint)
        .filter((day) => completionSet.has(day)).length;
    const momentumBase = Math.max(1, firstHalfCompletions + secondHalfCompletions);
    const momentum = Math.round(
        ((secondHalfCompletions - firstHalfCompletions) / momentumBase) * 100
    );

    const archetype = (() => {
        if (consistencyScore >= 90 && habit.habit_current_streak >= 7) {
            return {
                title: 'Elite Discipline',
                body: 'ثبات استثنائي يدل على التزام تشغيلي عالي.',
                tone: 'emerald' as Tone,
            };
        }
        if (completionRate >= 70 && habit.habit_current_streak >= 3) {
            return {
                title: 'Consistent Performer',
                body: 'أداء مستقر وإيقاع عمل منظم.',
                tone: 'blue' as Tone,
            };
        }
        if (completionRate >= 40) {
            return {
                title: 'Recovering Rhythm',
                body: 'هناك تقدم، لكن الاستمرارية ما زالت تحتاج تثبيت.',
                tone: 'amber' as Tone,
            };
        }
        return {
            title: 'Needs Support',
            body: 'التزام ضعيف أو متقطع، ويستحق تدخلًا مبكرًا.',
            tone: 'rose' as Tone,
        };
    })();

    const sectionChipClass =
        archetype.tone === 'emerald'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : archetype.tone === 'blue'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : archetype.tone === 'amber'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';

    return (
        <div className="fixed inset-0 z-50">
            <button
                type="button"
                aria-label="Close habit details"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px] transition hover:bg-slate-950/65 dark:bg-slate-950/75"
            />
            <aside
                className="absolute inset-y-0 right-0 z-10 flex h-full w-full max-w-[44rem] flex-col border-l border-slate-200 bg-white shadow-[0_30px_120px_rgba(2,6,23,0.35)] dark:border-slate-800 dark:bg-slate-950 sm:rounded-l-[36px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_26%)]" />
                <div className="relative flex h-full flex-col">
                    <div className="border-b border-slate-200 bg-white/75 p-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                    Habit Intelligence
                                </div>
                                <h3 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                                    {habit.name}
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                                    تحليل السلوك والالتزام الزمني عبر الفترة المختارة.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                إغلاق
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                                {habit.recurrence_type}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sectionChipClass}`}>
                                {archetype.title}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                {period} day period
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Current streak
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {habit.habit_current_streak}
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Best streak
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {habit.habit_best_streak}
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Completion rate
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {completionRate}%
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Missed days
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {missedDays}
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Total completions
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {totalCompletions}
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Consistency score
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                    {consistencyScore}%
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle
                                    title="Consistency heatmap"
                                    subtitle="بصمة الالتزام على مدار الفترة المحددة"
                                />
                                <div className="mt-4 rounded-[24px] bg-slate-50 p-4 dark:bg-slate-950">
                                    <MiniCalendar
                                        completionDates={completionDates}
                                        period={period}
                                    />
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                        <div className="text-xs text-slate-400 dark:text-slate-500">
                                            Latest completion
                                        </div>
                                        <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                            {habit.habit_last_completion_at
                                                ? formatDate(habit.habit_last_completion_at)
                                                : '—'}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                        <div className="text-xs text-slate-400 dark:text-slate-500">
                                            Coverage
                                        </div>
                                        <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                            {Math.round(
                                                (completionDates.length /
                                                    Math.max(1, period)) *
                                                    100
                                            )}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle
                                    title="Performance profile"
                                    subtitle="قراءة تنفيذية سريعة لسلوك العادة"
                                />
                                <div className={`mt-4 rounded-[24px] border px-4 py-4 ${sectionChipClass}`}>
                                    <div className="text-sm font-black">
                                        {archetype.title}
                                    </div>
                                    <div className="mt-1 text-sm leading-7 opacity-90">
                                        {archetype.body}
                                    </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {weekdayLabels.map((label, index) => {
                                        const maxCount = Math.max(
                                            ...weekdayCounts,
                                            1
                                        );
                                        const width = Math.round(
                                            (weekdayCounts[index] / maxCount) * 100
                                        );
                                        const active = weekdayCounts[index] > 0;
                                        return (
                                            <div key={label} className="flex items-center gap-3">
                                                <div className="w-20 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    {label}
                                                </div>
                                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            active
                                                                ? 'bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500'
                                                                : 'bg-slate-300 dark:bg-slate-700'
                                                        }`}
                                                        style={{ width: `${width}%` }}
                                                    />
                                                </div>
                                                <div className="w-8 text-right text-xs font-black text-slate-700 dark:text-slate-300">
                                                    {weekdayCounts[index]}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 rounded-[24px] bg-slate-50 p-4 dark:bg-slate-950">
                                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                        Momentum
                                    </div>
                                    <div className={`mt-2 text-2xl font-black ${momentum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {momentum >= 0 ? '+' : ''}{momentum}%
                                    </div>
                                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        مقارنة النصف الأخير من الفترة بالنصف الأول.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                            <SectionTitle
                                title="Executive notes"
                                subtitle="إشارات إدارية مختصرة تساعدك على القرار"
                            />
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <InsightCard
                                    title="Best weekday"
                                    body={`أقوى يوم التزام هو ${topWeekdayLabel}.`}
                                    tone={archetype.tone}
                                />
                                <InsightCard
                                    title="Risk check"
                                    body={
                                        missedDays >= Math.max(3, Math.ceil(period * 0.3))
                                            ? 'العادة تحتاج متابعة لأن الانقطاع بدأ يتكرر.'
                                            : 'المؤشرات مستقرة نسبيًا، مع حاجة للحفاظ على الإيقاع.'
                                    }
                                    tone={
                                        missedDays >= Math.max(3, Math.ceil(period * 0.3))
                                            ? 'rose'
                                            : 'emerald'
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                يمكنك فتح التاسك المرتبط بهذه العادة، أو إغلاق اللوحة لمواصلة متابعة الفريق.
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenTask?.(habit)}
                                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                >
                                    Open related task
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Close panel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const UserActivityDashboard: React.FC = () => {
    // ── Activity state ─────────────────────────────────────────────────────────
    const [userId, setUserId] = useState<number>(0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activityData, setActivityData] =
        useState<DailyActivityResponse | null>(null);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [filter, setFilter] = useState<'all' | ActivityFeedItem['iconType']>(
        'all'
    );

    const [searchTerm, setSearchTerm] = useState('');
    const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

    const defaultPeriodRange = useMemo(() => getCurrentMonthRange(), []);
    const [periodStart, setPeriodStart] = useState(defaultPeriodRange.start);
    const [periodEnd, setPeriodEnd] = useState(defaultPeriodRange.end);
    const [periodResponses, setPeriodResponses] = useState<
        DailyActivityResponse[]
    >([]);
    const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);

    // ── Habits state ───────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'activity' | 'habits'>(
        'activity'
    );
    const [habitPeriod, setHabitPeriod] = useState<7 | 30 | 90>(30);
    const [habitsData, setHabitsData] = useState<HabitStat[]>([]);
    const [isLoadingHabits, setIsLoadingHabits] = useState(false);
    const [habitSearchTerm, setHabitSearchTerm] = useState('');

    const [habitSortBy, setHabitSortBy] = useState<'streak' | 'rate' | 'name'>(
        'streak'
    );
    const [selectedHabit, setSelectedHabit] = useState<HabitStat | null>(null);

    const [teamSnapshots, setTeamSnapshots] = useState<TeamSnapshot[]>([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);

    const [thresholds, setThresholds] = useState<StrategicThresholds>({
        targetScore: 75,
        burnoutEditLimit: 8,
        focusMinHours: 2,
        concentrationMax: 55,
        roiMultiplier: 2.4,
    });

    // ── Fetch users ────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        setError(null);
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = (await res.json()) as UserItem[];
            setUsers(data || []);
            if (data && data.length > 0) {
                setUserId((current) => current || data[0].id);
            }
        } catch {
            setError('تعذر تحميل قائمة الموظفين');
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);

    // ── Fetch activity ─────────────────────────────────────────────────────────
    const fetchActivity = useCallback(async () => {
        if (!userId || !date) return;
        setIsLoadingActivity(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/admin/users/${userId}/daily-activity?date=${encodeURIComponent(date)}`
            );
            if (!res.ok) throw new Error('Failed to fetch activity');
            const data = (await res.json()) as DailyActivityResponse;
            setActivityData(data);
        } catch {
            setError('تعذر تحميل نشاط الموظف اليومي');
            setActivityData(null);
        } finally {
            setIsLoadingActivity(false);
        }
    }, [date, userId]);

    const fetchPeriodAnalytics = useCallback(async () => {
        if (!userId || !periodStart || !periodEnd) return;
        setIsLoadingPeriod(true);
        try {
            const dates = buildDateRange(periodStart, periodEnd).slice(0, 92);
            const responses = await Promise.allSettled(
                dates.map(async (day) => {
                    const res = await fetch(
                        `/api/admin/users/${userId}/daily-activity?date=${encodeURIComponent(day)}`
                    );
                    if (!res.ok) return null;
                    return (await res.json()) as DailyActivityResponse;
                })
            );

            const filtered = responses
                .map((result) =>
                    result.status === 'fulfilled' ? result.value : null
                )
                .filter(Boolean) as DailyActivityResponse[];

            setPeriodResponses(filtered);
        } catch {
            setPeriodResponses([]);
        } finally {
            setIsLoadingPeriod(false);
        }
    }, [periodEnd, periodStart, userId]);

    // ── Fetch habits ───────────────────────────────────────────────────────────
    const fetchHabits = useCallback(async () => {
        if (!userId) return;
        setIsLoadingHabits(true);
        try {
            const res = await fetch(
                `/api/admin/users/${userId}/habits?period=${habitPeriod}`
            );
            if (!res.ok) throw new Error('Failed to fetch habits');
            const data = (await res.json()) as HabitStat[];
            setHabitsData(data || []);
        } catch (err) {
            console.error('Error fetching habits:', err);
            setHabitsData([]);
        } finally {
            setIsLoadingHabits(false);
        }
    }, [userId, habitPeriod]);

    const fetchTeamSnapshots = useCallback(async () => {
        if (!users.length || !date) {
            setTeamSnapshots([]);
            return;
        }
        setIsLoadingTeam(true);
        try {
            const results = await Promise.all(
                users.map(async (user) => {
                    try {
                        const res = await fetch(
                            `/api/admin/users/${user.id}/daily-activity?date=${encodeURIComponent(date)}`
                        );
                        if (!res.ok) return null;
                        const data =
                            (await res.json()) as DailyActivityResponse;
                        const feed = data.feed || [];
                        const totalActions = data.summary?.totalActions ?? 0;
                        const productivityScore =
                            data.summary?.productivityScore ?? 0;
                        const completedCount = feed.filter(
                            (item) => item.iconType === 'check'
                        ).length;
                        const executionRate =
                            totalActions > 0
                                ? (completedCount / totalActions) * 100
                                : 0;
                        const averagePoints =
                            totalActions > 0
                                ? productivityScore / totalActions
                                : 0;
                        const activeCount = feed.length;
                        const switchCount = feed.reduce(
                            (sum, item, index, array) => {
                                if (index === 0) return 0;
                                const prev = array[index - 1];
                                const prevKey = prev.taskUid || prev.taskName;
                                const curKey = item.taskUid || item.taskName;
                                return sum + (prevKey !== curKey ? 1 : 0);
                            },
                            0
                        );
                        const edits = feed.filter(
                            (item) => item.iconType === 'edit'
                        ).length;
                        const status: TeamSnapshot['status'] =
                            totalActions === 0
                                ? 'idle'
                                : executionRate >= 65 && switchCount <= 4
                                  ? 'healthy'
                                  : switchCount >= 8 ||
                                      edits / Math.max(1, completedCount) >=
                                          1.25
                                    ? 'overloaded'
                                    : 'risky';
                        return {
                            user,
                            totalActions,
                            productivityScore,
                            executionRate,
                            averagePoints,
                            activeCount,
                            status,
                        } satisfies TeamSnapshot;
                    } catch {
                        return null;
                    }
                })
            );
            setTeamSnapshots(
                results
                    .filter((item): item is TeamSnapshot => Boolean(item))
                    .sort((a, b) => b.productivityScore - a.productivityScore)
            );
        } catch (error) {
            console.error('Error fetching team snapshots:', error);
            setTeamSnapshots([]);
        } finally {
            setIsLoadingTeam(false);
        }
    }, [date, users]);

    // ── Effects ────────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (userId && activeTab === 'activity') fetchActivity();
    }, [fetchActivity, userId, date, activeTab]);

    useEffect(() => {
        if (userId) fetchPeriodAnalytics();
    }, [fetchPeriodAnalytics, userId, periodStart, periodEnd]);

    useEffect(() => {
        if (userId && activeTab === 'habits') fetchHabits();
    }, [fetchHabits, userId, habitPeriod, activeTab]);

    useEffect(() => {
        if (users.length > 0) void fetchTeamSnapshots();
    }, [fetchTeamSnapshots, users]);

    // ── Activity computations ──────────────────────────────────────────────────
    const visibleFeed = useMemo(() => {
        const feed = activityData?.feed || [];
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return feed.filter((item) => {
            const matchesFilter =
                filter === 'all' ? true : item.iconType === filter;
            const matchesSearch = normalizedSearch
                ? [item.actionText, item.taskName, item.taskUid || '']
                      .join(' ')
                      .toLowerCase()
                      .includes(normalizedSearch)
                : true;
            return matchesFilter && matchesSearch;
        });
    }, [activityData?.feed, filter, searchTerm]);

    const selectedUser = users.find((u) => u.id === userId) || null;
    const totalActions = activityData?.summary?.totalActions ?? 0;
    const productivityScore = activityData?.summary?.productivityScore ?? 0;
    const averagePoints =
        totalActions > 0
            ? (productivityScore / totalActions).toFixed(1)
            : '0.0';

    const completedCount =
        activityData?.feed?.filter((i) => i.iconType === 'check').length ?? 0;
    const startedCount =
        activityData?.feed?.filter((i) => i.iconType === 'play').length ?? 0;
    const createdCount =
        activityData?.feed?.filter((i) => i.iconType === 'plus').length ?? 0;
    const editedCount =
        activityData?.feed?.filter((i) => i.iconType === 'edit').length ?? 0;
    const subtasksCount =
        activityData?.feed?.filter((i) => i.iconType === 'list').length ?? 0;
    const dueCount =
        activityData?.feed?.filter((i) => i.iconType === 'calendar').length ??
        0;
    const priorityCount =
        activityData?.feed?.filter((i) => i.iconType === 'flag').length ?? 0;

    const executionRate =
        totalActions > 0
            ? Math.round((completedCount / totalActions) * 100)
            : 0;
    const activityDensity =
        totalActions >= 10 ? 'High' : totalActions >= 5 ? 'Medium' : 'Low';
    const riskLevel =
        completedCount === 0 && totalActions > 0
            ? 'Needs follow-up'
            : completedCount < startedCount
              ? 'At risk'
              : 'Healthy';

    const chronologicalFeed = useMemo(
        () =>
            [...(activityData?.feed || [])].sort(
                (a, b) =>
                    new Date(a.time).getTime() - new Date(b.time).getTime()
            ),
        [activityData?.feed]
    );

    const latestTask = activityData?.feed?.find((i) => i.taskUid);

    const actionCounts = useMemo(
        () =>
            (activityData?.feed || []).reduce<Record<string, number>>(
                (acc, item) => {
                    acc[item.iconType] = (acc[item.iconType] || 0) + 1;
                    return acc;
                },
                {}
            ),
        [activityData?.feed]
    );

    const dominantAction = Object.entries(actionCounts).sort(
        (a, b) => Number(b[1]) - Number(a[1])
    )[0]?.[0] as ActivityFeedItem['iconType'] | undefined;
    const dominantActionLabel = dominantAction
        ? ICON_META[dominantAction].label
        : 'لا يوجد';
    const dominantActionIcon = dominantAction
        ? ICON_META[dominantAction].icon
        : '—';

    const taskPulses = useMemo<TaskPulse[]>(() => {
        const map = new Map<string, TaskPulse>();
        for (const item of activityData?.feed || []) {
            if (!item.taskUid) continue;
            const current = map.get(item.taskUid) || {
                taskUid: item.taskUid,
                taskName: item.taskName,
                totalActions: 0,
                totalPoints: 0,
                completed: 0,
                edits: 0,
                starts: 0,
                lastAction: item.time,
                isSubtask: item.isSubtask,
                parentTaskUid: item.parentTaskUid,
            };
            current.totalActions += 1;
            current.totalPoints += item.points;
            current.lastAction = item.time;
            current.isSubtask = current.isSubtask || item.isSubtask;
            current.parentTaskUid = current.parentTaskUid || item.parentTaskUid || null;
            if (item.iconType === 'check') current.completed += 1;
            if (['edit', 'list', 'update'].includes(item.iconType))
                current.edits += 1;
            if (item.iconType === 'play') current.starts += 1;
            map.set(item.taskUid, current);
        }
        return Array.from(map.values()).sort(
            (a, b) => b.totalActions - a.totalActions
        );
    }, [activityData?.feed]);

    const stuckTaskInsights = useMemo<StuckTaskInsight[]>(() => {
        return taskPulses
            .map((task) => {
                const completionRate =
                    task.totalActions > 0
                        ? task.completed / task.totalActions
                        : 0;
                const editPressure =
                    task.completed > 0
                        ? task.edits / task.completed
                        : task.edits;
                const stuckScore = clamp(
                    Math.round(
                        (task.completed === 0 ? 40 : 0) +
                            task.edits * 10 +
                            task.starts * 8 +
                            Math.max(0, task.totalActions - task.completed) * 4 -
                            task.completed * 15 +
                            (completionRate < 0.25 ? 10 : 0)
                    ),
                    0,
                    100
                );

                const reasons: string[] = [];
                if (task.totalActions >= 3 && task.completed === 0) {
                    reasons.push('No completion signal');
                }
                if (task.edits >= 3) reasons.push('Edit pressure');
                if (task.starts > 0 && task.completed === 0) {
                    reasons.push('Started, not finished');
                }
                if (task.isSubtask) reasons.push('Subtask chain');
                if (editPressure >= 2) reasons.push('High edit/win ratio');

                if (stuckScore < 35) return null;

                return {
                    ...task,
                    completionRate: toFixedNumber(completionRate * 100),
                    editPressure: toFixedNumber(editPressure, 1),
                    stuckScore,
                    severity:
                        stuckScore >= 70
                            ? 'high'
                            : stuckScore >= 45
                              ? 'medium'
                              : 'low',
                    reason: reasons.length ? reasons.join(' · ') : 'Needs review',
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.stuckScore - a.stuckScore)
            .slice(0, 6) as StuckTaskInsight[];
    }, [taskPulses]);

    const topTask = taskPulses[0] || null;
    const topTaskConcentration =
        totalActions > 0 && topTask
            ? Math.round((topTask.totalActions / totalActions) * 100)
            : 0;

    const switchCount = useMemo(() => {
        let switches = 0;
        let prevTask = '';
        for (const item of chronologicalFeed) {
            const cur = item.taskUid || item.taskName;
            if (prevTask && cur !== prevTask) switches += 1;
            prevTask = cur;
        }
        return switches;
    }, [chronologicalFeed]);

    const focusStreak = useMemo(() => {
        let best = 0,
            current = 0,
            prevTask = '';
        for (const item of chronologicalFeed) {
            const cur = item.taskUid || item.taskName;
            if (cur === prevTask) {
                current += 1;
            } else {
                current = 1;
            }
            best = Math.max(best, current);
            prevTask = cur;
        }
        return best;
    }, [chronologicalFeed]);

    const firstActionAt = chronologicalFeed[0]?.time;
    const lastActionAt = chronologicalFeed[chronologicalFeed.length - 1]?.time;
    const workingWindowHours =
        firstActionAt && lastActionAt
            ? Math.max(
                  1,
                  (new Date(lastActionAt).getTime() -
                      new Date(firstActionAt).getTime()) /
                      (1000 * 60 * 60)
              )
            : 0;
    const actionsPerHour =
        workingWindowHours > 0
            ? (totalActions / workingWindowHours).toFixed(2)
            : '0.00';

    const timeBuckets = useMemo(() => {
        const counts = TIME_BUCKETS.reduce<Record<string, number>>((acc, b) => {
            acc[b.key] = 0;
            return acc;
        }, {});
        for (const item of activityData?.feed || []) {
            const bucket = getHourBucket(item.time);
            counts[bucket.key] = (counts[bucket.key] || 0) + 1;
        }
        return TIME_BUCKETS.map((b) => ({ ...b, count: counts[b.key] || 0 }));
    }, [activityData?.feed]);

    const strategicInsights = useMemo<Insight[]>(() => {
        const insights: Insight[] = [];
        if (totalActions === 0)
            insights.push({
                title: 'لا توجد حركة اليوم',
                body: 'الموظف لم يسجل أي نشاط بعد.',
                tone: 'amber',
            });
        if (completedCount >= 3)
            insights.push({
                title: 'إغلاق قوي',
                body: 'عدد الإنهاءات جيد اليوم، مؤشر على تنفيذ فعّال.',
                tone: 'emerald',
            });
        if (startedCount > completedCount)
            insights.push({
                title: 'مخاطرة تنفيذ',
                body: 'بداية شغل أعلى من الإنهاءات. راجع العوائق.',
                tone: 'rose',
            });
        if (editedCount + subtasksCount > completedCount && totalActions > 4)
            insights.push({
                title: 'نشاط تنسيقي مرتفع',
                body: 'تنظيم وتعديل أكثر من إنجاز. قد يحتاج توجيه.',
                tone: 'violet',
            });
        if (focusStreak >= 3)
            insights.push({
                title: 'تركيز ثابت',
                body: 'سلسلة متكررة على نفس التاسك — deep work.',
                tone: 'emerald',
            });
        return insights.slice(0, 4);
    }, [
        completedCount,
        editedCount,
        focusStreak,
        startedCount,
        subtasksCount,
        totalActions,
    ]);

    const businessAlerts = useMemo<AlertItem[]>(() => {
        const alerts: AlertItem[] = [];
        if (totalActions === 0)
            alerts.push({
                title: 'No activity detected',
                body: 'الموظف لم يترك أثر تشغيل واضح اليوم.',
                tone: 'amber',
                priority: 'high',
            });
        if (completedCount === 0 && totalActions > 0)
            alerts.push({
                title: 'Execution gap',
                body: 'نشاط بدون إغلاق واضح. تدخل سريع على الـ blockers.',
                tone: 'rose',
                priority: 'high',
            });
        if (topTaskConcentration >= 60)
            alerts.push({
                title: 'Task concentration is high',
                body: `${topTaskConcentration}%+ على تاسك واحدة.`,
                tone: 'violet',
                priority: 'medium',
            });
        if (switchCount >= 5)
            alerts.push({
                title: 'Context switching overload',
                body: 'تنقل عالي بين مهام مختلفة.',
                tone: 'amber',
                priority: 'medium',
            });
        return alerts.slice(0, 4);
    }, [completedCount, switchCount, topTaskConcentration, totalActions]);

    const recommendations = useMemo(() => {
        const items: string[] = [];
        if (totalActions === 0) items.push('ابعت follow-up سريع: لا نشاط.');
        if (switchCount >= 5)
            items.push('أعد توزيع الـ tasks لتقليل context switching.');
        if (editedCount > completedCount)
            items.push('راجع هل التعديل المتكرر سببه scope غير واضح.');
        if (dueCount >= 2)
            items.push('ثبّت deadlines أو أعد planning session.');
        if (executionRate < 30 && totalActions >= 3)
            items.push('النشاط موجود لكن التحويل لإنجاز ضعيف.');
        if (items.length === 0)
            items.push('الأداء متزن؛ استمر في نفس الـ rhythm.');
        return items.slice(0, 5);
    }, [
        completedCount,
        dueCount,
        editedCount,
        executionRate,
        switchCount,
        totalActions,
    ]);

    const teamHighlights = useMemo(() => {
        const sorted = [...teamSnapshots].sort(
            (a, b) => b.productivityScore - a.productivityScore
        );
        return {
            top: sorted[0] || null,
            bottom: sorted[sorted.length - 1] || null,
            average: sorted.length
                ? Math.round(avg(sorted.map((item) => item.productivityScore)))
                : 0,
        };
    }, [teamSnapshots]);

    const monthlyKPI = useMemo(() => {
        const selectedRange = buildDateRange(periodStart, periodEnd);
        const sourceSeries =
            periodResponses.length > 0
                ? periodResponses.map((day) => ({
                      date: day.date,
                      score: day.summary?.productivityScore ?? 0,
                      points: day.summary?.totalActions ?? 0,
                  }))
                : activityData?.monthlySeries?.length
                  ? activityData.monthlySeries
                  : Array.from(
                        {
                            length: Math.max(
                                3,
                                Math.min(10, selectedRange.length || 10)
                            ),
                        },
                        (_, index) => ({
                            date: `M${index + 1}`,
                            score: clamp(
                                productivityScore -
                                    12 +
                                    index * 2 +
                                    (index % 3) * 4,
                                0,
                                100
                            ),
                            points:
                                Math.round((productivityScore * 22) / 10) +
                                index * 3,
                        })
                    );

        const scores = sourceSeries.map((p) => p.score);
        const totalActionsInRange = periodResponses.reduce(
            (sum, day) => sum + (day.summary?.totalActions ?? 0),
            0
        );
        const totalScoreInRange = periodResponses.reduce(
            (sum, day) => sum + (day.summary?.productivityScore ?? 0),
            0
        );
        const completedInRange = periodResponses.reduce(
            (sum, day) =>
                sum +
                day.feed.filter((item) => item.iconType === 'check').length,
            0
        );
        const startedInRange = periodResponses.reduce(
            (sum, day) =>
                sum +
                day.feed.filter((item) => item.iconType === 'play').length,
            0
        );
        const editsInRange = periodResponses.reduce(
            (sum, day) =>
                sum +
                day.feed.filter((item) =>
                    ['edit', 'list', 'update'].includes(item.iconType)
                ).length,
            0
        );
        const switchCountInRange = periodResponses.reduce((sum, day) => {
            let local = 0;
            const feed = day.feed || [];
            for (let i = 1; i < feed.length; i += 1) {
                const prev = feed[i - 1];
                const cur = feed[i];
                if (
                    (prev.taskUid || prev.taskName) !==
                    (cur.taskUid || cur.taskName)
                ) {
                    local += 1;
                }
            }
            return sum + local;
        }, 0);

        const totalPoints = Math.round(
            totalScoreInRange || productivityScore * 22
        );
        const averageDailyScore =
            sourceSeries.length > 0
                ? Math.round(avg(scores))
                : productivityScore;
        const activeDays = periodResponses.filter(
            (day) => (day.summary?.totalActions ?? 0) > 0
        ).length;

        const firstHalf = scores.slice(
            0,
            Math.max(1, Math.floor(scores.length / 2))
        );
        const secondHalf = scores.slice(
            Math.max(1, Math.floor(scores.length / 2))
        );
        const trendDelta = Number(
            (avg(secondHalf) - avg(firstHalf)).toFixed(1)
        );

        const currentMonthScore = periodResponses.length
            ? Math.round(avg(scores))
            : Math.round(clamp(productivityScore * 1.15, 0, 100));
        const previousMonthScore = periodResponses.length
            ? Math.max(
                  0,
                  currentMonthScore - Math.round(Math.abs(trendDelta) || 8)
              )
            : Math.max(0, currentMonthScore - 12);

        const completionTrend = previousMonthScore
            ? ((currentMonthScore - previousMonthScore) / previousMonthScore) *
              100
            : 0;

        const focusScore = toFixedNumber(
            clamp(
                executionRate * 0.35 +
                    clamp(focusStreak * 9, 0, 30) +
                    clamp(100 - switchCount * 6, 0, 25) +
                    clamp(100 - editsInRange * 2, 0, 10),
                0,
                100
            )
        );

        const executionRateInRange =
            totalActionsInRange > 0
                ? Math.round((completedInRange / totalActionsInRange) * 100)
                : executionRate;

        const bestDay =
            periodResponses.length > 0
                ? periodResponses.reduce((best, day) =>
                      (day.summary?.productivityScore ?? 0) >
                      (best.summary?.productivityScore ?? 0)
                          ? day
                          : best
                  )
                : null;

        const worstDay =
            periodResponses.length > 0
                ? periodResponses.reduce((worst, day) =>
                      (day.summary?.productivityScore ?? 0) <
                      (worst.summary?.productivityScore ?? 0)
                          ? day
                          : worst
                  )
                : null;

        return {
            totalPoints,
            completionTrend: Number(completionTrend.toFixed(1)),
            focusScore,
            series: sourceSeries,
            currentMonthScore,
            previousMonthScore,
            totalActionsInRange,
            totalScoreInRange,
            averageDailyScore,
            activeDays,
            completedInRange,
            startedInRange,
            editsInRange,
            switchCountInRange,
            executionRateInRange,
            trendDelta,
            bestDay,
            worstDay,
            periodStart,
            periodEnd,
        };
    }, [
        activityData?.monthlySeries,
        executionRate,
        focusStreak,
        periodEnd,
        periodResponses,
        periodStart,
        productivityScore,
        switchCount,
    ]);

    const taskComplexityVsCompletion = useMemo(() => {
        if (!taskPulses.length) {
            return {
                complexity: 0,
                ratio: 0,
                bestTask: null as TaskPulse | null,
            };
        }
        const complexityValues = taskPulses.map(getComplexityScore);
        const complexity = Math.round(avg(complexityValues));
        const completedWeighted = taskPulses.reduce(
            (sum, task) => sum + task.completed * 20 + task.totalPoints,
            0
        );
        const ratio =
            taskPulses.reduce(
                (sum, task) =>
                    sum + task.completed / Math.max(1, task.totalActions),
                0
            ) / taskPulses.length;
        return {
            complexity,
            ratio: clamp(Math.round(ratio * 100), 0, 100),
            completedWeighted,
            bestTask: taskPulses.reduce((best, current) =>
                getComplexityScore(current) > getComplexityScore(best)
                    ? current
                    : best
            ),
        };
    }, [taskPulses]);

    const alignmentScore = useMemo(() => {
        const goals = (activityData?.feed || []).map((item) =>
            classifyTaskGoal(item.taskName, item.actionText)
        );
        const goalWeights: Record<string, number> = {
            delivery: 20,
            planning: 18,
            collaboration: 16,
            discovery: 14,
            quality: 15,
            design: 17,
            execution: 12,
        };
        const weighted = goals.reduce((sum, goal, index) => {
            const base = goalWeights[goal] || 12;
            return (
                sum +
                base +
                (activityData?.feed?.[index]?.iconType === 'check' ? 6 : 0)
            );
        }, 0);
        const normalized = activityData?.feed?.length
            ? Math.round(weighted / activityData.feed.length)
            : 0;
        return clamp(normalized * 4, 0, 100);
    }, [activityData?.feed]);

    const resourceHeatmap = useMemo(
        () => buildHeatmap(activityData?.feed || []),
        [activityData?.feed]
    );

    const predictiveBurnout = useMemo(() => {
        const editsVsWins =
            (editedCount + subtasksCount) / Math.max(1, completedCount);
        const contextPressure =
            switchCount * 4 + Math.max(0, editedCount - completedCount) * 3;
        const score = clamp(
            Math.round(
                35 +
                    editsVsWins * 18 +
                    contextPressure +
                    Math.max(0, 10 - focusStreak) * 2
            ),
            0,
            100
        );
        const risk = score >= 70 ? 'High' : score >= 45 ? 'Moderate' : 'Low';
        return { score, risk, editsVsWins };
    }, [completedCount, editedCount, focusStreak, subtasksCount, switchCount]);

    const teamBenchmark = useMemo(() => {
        const teamAverage =
            activityData?.teamAverageScore ??
            clamp(Math.round(productivityScore * 0.88 + 6), 0, 100);
        const delta = productivityScore - teamAverage;
        return { teamAverage, delta };
    }, [activityData?.teamAverageScore, productivityScore]);

    const roiReport = useMemo(() => {
        const roiValue = Math.round(
            (productivityScore * thresholds.roiMultiplier +
                executionRate * 0.4) *
                10
        );
        return {
            value: roiValue,
            label:
                roiValue >= 1000
                    ? `High impact · x${formatRatio(thresholds.roiMultiplier)}`
                    : roiValue >= 600
                      ? `Solid return · x${formatRatio(thresholds.roiMultiplier)}`
                      : `Needs lift · x${formatRatio(thresholds.roiMultiplier)}`,
        };
    }, [executionRate, productivityScore, thresholds.roiMultiplier]);

    const skillGap = useMemo(() => {
        const categories: Array<{ key: StrategicCategory; label: string }> = [
            { key: 'planning', label: 'Planning' },
            { key: 'collaboration', label: 'Collaboration' },
            { key: 'quality', label: 'Quality' },
            { key: 'delivery', label: 'Delivery' },
            { key: 'discovery', label: 'Discovery' },
        ];
        const taskCategories = new Set(
            (activityData?.feed || []).map((item) =>
                classifyTaskGoal(item.taskName, item.actionText)
            )
        );
        return categories
            .filter((cat) => !taskCategories.has(cat.key))
            .map((cat) => cat.label);
    }, [activityData?.feed]);

    const monthlyTrendValues = monthlyKPI.series.map((p) => p.score);

    const focusDepthHours = useMemo(() => {
        let bestHours = 0;
        for (let i = 1; i < chronologicalFeed.length; i += 1) {
            const prev = chronologicalFeed[i - 1];
            const cur = chronologicalFeed[i];
            const sameTask =
                (prev.taskUid || prev.taskName) ===
                (cur.taskUid || cur.taskName);
            if (sameTask) {
                const diff = Math.max(
                    0,
                    (new Date(cur.time).getTime() -
                        new Date(prev.time).getTime()) /
                        (1000 * 60 * 60)
                );
                bestHours = Math.max(bestHours, diff);
            }
        }
        return bestHours || (focusStreak > 0 ? focusStreak * 0.5 : 0);
    }, [chronologicalFeed, focusStreak]);

    const decisionVelocity = useMemo(() => {
        const weightedActions =
            completedCount * 1.5 + startedCount + createdCount * 0.7;
        return workingWindowHours > 0
            ? weightedActions / workingWindowHours
            : 0;
    }, [completedCount, createdCount, startedCount, workingWindowHours]);

    const momentumOscillator = useMemo(() => {
        const numerator =
            completedCount + createdCount - editedCount - switchCount;
        const denominator = Math.max(1, totalActions);
        return clamp(Math.round((numerator / denominator) * 100), -100, 100);
    }, [completedCount, createdCount, editedCount, switchCount, totalActions]);

    const ownershipBias = useMemo(() => {
        const own = createdCount * 2 + startedCount + completedCount * 1.2;
        const total =
            createdCount * 2 +
            startedCount +
            completedCount +
            editedCount +
            subtasksCount;
        return total > 0 ? clamp(Math.round((own / total) * 100), 0, 100) : 0;
    }, [
        completedCount,
        createdCount,
        editedCount,
        startedCount,
        subtasksCount,
    ]);

    const creativeSignals = useMemo(
        () =>
            buildCreativeSignals({
                decisionVelocity,
                momentum: momentumOscillator,
                ownershipBias,
                burnoutScore: predictiveBurnout.score,
                alignmentScore,
            }),
        [
            alignmentScore,
            decisionVelocity,
            momentumOscillator,
            ownershipBias,
            predictiveBurnout.score,
        ]
    );

    const strategicNarrative = useMemo(() => {
        const mood =
            predictiveBurnout.score >= 70
                ? 'ضغط مرتفع'
                : alignmentScore >= 70
                  ? 'توافق قوي'
                  : 'حالة متوازنة';
        return `${mood} — ${formatUserLabel(selectedUser || { id: userId })} يعمل على ${monthlyKPI.focusScore}% focus score مع ROI ${roiReport.label.toLowerCase()}.`;
    }, [
        alignmentScore,
        monthlyKPI.focusScore,
        predictiveBurnout.score,
        roiReport.label,
        selectedUser,
        userId,
    ]);

    // ── Habits computations ────────────────────────────────────────────────────
    const habitsSummary = useMemo(() => {
        if (!habitsData.length) return null;
        const active = habitsData.filter(
            (h) => h.habit_current_streak > 0
        ).length;
        const rates = habitsData
            .filter((h) => h.stats.completionRate !== null)
            .map((h) => h.stats.completionRate as number);
        const avgRate =
            rates.length > 0
                ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
                : 0;
        const maxStreak = Math.max(
            0,
            ...habitsData.map((h) => h.habit_current_streak)
        );
        const maxBestStreak = Math.max(
            0,
            ...habitsData.map((h) => h.habit_best_streak)
        );
        const totalCompletions = habitsData.reduce(
            (s, h) => s + h.stats.periodCompletions,
            0
        );
        return {
            total: habitsData.length,
            active,
            avgRate,
            maxStreak,
            maxBestStreak,
            totalCompletions,
        };
    }, [habitsData]);

    const filteredAndSortedHabits = useMemo(() => {
        let result = [...habitsData];
        if (habitSearchTerm.trim()) {
            const q = habitSearchTerm.toLowerCase();
            result = result.filter((h) => h.name.toLowerCase().includes(q));
        }
        switch (habitSortBy) {
            case 'streak':
                result.sort(
                    (a, b) => b.habit_current_streak - a.habit_current_streak
                );
                break;
            case 'rate':
                result.sort(
                    (a, b) =>
                        (b.stats.completionRate ?? -1) -
                        (a.stats.completionRate ?? -1)
                );
                break;
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }
        return result;
    }, [habitsData, habitSearchTerm, habitSortBy]);

    const habitPreview = selectedHabit || filteredAndSortedHabits[0] || null;

    const managerDigest = useMemo<ManagerDigest>(() => {
        const topPerformer = teamHighlights.top
            ? formatUserLabel(teamHighlights.top.user)
            : '—';
        const riskPerformer = teamHighlights.bottom
            ? formatUserLabel(teamHighlights.bottom.user)
            : '—';
        const topTaskLabel = topTask ? topTask.taskName : 'N/A';
        const stuckCount = stuckTaskInsights.length;
        const habitHealth = habitsSummary
            ? `${habitsSummary.avgRate}% avg · ${habitsSummary.active}/${habitsSummary.total} active`
            : 'No habit data';
        const digestTone: Tone =
            predictiveBurnout.score >= 70
                ? 'rose'
                : monthlyKPI.focusScore >= 75
                  ? 'emerald'
                  : monthlyKPI.focusScore >= 55
                    ? 'blue'
                    : 'amber';

        return {
            headline:
                predictiveBurnout.score >= 70
                    ? 'Intervention required'
                    : monthlyKPI.currentMonthScore >= 75
                      ? 'On track'
                      : 'Monitoring',
            body: `خلال ${periodStart} → ${periodEnd} تم تسجيل ${monthlyKPI.totalActionsInRange} action مع execution rate ${monthlyKPI.executionRateInRange}%. أكثر تاسك ظاهر: ${topTaskLabel}. عدد الإشارات العالقة: ${stuckCount}.`,
            statusTone: digestTone,
            bullets: [
                { label: 'Top performer', value: topPerformer },
                { label: 'Risk lane', value: riskPerformer },
                { label: 'Habit health', value: habitHealth },
                {
                    label: 'Monthly KPI',
                    value: `${monthlyKPI.currentMonthScore}% · Δ ${monthlyKPI.completionTrend >= 0 ? '+' : ''}${monthlyKPI.completionTrend}%`,
                },
            ],
            nextActions: recommendations.slice(0, 3),
        };
    }, [
        habitsSummary,
        monthlyKPI.completionTrend,
        monthlyKPI.currentMonthScore,
        monthlyKPI.executionRateInRange,
        monthlyKPI.focusScore,
        monthlyKPI.totalActionsInRange,
        periodEnd,
        periodStart,
        predictiveBurnout.score,
        recommendations,
        stuckTaskInsights.length,
        teamHighlights.bottom,
        teamHighlights.top,
        topTask,
    ]);

    const copyExecutiveBrief = async () => {
        if (!selectedUser || !activityData) return;
        const brief = [
            `Executive Brief - ${formatUserLabel(selectedUser)}`,
            `Date: ${activityData.date}`,
            `Period: ${periodStart} → ${periodEnd}`,
            `Total actions: ${totalActions}`,
            `Productivity score: ${productivityScore}`,
            `Execution rate: ${executionRate}%`,
            `Top task: ${topTask ? `${topTaskConcentration}% (${topTask.taskName})` : 'N/A'}`,
            `Switch count: ${switchCount}`,
            `Focus streak: ${focusStreak}`,
            `Monthly KPI: ${monthlyKPI.currentMonthScore}%`,
            `Focus score: ${monthlyKPI.focusScore}%`,
            `Period actions: ${monthlyKPI.totalActionsInRange}`,
            `Stuck tasks: ${stuckTaskInsights.length}`,
            `Manager digest: ${managerDigest.headline}`,
        ].join('\n');
        try {
            await navigator.clipboard.writeText(brief);
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 1600);
        } catch {
            setCopyState('idle');
        }
    };

    const isActivityLoading = isLoadingUsers || isLoadingActivity;
    const isPeriodLoading = isLoadingPeriod;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,rgba(2,6,23,1),rgba(2,6,23,0.96))]" />
            <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 md:px-6">
                {/* ── Hero Header ── */}
                <div
                    className="
        relative overflow-hidden rounded-[38px]
        border

        border-slate-200/80
        dark:border-white/10

        bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(241,245,249,0.92))]
        dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96),rgba(30,41,59,0.94))]

        text-slate-950
        dark:text-white

        shadow-[0_30px_100px_rgba(15,23,42,0.08)]
        dark:shadow-[0_35px_120px_rgba(2,6,23,0.65)]

        p-6 md:p-8
    "
                >
                    {/* Ambient Background */}
                    <div
                        className="
            absolute inset-0

            opacity-70
            dark:opacity-35

            [background-image:
            radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_32%),
            radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),
            radial-gradient(circle_at_center,rgba(168,85,247,0.06),transparent_40%)]

            dark:[background-image:
            radial-gradient(circle_at_top_left,rgba(59,130,246,0.45),transparent_32%),
            radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_28%),
            radial-gradient(circle_at_center,rgba(168,85,247,0.12),transparent_40%)]
        "
                    />

                    {/* Premium Glow */}
                    <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/20" />
                    <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15" />

                    {/* Top Shine */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/40" />

                    {/* Decorative Grid */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:40px_40px]" />

                    <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                        {/* Left Side */}
                        <div className="max-w-3xl">
                            <div
                                className="
                    inline-flex items-center gap-2

                    rounded-full

                    border
                    border-slate-200
                    dark:border-white/15

                    bg-white/80
                    dark:bg-white/10

                    px-4 py-2

                    text-xs
                    font-semibold
                    uppercase

                    tracking-[0.30em]

                    text-slate-600
                    dark:text-white/85

                    backdrop-blur-xl
                "
                            >
                                ✦ Strategic Management Console
                            </div>

                            <h2
                                className="
                    mt-5

                    text-4xl
                    font-black
                    tracking-tight

                    md:text-5xl
                    xl:text-6xl

                    leading-[1.05]
                "
                            >
                                Command Center
                                <span
                                    className="
                        block mt-2

                        bg-gradient-to-r
                        from-blue-600
                        via-violet-600
                        to-emerald-600

                        bg-clip-text
                        text-transparent
                    "
                                >
                                    إنتاجية الفريق
                                </span>
                            </h2>

                            <p
                                className="
                    mt-5

                    max-w-2xl

                    text-base
                    leading-8

                    text-slate-600
                    dark:text-white/70
                "
                            >
                                نشاط يومي كامل، تحليل سلوك العمل، مؤشرات الأداء،
                                التنبيهات التشغيلية، واكتشاف نقاط التركيز
                                والاختناق في مكان واحد.
                            </p>

                            <div className="mt-7 flex flex-wrap gap-3">
                                {[
                                    'Daily Activity',
                                    'Habit Analytics',
                                    'KPI View',
                                    'Business Alerts',
                                ].map((tag) => (
                                    <span
                                        key={tag}
                                        className="
                            rounded-full

                            border
                            border-slate-200
                            dark:border-white/10

                            bg-white/80
                            dark:bg-white/10

                            px-4 py-2

                            text-sm
                            font-medium

                            text-slate-700
                            dark:text-white/80

                            backdrop-blur-xl

                            transition-all
                            duration-300

                            hover:scale-[1.03]
                            hover:bg-white
                            dark:hover:bg-white/15
                        "
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right Side Controls */}
                        <div className="grid gap-4 md:min-w-[450px] md:grid-cols-2">
                            <label className="block">
                                <span
                                    className="
                        mb-2 block

                        text-xs
                        font-semibold
                        uppercase

                        tracking-[0.25em]

                        text-slate-500
                        dark:text-white/60
                    "
                                >
                                    التاريخ
                                </span>

                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="
                        w-full

                        rounded-[20px]

                        border
                        border-slate-200
                        dark:border-white/10

                        bg-white
                        dark:bg-white/10

                        px-4 py-3

                        text-slate-900
                        dark:text-white

                        shadow-sm
                        dark:shadow-none

                        backdrop-blur-xl

                        outline-none

                        transition-all
                        duration-300

                        focus:border-blue-500
                        dark:focus:border-blue-400

                        focus:ring-4
                        focus:ring-blue-500/15
                    "
                                />
                            </label>

                            <label className="block">
                                <span
                                    className="
                        mb-2 block

                        text-xs
                        font-semibold
                        uppercase

                        tracking-[0.25em]

                        text-slate-500
                        dark:text-white/60
                    "
                                >
                                    الموظف
                                </span>

                                <select
                                    value={userId}
                                    onChange={(e) =>
                                        setUserId(Number(e.target.value))
                                    }
                                    className="
                        w-full

                        rounded-[20px]

                        border
                        border-slate-200
                        dark:border-white/10

                        bg-white
                        dark:bg-white/10

                        px-4 py-3

                        text-slate-900
                        dark:text-white

                        shadow-sm
                        dark:shadow-none

                        backdrop-blur-xl

                        outline-none

                        transition-all
                        duration-300

                        focus:border-blue-500
                        dark:focus:border-blue-400

                        focus:ring-4
                        focus:ring-blue-500/15
                    "
                                >
                                    {users.length === 0 && (
                                        <option value={0}>
                                            جاري التحميل...
                                        </option>
                                    )}

                                    {users.map((u) => (
                                        <option
                                            key={u.id}
                                            value={u.id}
                                            className="text-slate-950"
                                        >
                                            {formatUserLabel(u)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ── User Context Bar ── */}
                {selectedUser && (
                    <div
                        className="
            relative overflow-hidden

            rounded-[28px]

            border
            border-slate-200
            dark:border-slate-800

            bg-white
            dark:bg-slate-900

            shadow-sm
            dark:shadow-none

            p-6
        "
                    >
                        {/* Top Accent */}
                        <div
                            className="
                absolute top-0 left-0 right-0
                h-[3px]

                bg-gradient-to-r
                from-blue-500
                via-violet-500
                to-emerald-500
            "
                        />

                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            {/* User */}
                            <div className="flex items-center gap-4 min-w-0">
                                <div
                                    className="
                        flex h-14 w-14 items-center justify-center

                        rounded-2xl

                        bg-gradient-to-br
                        from-blue-500
                        to-violet-600

                        text-lg
                        font-black
                        text-white

                        shadow-lg
                    "
                                >
                                    {formatUserLabel(selectedUser)
                                        ?.charAt(0)
                                        ?.toUpperCase()}
                                </div>

                                <div className="min-w-0">
                                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                                        Current Focus
                                    </div>

                                    <div className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">
                                        {formatUserLabel(selectedUser)}
                                    </div>

                                    <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                                        {selectedUser.email || 'No email'}
                                    </div>
                                </div>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className="
                        rounded-xl

                        border border-slate-200
                        dark:border-slate-700

                        bg-slate-50
                        dark:bg-slate-800

                        px-3 py-2

                        text-sm
                        font-medium

                        text-slate-700
                        dark:text-slate-300
                    "
                                >
                                    📅 {formatDate(date)}
                                </span>

                                <span
                                    className={`
                        rounded-xl
                        px-3 py-2
                        text-sm
                        font-semibold

                        ${
                            riskLevel === 'Healthy'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : riskLevel === 'At risk'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                        }
                    `}
                                >
                                    {riskLevel}
                                </span>

                                <span
                                    className="
                        rounded-xl

                        border border-slate-200
                        dark:border-slate-700

                        bg-slate-50
                        dark:bg-slate-800

                        px-3 py-2

                        text-sm
                        font-medium

                        text-slate-700
                        dark:text-slate-300
                    "
                                >
                                    ⚡ {activityDensity}
                                </span>

                                <button
                                    type="button"
                                    onClick={copyExecutiveBrief}
                                    className="
                        rounded-xl

                        bg-slate-900
                        dark:bg-white

                        px-4 py-2

                        text-sm
                        font-semibold

                        text-white
                        dark:text-slate-900

                        transition-all

                        hover:scale-[1.03]
                    "
                                >
                                    {copyState === 'copied'
                                        ? 'Copied ✓'
                                        : 'Copy Brief'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tab Navigation ── */}
                <div className="flex flex-wrap gap-3">
                    {[
                        {
                            id: 'activity' as const,
                            label: '📊 النشاط اليومي',
                        },
                        {
                            id: 'habits' as const,
                            label: '🔥 تحليل العادات',
                        },
                    ].map((tab) => {
                        const active = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                    group relative overflow-hidden rounded-2xl px-6 py-3
                    transition-all duration-300 ease-out

                    ${
                        active
                            ? `
                                border border-transparent
                                bg-gradient-to-r
                                from-blue-600
                                via-indigo-600
                                to-violet-600

                                text-white

                                shadow-[0_12px_40px_rgba(59,130,246,0.35)]
                                dark:shadow-[0_12px_40px_rgba(59,130,246,0.25)]

                                scale-[1.02]
                              `
                            : `
                                border
                                border-slate-200
                                bg-white

                                text-slate-700

                                hover:border-blue-200
                                hover:bg-slate-50
                                hover:text-slate-950

                                dark:border-slate-700
                                dark:bg-slate-900
                                dark:text-slate-300

                                dark:hover:border-slate-600
                                dark:hover:bg-slate-800
                                dark:hover:text-white
                              `
                    }
                `}
                            >
                                {active && (
                                    <>
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_35%)]" />
                                        <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/20 blur-2xl" />
                                    </>
                                )}

                                <div className="relative flex items-center gap-2">
                                    <span className="text-base">
                                        {tab.id === 'activity' ? '📊' : '🔥'}
                                    </span>

                                    <span className="font-semibold">
                                        {tab.label
                                            .replace('📊 ', '')
                                            .replace('🔥 ', '')}
                                    </span>

                                    {active && (
                                        <span className="ml-2 h-2 w-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <div
                        className="
            relative overflow-hidden rounded-3xl
            border border-rose-200
            bg-gradient-to-br
            from-rose-50
            via-white
            to-red-50

            p-5

            shadow-[0_12px_40px_rgba(244,63,94,0.10)]

            dark:border-rose-900/50
            dark:from-rose-950/40
            dark:via-slate-900
            dark:to-red-950/30
        "
                    >
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-500 to-red-500" />

                        <div className="flex items-start gap-4">
                            <div
                                className="
                    flex h-11 w-11 shrink-0 items-center justify-center
                    rounded-2xl

                    bg-rose-100
                    text-lg

                    dark:bg-rose-500/15
                "
                            >
                                ⚠️
                            </div>

                            <div className="min-w-0">
                                <div
                                    className="
                        text-sm
                        font-bold
                        uppercase
                        tracking-[0.18em]

                        text-rose-600
                        dark:text-rose-400
                    "
                                >
                                    System Alert
                                </div>

                                <div
                                    className="
                        mt-1
                        text-sm
                        leading-7

                        text-slate-700
                        dark:text-slate-300
                    "
                                >
                                    {error}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════
                    ACTIVITY TAB
                ════════════════════════════════════════════════════ */}
                {activeTab === 'activity' && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatCard
                                title="إجمالي الأنشطة"
                                value={totalActions}
                                hint="عدد الأحداث المسجلة"
                                accent="blue"
                                trend={
                                    totalActions >= 10
                                        ? 'Strong'
                                        : totalActions >= 5
                                          ? 'Moderate'
                                          : 'Low'
                                }
                            />
                            <StatCard
                                title="نقاط الأداء (KPI)"
                                value={productivityScore}
                                hint="مجموع النقاط"
                                accent="emerald"
                                trend={
                                    productivityScore >= 15
                                        ? 'Healthy'
                                        : 'Watch'
                                }
                            />
                            <StatCard
                                title="متوسط النقاط"
                                value={averagePoints}
                                hint="جودة الحركة"
                                accent="violet"
                                trend={
                                    executionRate > 50 ? 'Focused' : 'Scattered'
                                }
                            />
                            <StatCard
                                title="معدل الإغلاق"
                                value={`${executionRate}%`}
                                hint="نسبة الإنهاء"
                                accent="amber"
                                trend={
                                    executionRate >= 40 ? 'Good' : 'Needs push'
                                }
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                            <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.06),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_24%)]" />
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent dark:via-white/10" />
                                <div className="relative">
                                    <SectionTitle
                                        title="Team Productivity Ranking"
                                        subtitle="ترتيب الموظفين على نفس اليوم مع إشارات صحية / مخاطرة / ضغط."
                                        action={
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                Avg KPI{' '}
                                                {teamHighlights.average || 0}
                                            </span>
                                        }
                                    />
                                    <div className="mt-5 grid gap-3">
                                        {isLoadingTeam ? (
                                            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                                Loading team benchmark...
                                            </div>
                                        ) : teamSnapshots.length === 0 ? (
                                            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                                Team ranking will appear after
                                                user activity is loaded for this
                                                date.
                                            </div>
                                        ) : (
                                            teamSnapshots
                                                .slice(0, 8)
                                                .map((snapshot, index) => (
                                                    <TeamRankRow
                                                        key={snapshot.user.id}
                                                        snapshot={snapshot}
                                                        rank={index + 1}
                                                        active={
                                                            snapshot.user.id ===
                                                            userId
                                                        }
                                                        onSelect={() =>
                                                            setUserId(
                                                                snapshot.user.id
                                                            )
                                                        }
                                                    />
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <RadialMeter
                                        value={executionRate}
                                        label="Execution rate"
                                        tone={
                                            executionRate >= 60
                                                ? 'emerald'
                                                : executionRate >= 35
                                                  ? 'amber'
                                                  : 'rose'
                                        }
                                    />
                                </div>

                                <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <RadialMeter
                                        value={clamp(
                                            100 - switchCount * 10,
                                            0,
                                            100
                                        )}
                                        label="Focus depth"
                                        tone={
                                            switchCount <= 4
                                                ? 'blue'
                                                : switchCount <= 8
                                                  ? 'amber'
                                                  : 'rose'
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[34px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <SectionTitle
                                    title="Strategic Enterprise View"
                                    subtitle="لوحة تنفيذية غير تقليدية: مؤشرات، تنبؤات، ومراجعة إدارية في مكان واحد."
                                />
                                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    Target Score: {thresholds.targetScore}%
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
                                <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                        Period From
                                    </div>
                                    <input
                                        type="date"
                                        value={periodStart}
                                        onChange={(e) =>
                                            setPeriodStart(e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400"
                                    />
                                </label>

                                <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                        Period To
                                    </div>
                                    <input
                                        type="date"
                                        value={periodEnd}
                                        onChange={(e) =>
                                            setPeriodEnd(e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={() => void fetchPeriodAnalytics()}
                                    className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 dark:border-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                                >
                                    {isPeriodLoading
                                        ? 'Recalculating...'
                                        : 'Recalculate KPI'}
                                </button>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {periodStart} → {periodEnd}
                                </span>
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                                    Range actions:{' '}
                                    {monthlyKPI.totalActionsInRange}
                                </span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    Range focus: {monthlyKPI.focusScore}%
                                </span>
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                                    Active days: {monthlyKPI.activeDays}
                                </span>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                                        Monthly KPI Trend
                                    </div>
                                    <div className="mt-3 text-4xl font-black text-slate-950 dark:text-white">
                                        {monthlyKPI.currentMonthScore}%
                                    </div>
                                    <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                                        {monthlyKPI.completionTrend >= 0
                                            ? '↑'
                                            : '↓'}{' '}
                                        {Math.abs(monthlyKPI.completionTrend)}%
                                        compared with last month
                                    </div>
                                    <div className="mt-4 rounded-2xl bg-white p-3 dark:bg-slate-900">
                                        <Sparkline
                                            values={monthlyTrendValues}
                                            tone="emerald"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <RadialMeter
                                        value={monthlyKPI.focusScore}
                                        label="Focus"
                                        tone="emerald"
                                    />
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <RadialMeter
                                        value={alignmentScore}
                                        label="Alignment"
                                        tone="blue"
                                    />
                                </div>

                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <RadialMeter
                                        value={predictiveBurnout.score}
                                        label="Burnout"
                                        tone={
                                            predictiveBurnout.score >= 70
                                                ? 'rose'
                                                : 'amber'
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)] xl:col-span-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                                Resource Allocation Heatmap
                                            </h4>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                توزيع الحمل عبر ساعات اليوم
                                                لتحديد الاختناق أو فترات
                                                التركيز.
                                            </p>
                                        </div>
                                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            Workload balance
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <HeatmapMatrix
                                            cells={resourceHeatmap}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                        <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                            Predictive Burnout
                                        </h4>
                                        <div className="mt-3 flex items-end justify-between">
                                            <div>
                                                <div className="text-4xl font-black text-slate-950 dark:text-white">
                                                    {predictiveBurnout.score}%
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    Risk:{' '}
                                                    {predictiveBurnout.risk}
                                                </div>
                                            </div>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    predictiveBurnout.score >=
                                                    70
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                }`}
                                            >
                                                {formatRatio(
                                                    predictiveBurnout.editsVsWins
                                                )}{' '}
                                                edits/wins
                                            </span>
                                        </div>
                                        <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div
                                                className={`h-2 rounded-full ${
                                                    predictiveBurnout.score >=
                                                    70
                                                        ? 'bg-rose-500'
                                                        : 'bg-emerald-500'
                                                }`}
                                                style={{
                                                    width: `${predictiveBurnout.score}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                        <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                            ROI Reporting
                                        </h4>
                                        <div className="mt-3 text-4xl font-black text-slate-950 dark:text-white">
                                            {roiReport.value}
                                        </div>
                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                            Automated ROI score •{' '}
                                            {roiReport.label}
                                        </p>
                                        <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                            Execution weight:{' '}
                                            {
                                                taskComplexityVsCompletion.completedWeighted
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Task Complexity vs Completion
                                    </h4>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                                            <div className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                                                Complexity
                                            </div>
                                            <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                                {
                                                    taskComplexityVsCompletion.complexity
                                                }
                                                %
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                                            <div className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                                                Completion Ratio
                                            </div>
                                            <div className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                                {
                                                    taskComplexityVsCompletion.ratio
                                                }
                                                %
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                        {taskComplexityVsCompletion.bestTask
                                            ? `Most demanding task: ${taskComplexityVsCompletion.bestTask.taskName}`
                                            : 'No task pulse yet.'}
                                    </div>
                                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        Weighted completions:{' '}
                                        {
                                            taskComplexityVsCompletion.completedWeighted
                                        }
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Team Benchmarking
                                    </h4>
                                    <div className="mt-3 flex items-end justify-between">
                                        <div>
                                            <div className="text-4xl font-black text-slate-950 dark:text-white">
                                                {teamBenchmark.teamAverage}%
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                                Team average
                                            </div>
                                        </div>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                teamBenchmark.delta >= 0
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                            }`}
                                        >
                                            {teamBenchmark.delta >= 0
                                                ? '+'
                                                : ''}
                                            {teamBenchmark.delta} vs current
                                        </span>
                                    </div>
                                    <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className="h-2 rounded-full bg-blue-500"
                                            style={{
                                                width: `${clamp(teamBenchmark.teamAverage, 0, 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Skill Gap Analysis
                                    </h4>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {skillGap.length > 0 ? (
                                            skillGap.map((gap) => (
                                                <span
                                                    key={gap}
                                                    className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                                >
                                                    {gap}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                Balanced coverage
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Focus Depth Meter
                                    </h4>
                                    <div className="mt-4 flex items-center gap-4">
                                        <RadialMeter
                                            value={clamp(
                                                Math.round(
                                                    focusDepthHours * 35
                                                ),
                                                0,
                                                100
                                            )}
                                            label="Depth"
                                            tone="violet"
                                        />
                                        <div className="text-sm leading-7 text-slate-600 dark:text-slate-400">
                                            {focusDepthHours > 0
                                                ? `أطول عمق تركيز مقدّر: ${toFixedNumber(focusDepthHours, 1)} ساعة متصلة تقريباً.`
                                                : 'لا توجد إشارة كافية بعد لقياس العمق بشكل دقيق.'}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Strategic Narrative
                                    </h4>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                                        {strategicNarrative}
                                    </p>
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        {[
                                            {
                                                label: 'Target',
                                                value: `${thresholds.targetScore}%`,
                                            },
                                            {
                                                label: 'Concentration cap',
                                                value: `${thresholds.concentrationMax}%`,
                                            },
                                            {
                                                label: 'Focus min',
                                                value: `${thresholds.focusMinHours}h`,
                                            },
                                        ].map((item) => (
                                            <div
                                                key={item.label}
                                                className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"
                                            >
                                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                    {item.label}
                                                </div>
                                                <div className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                            Customizable Strategy Thresholds
                                        </h4>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            Admin UI
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        {[
                                            {
                                                key: 'targetScore',
                                                label: 'Target score',
                                                min: 50,
                                                max: 100,
                                                step: 1,
                                            },
                                            {
                                                key: 'burnoutEditLimit',
                                                label: 'Burnout edits',
                                                min: 1,
                                                max: 20,
                                                step: 1,
                                            },
                                            {
                                                key: 'focusMinHours',
                                                label: 'Focus hours',
                                                min: 1,
                                                max: 8,
                                                step: 0.5,
                                            },
                                            {
                                                key: 'concentrationMax',
                                                label: 'Concentration cap',
                                                min: 20,
                                                max: 90,
                                                step: 1,
                                            },
                                            {
                                                key: 'roiMultiplier',
                                                label: 'ROI multiplier',
                                                min: 1,
                                                max: 5,
                                                step: 0.1,
                                            },
                                        ].map((item) => (
                                            <label
                                                key={item.key}
                                                className="block rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"
                                            >
                                                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    <span>{item.label}</span>
                                                    <span>
                                                        {String(
                                                            thresholds[
                                                                item.key as keyof StrategicThresholds
                                                            ]
                                                        )}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={item.min}
                                                    max={item.max}
                                                    step={item.step}
                                                    value={
                                                        thresholds[
                                                            item.key as keyof StrategicThresholds
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        setThresholds(
                                                            (current) => ({
                                                                ...current,
                                                                [item.key]:
                                                                    item.key ===
                                                                        'roiMultiplier' ||
                                                                    item.key ===
                                                                        'focusMinHours'
                                                                        ? Number(
                                                                              e
                                                                                  .target
                                                                                  .value
                                                                          )
                                                                        : Number(
                                                                              e
                                                                                  .target
                                                                                  .value
                                                                          ),
                                                            })
                                                        )
                                                    }
                                                    className="w-full"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                                        Creative Control Room
                                    </h4>
                                    <div className="mt-4 grid gap-3">
                                        {creativeSignals.map((signal) => (
                                            <div
                                                key={signal.title}
                                                className={`rounded-2xl border p-4 ${
                                                    signal.tone === 'emerald'
                                                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                                                        : signal.tone === 'rose'
                                                          ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'
                                                          : signal.tone ===
                                                              'amber'
                                                            ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
                                                            : signal.tone ===
                                                                'violet'
                                                              ? 'border-violet-200 bg-violet-50 dark:border-violet-500/20 dark:bg-violet-500/10'
                                                              : 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10'
                                                }`}
                                            >
                                                <div className="text-sm font-black text-slate-950 dark:text-white">
                                                    {signal.title}
                                                </div>
                                                <div className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                                    {signal.body}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Grid */}
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            {/* Feed Panel */}
                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)] xl:col-span-2">
                                <div className="flex items-end justify-between">
                                    <SectionTitle
                                        title="لوحة التحكم التشغيلية"
                                        subtitle="فلترة + بحث + انتقال مباشر للتاسك."
                                    />
                                    <button
                                        onClick={fetchActivity}
                                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                        placeholder="ابحث في النشاط أو اسم التاسك"
                                        className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {FILTERS.map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                                    filter === f
                                                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                                                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {f === 'all'
                                                    ? 'الكل'
                                                    : ICON_META[f].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6 space-y-4">
                                    {isActivityLoading ? (
                                        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                            جاري تحليل بيانات الإنتاجية...
                                        </div>
                                    ) : visibleFeed.length === 0 ? (
                                        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-950">
                                            <div className="text-lg font-bold text-slate-950 dark:text-white">
                                                لا توجد أنشطة
                                            </div>
                                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                جرّب تغيير التاريخ أو الموظف.
                                            </p>
                                        </div>
                                    ) : (
                                        visibleFeed.map((item) => (
                                            <ActivityRow
                                                key={item.id}
                                                item={item}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Side Panel */}
                            <div className="space-y-4">
                                <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)] flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-2xl shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                        {dominantActionIcon}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Dominant activity
                                        </div>
                                        <div className="text-xl font-black text-slate-950 dark:text-white">
                                            {dominantActionLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h3 className="text-lg font-black text-slate-950 dark:text-white">
                                        Operational Signals
                                    </h3>
                                    <div className="mt-4 grid gap-3">
                                        {[
                                            {
                                                label: 'Completed',
                                                value: completedCount,
                                            },
                                            {
                                                label: 'Started',
                                                value: startedCount,
                                            },
                                            {
                                                label: 'Created',
                                                value: createdCount,
                                            },
                                            {
                                                label: 'Edits',
                                                value:
                                                    editedCount + subtasksCount,
                                            },
                                        ].map((s) => (
                                            <div
                                                key={s.label}
                                                className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"
                                            >
                                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                    {s.label}
                                                </div>
                                                <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                                                    {s.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h3 className="text-lg font-black text-slate-950 dark:text-white">
                                        Workflow Breakdown
                                    </h3>
                                    <div className="mt-4 space-y-3">
                                        {timeBuckets.map((b) => (
                                            <div
                                                key={b.key}
                                                className={`rounded-2xl border p-4 ${
                                                    b.tone === 'blue'
                                                        ? 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10'
                                                        : b.tone === 'amber'
                                                          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
                                                          : b.tone === 'violet'
                                                            ? 'border-violet-200 bg-violet-50 dark:border-violet-500/20 dark:bg-violet-500/10'
                                                            : b.tone === 'rose'
                                                              ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'
                                                              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="font-bold text-slate-950 dark:text-white">
                                                        {b.label}
                                                    </div>
                                                    <div className="text-sm font-black text-slate-950 dark:text-white">
                                                        {b.count}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <h3 className="text-lg font-black text-slate-950 dark:text-white">
                                        Quick Move
                                    </h3>
                                    <button
                                        type="button"
                                        disabled={!latestTask?.taskUid}
                                        onClick={() =>
                                            openTask(
                                                (latestTask as any) || null
                                            )
                                        }
                                        className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                            latestTask?.taskUid
                                                ? 'bg-slate-950 text-white hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90'
                                                : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                        }`}
                                    >
                                        {latestTask?.taskUid
                                            ? `Open ${latestTask.taskName}`
                                            : 'لا يوجد تاسك'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Insights + Alerts */}
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle title="Strategic Insights" />
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {strategicInsights.length > 0 ? (
                                        strategicInsights.map((i) => (
                                            <InsightCard
                                                key={i.title}
                                                title={i.title}
                                                body={i.body}
                                                tone={i.tone}
                                            />
                                        ))
                                    ) : (
                                        <InsightCard
                                            title="مؤشرات مستقرة"
                                            body="لا توجد إشارات خطر حالياً."
                                            tone="emerald"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle title="Business Alerts" />
                                <div className="mt-4 space-y-3">
                                    {businessAlerts.map((a) => (
                                        <InsightCard
                                            key={a.title}
                                            title={a.title}
                                            body={a.body}
                                            tone={a.tone}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bottom KPIs */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatCard
                                title="Task Concentration"
                                value={`${topTaskConcentration}%`}
                                hint={topTask ? topTask.taskName : 'N/A'}
                                accent="rose"
                                trend={
                                    topTaskConcentration >= 60
                                        ? 'Focused'
                                        : 'Distributed'
                                }
                                onClick={() =>
                                    openTask((topTask as any) || null)
                                }
                            />
                            <StatCard
                                title="Context Switches"
                                value={switchCount}
                                hint="عدد التنقلات بين المهام"
                                accent="amber"
                                trend={switchCount >= 5 ? 'High' : 'Controlled'}
                            />
                            <StatCard
                                title="Focus Streak"
                                value={focusStreak}
                                hint="أطول سلسلة على نفس التاسك"
                                accent="violet"
                                trend={
                                    focusStreak >= 3
                                        ? 'Deep work'
                                        : 'Fragmented'
                                }
                            />
                            <StatCard
                                title="Actions / Hour"
                                value={actionsPerHour}
                                hint="معدل التنفيذ الفعلي"
                                accent="blue"
                                trend={
                                    workingWindowHours > 0 ? 'Live pace' : 'N/A'
                                }
                            />
                        </div>

                        {/* Manager Digest + Stuck Task Detector */}
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle
                                    title="Manager Digest"
                                    subtitle="ملخص تنفيذي جاهز للمدير يختصر الحالة التشغيلية في دقائق."
                                    action={
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            managerDigest.statusTone === 'emerald'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                : managerDigest.statusTone === 'rose'
                                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                                  : managerDigest.statusTone === 'amber'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                        }`}>
                                            {managerDigest.headline}
                                        </span>
                                    }
                                />

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                            Executive Summary
                                        </div>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {managerDigest.body}
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                                Monthly {monthlyKPI.currentMonthScore}%
                                            </span>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                                Focus {monthlyKPI.focusScore}%
                                            </span>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                                ROI {roiReport.value}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                            Key Signals
                                        </div>
                                        <div className="mt-3 space-y-3">
                                            {managerDigest.bullets.map((bullet) => (
                                                <div
                                                    key={bullet.label}
                                                    className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900"
                                                >
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                        {bullet.label}
                                                    </div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {bullet.value}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {managerDigest.nextActions.map((item, idx) => (
                                        <div
                                            key={`${item}-${idx}`}
                                            className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle
                                    title="Stuck Task Detector"
                                    subtitle="يرصد التاسكات العالقة: edits كتير، إغلاق ضعيف، أو progress متقطع."
                                    action={
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            {stuckTaskInsights.length} flagged
                                        </span>
                                    }
                                />

                                <div className="mt-4 space-y-3">
                                    {stuckTaskInsights.length > 0 ? (
                                        stuckTaskInsights.map((task) => (
                                            <button
                                                key={task.taskUid}
                                                type="button"
                                                onClick={() =>
                                                    openTask({
                                                        taskUid: task.taskUid,
                                                        isSubtask: task.isSubtask,
                                                        parentTaskUid: task.parentTaskUid,
                                                        taskName: task.taskName,
                                                        actionText: '',
                                                        points: 0,
                                                        time: task.lastAction,
                                                        id: 0,
                                                        iconType: 'info',
                                                    } as ActivityFeedItem)
                                                }
                                                className="group w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:border-rose-500/30 dark:hover:bg-slate-900"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-slate-950 dark:text-white">
                                                            {task.taskName}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            {task.totalActions} actions · {task.completed} done · {task.edits} edits · {task.starts} starts
                                                        </div>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                        task.severity === 'high'
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                                            : task.severity === 'medium'
                                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                                    }`}>
                                                        {task.stuckScore} score
                                                    </span>
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {task.isSubtask && (
                                                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                                                            Subtask
                                                        </span>
                                                    )}
                                                    {task.parentTaskUid && (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            Parent linked
                                                        </span>
                                                    )}
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
                                                        Completed {task.completionRate}%
                                                    </span>
                                                </div>

                                                <div className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                                                    {task.reason}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                            No stuck-task signals detected for this period.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                            <SectionTitle
                                title="Recommendations"
                                subtitle="قرارات إدارية مقترحة."
                            />
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {recommendations.map((rec, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        {rec}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Task Pulse */}
                        {taskPulses.length > 0 && (
                            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                <SectionTitle
                                    title="Task Pulse Board"
                                    subtitle="التاسكات الأكثر حركة."
                                />
                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {taskPulses.slice(0, 6).map((task) => (
                                        <button
                                            key={task.taskUid}
                                            type="button"
                                            onClick={() =>
                                                openTask({
                                                    taskUid: task.taskUid,
                                                    isSubtask: task.isSubtask,
                                                    parentTaskUid:
                                                        task.parentTaskUid,
                                                } as any)
                                            }
                                            className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500/30 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="truncate font-bold text-slate-950 dark:text-white">
                                                    {task.taskName}
                                                </div>
                                                <div className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                                                    {task.totalActions} actions
                                                </div>
                                            </div>
                                            {(task.isSubtask ||
                                                task.parentTaskUid) && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {task.isSubtask && (
                                                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                                                            Subtask
                                                        </span>
                                                    )}
                                                    {task.parentTaskUid && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                            Parent linked
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                                                {[
                                                    {
                                                        v: task.totalPoints,
                                                        l: 'Points',
                                                    },
                                                    {
                                                        v: task.completed,
                                                        l: 'Done',
                                                    },
                                                    {
                                                        v: task.edits,
                                                        l: 'Edit',
                                                    },
                                                    {
                                                        v: task.starts,
                                                        l: 'Start',
                                                    },
                                                ].map((s) => (
                                                    <div
                                                        key={s.l}
                                                        className="rounded-2xl bg-white p-2 text-center shadow-sm dark:bg-slate-950"
                                                    >
                                                        <div className="font-black text-slate-950 dark:text-white">
                                                            {s.v}
                                                        </div>
                                                        <div className="text-slate-400">
                                                            {s.l}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ════════════════════════════════════════════════════
                    HABITS TAB
                ════════════════════════════════════════════════════ */}
                {activeTab === 'habits' && (
                    <>
                        {/* Habits Header Controls */}
                        <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.06),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_26%)]" />
                            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        Habit Intelligence
                                    </div>
                                    <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                                        تحليل العادات
                                    </h3>
                                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                                        عرض تنفيذي متزن للعادات، مع مقارنة
                                        streak، ومعدلات الإنجاز، وإشارات
                                        الانتباه.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        الفترة
                                    </span>
                                    {([7, 30, 90] as const).map((p) => {
                                        const active = habitPeriod === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() =>
                                                    setHabitPeriod(p)
                                                }
                                                className={`
                                    rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300
                                    ${
                                        active
                                            ? 'border border-transparent bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] dark:bg-white dark:text-slate-950 dark:shadow-[0_12px_30px_rgba(255,255,255,0.08)]'
                                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                                    }
                                `}
                                            >
                                                {p === 7
                                                    ? 'آخر 7 أيام'
                                                    : p === 30
                                                      ? 'آخر 30 يوم'
                                                      : 'آخر 90 يوم'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        {habitsSummary && (
                            <div
                                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-7xl mx-auto p-4 font-sans text-right"
                                dir="rtl"
                            >
                                {/* 🌟 1. HERO CARD: متوسط الإنجاز (Violet) - يأخذ مساحة مزدوجة */}
                                <div className="group relative sm:col-span-2 lg:col-span-2 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(109,40,217,0.1)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-black dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    {/* Dynamic Glow background */}
                                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl transition-all duration-500 group-hover:scale-150 dark:bg-violet-500/15"></div>

                                    {/* Badge تميز الكارت البطل */}
                                    <div className="absolute left-6 top-6 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                                        المؤشر الرئيسي
                                    </div>

                                    <div className="relative z-10 flex h-full flex-col justify-between pt-4">
                                        <StatCard
                                            title="متوسط الإنجاز"
                                            value={`${habitsSummary.avgRate}%`}
                                            hint={`خلال ${habitPeriod} يوم`}
                                            accent="violet"
                                            trend={
                                                habitsSummary.avgRate >= 70
                                                    ? 'Healthy'
                                                    : habitsSummary.avgRate >=
                                                        40
                                                      ? 'Moderate'
                                                      : 'Needs push'
                                            }
                                        />
                                    </div>
                                </div>

                                {/* ---------------- 2. إجمالي العادات (Blue) ---------------- */}
                                <div className="group relative sm:col-span-1 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(59,130,246,0.1)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950">
                                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl transition-all duration-500 group-hover:scale-150 dark:bg-blue-500/15"></div>
                                    <StatCard
                                        title="إجمالي العادات"
                                        value={habitsSummary.total}
                                        hint="كل العادات المسجلة"
                                        accent="blue"
                                    />
                                </div>

                                {/* ---------------- 3. عادات نشطة (Emerald) ---------------- */}
                                <div className="group relative sm:col-span-1 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(16,185,129,0.1)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950">
                                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl transition-all duration-500 group-hover:scale-150 dark:bg-emerald-500/15"></div>
                                    <StatCard
                                        title="عادات نشطة"
                                        value={habitsSummary.active}
                                        hint="streak > 0 يوم"
                                        accent="emerald"
                                        trend={
                                            habitsSummary.active ===
                                            habitsSummary.total
                                                ? 'All active'
                                                : `${habitsSummary.total - habitsSummary.active} inactive`
                                        }
                                    />
                                </div>

                                {/* ---------------- 4. أعلى Streak (Amber) ---------------- */}
                                <div className="group relative sm:col-span-1 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(245,158,11,0.1)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950">
                                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl transition-all duration-500 group-hover:scale-150 dark:bg-amber-500/15"></div>
                                    <StatCard
                                        title="أعلى Streak"
                                        value={`🔥 ${habitsSummary.maxStreak}`}
                                        hint={`Best ever: ${habitsSummary.maxBestStreak} يوم`}
                                        accent="amber"
                                    />
                                </div>

                                {/* ---------------- 5. Priority Pressure (Rose) ---------------- */}
                                <div className="group relative sm:col-span-1 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(244,63,94,0.1)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950">
                                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl transition-all duration-500 group-hover:scale-150 dark:bg-rose-500/15"></div>
                                    <StatCard
                                        title="Priority Pressure"
                                        value={priorityCount}
                                        hint="عدد تعديلات الأولوية اليوم"
                                        accent="rose"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Habit Drill-Down */}
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                            <SectionTitle
                                title="Habit Drill-Down"
                                subtitle="اضغط على أي عادة لفتح التحليل التفصيلي داخل لوحة جانبية Premium."
                                action={
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {habitPreview
                                            ? habitPreview.name
                                            : 'No habit selected'}
                                    </span>
                                }
                            />

                            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                                <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                                    {habitPreview ? (
                                        <>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                                                    {habitPreview.recurrence_type}
                                                </span>
                                                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                                                    {habitPreview.habit_current_streak >= 7
                                                        ? 'Elite rhythm'
                                                        : habitPreview.habit_current_streak >= 3
                                                          ? 'Consistent'
                                                          : 'Needs support'}
                                                </span>
                                            </div>

                                            <h4 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                                                {habitPreview.name}
                                            </h4>
                                            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
                                                Habit details are shown through the drawer, but this panel gives a leadership-friendly snapshot before drilling deeper.
                                            </p>

                                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {[
                                                    {
                                                        label: 'Current',
                                                        value: habitPreview.habit_current_streak,
                                                    },
                                                    {
                                                        label: 'Best',
                                                        value: habitPreview.habit_best_streak,
                                                    },
                                                    {
                                                        label: 'Done',
                                                        value: habitPreview.stats.periodCompletions,
                                                    },
                                                    {
                                                        label: 'Rate',
                                                        value: `${habitPreview.stats.completionRate ?? 0}%`,
                                                    },
                                                ].map((item) => (
                                                    <div
                                                        key={item.label}
                                                        className="rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-slate-900"
                                                    >
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                            {item.label}
                                                        </div>
                                                        <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                                                            {item.value}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedHabit(habitPreview)
                                                    }
                                                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                                                >
                                                    Open drawer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        window.location.assign(`/task/${habitPreview.uid}`)
                                                    }
                                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                >
                                                    Open related task
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                            اختر عادة من الشبكة لتظهر تفاصيلها هنا مع calendar heatmap وstreak summary.
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                        Preview Timeline
                                    </div>
                                    {habitPreview ? (
                                        <>
                                            <div className="mt-4 rounded-[24px] bg-white p-4 dark:bg-slate-900">
                                                <MiniCalendar
                                                    completionDates={habitPreview.stats.completionDates}
                                                    period={habitPeriod}
                                                />
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                                                    <div className="text-xs text-slate-400 dark:text-slate-500">
                                                        Last completion
                                                    </div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                                        {habitPreview.habit_last_completion_at
                                                            ? formatDate(habitPreview.habit_last_completion_at)
                                                            : '—'}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                                                    <div className="text-xs text-slate-400 dark:text-slate-500">
                                                        Coverage
                                                    </div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                                                        {Math.round(
                                                            (habitPreview.stats.periodCompletions /
                                                                Math.max(1, habitPeriod)) *
                                                                100
                                                        )}%
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                            لا يوجد Drill-Down محدد الآن.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search + Sort */}
                        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_14px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_14px_50px_rgba(2,6,23,0.4)] sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    🔎
                                </div>
                                <input
                                    type="text"
                                    value={habitSearchTerm}
                                    onChange={(e) =>
                                        setHabitSearchTerm(e.target.value)
                                    }
                                    placeholder="ابحث في العادات..."
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                    ترتيب
                                </span>
                                {(
                                    [
                                        ['streak', '🔥 Streak'],
                                        ['rate', '📊 Rate'],
                                        ['name', '🔤 Name'],
                                    ] as const
                                ).map(([val, label]) => {
                                    const active = habitSortBy === val;
                                    return (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setHabitSortBy(val)}
                                            className={`
                                rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300
                                ${
                                    active
                                        ? 'border border-transparent bg-slate-950 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)] dark:bg-white dark:text-slate-950'
                                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                                }
                            `}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Habits Grid */}
                        {isLoadingHabits ? (
                            <div className="rounded-[30px] border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                جاري تحميل بيانات العادات...
                            </div>
                        ) : filteredAndSortedHabits.length === 0 ? (
                            <div className="rounded-[30px] border border-dashed border-slate-200 bg-slate-50 p-16 text-center dark:border-slate-700 dark:bg-slate-950">
                                <div className="mb-4 text-4xl">💤</div>
                                <div className="text-lg font-black text-slate-950 dark:text-white">
                                    لا توجد عادات
                                </div>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    {habitsData.length > 0
                                        ? 'لا توجد نتائج تطابق البحث.'
                                        : 'لم يسجل هذا الموظف أي عادات بعد.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {filteredAndSortedHabits.map((habit) => (
                                    <HabitCard
                                        key={habit.uid}
                                        habit={habit}
                                        period={habitPeriod}
                                        onOpen={() => setSelectedHabit(habit)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Habits Insights */}
                        {habitsData.length > 0 && !isLoadingHabits && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <SectionTitle
                                        title="أفضل العادات أداءً"
                                        subtitle="الأعلى في معدل الإنجاز"
                                    />
                                    <div className="mt-4 space-y-3">
                                        {[...habitsData]
                                            .filter(
                                                (h) =>
                                                    h.stats.completionRate !==
                                                    null
                                            )
                                            .sort(
                                                (a, b) =>
                                                    (b.stats.completionRate ??
                                                        0) -
                                                    (a.stats.completionRate ??
                                                        0)
                                            )
                                            .slice(0, 3)
                                            .map((h) => {
                                                const rate =
                                                    h.stats.completionRate ?? 0;
                                                const rateTone =
                                                    rate >= 70
                                                        ? 'emerald'
                                                        : rate >= 40
                                                          ? 'amber'
                                                          : 'rose';

                                                return (
                                                    <div
                                                        key={h.uid}
                                                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                                                {h.name}
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                                🔥{' '}
                                                                {
                                                                    h.habit_current_streak
                                                                }{' '}
                                                                يوم streak
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={`
                                                rounded-full px-3 py-1 text-sm font-black
                                                ${
                                                    rateTone === 'emerald'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                        : rateTone === 'amber'
                                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                                }
                                            `}
                                                        >
                                                            {rate}%
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
                                    <SectionTitle
                                        title="تحتاج انتباه"
                                        subtitle="عادات بدون streak نشط"
                                    />
                                    <div className="mt-4 space-y-3">
                                        {habitsData
                                            .filter(
                                                (h) =>
                                                    h.habit_current_streak === 0
                                            )
                                            .slice(0, 3)
                                            .map((h) => (
                                                <button
                                                    key={h.uid}
                                                    type="button"
                                                    onClick={() => setSelectedHabit(h)}
                                                    className="flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-white dark:border-rose-500/20 dark:bg-rose-500/10 dark:hover:border-rose-500/40 dark:hover:bg-slate-900"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                                            {h.name}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            أفضل streak:{' '}
                                                            {
                                                                h.habit_best_streak
                                                            }{' '}
                                                            يوم
                                                        </div>
                                                    </div>
                                                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                                        💤 Inactive
                                                    </span>
                                                </button>
                                            ))}

                                        {habitsData.filter(
                                            (h) => h.habit_current_streak === 0
                                        ).length === 0 && (
                                            <InsightCard
                                                title="ممتاز!"
                                                body="كل العادات لديها streak نشط حالياً."
                                                tone="emerald"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}


            {selectedHabit && (
                <HabitDrawer
                    habit={selectedHabit}
                    period={habitPeriod}
                    onClose={() => setSelectedHabit(null)}
                    onOpenTask={(habit) =>
                        window.location.assign(`/task/${habit.uid}`)
                    }
                />
            )}
            </div>
        </div>
    );
};

export default UserActivityDashboard;
