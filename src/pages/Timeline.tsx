/**
 * Timeline Page - detailed activity log with app drill-down
 * Refactored to use shared components
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, CheckCircle2, LayoutList, List, ArrowLeft, ArrowUpRight, Flame } from 'lucide-react';

// Hooks
import { useTimelineEventsRange, useAppUsageRange, useTimelineRangeForApp } from '../hooks/useTrackerData';

// Shared Components
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/shared/PageHeader';
import { LoadingState } from '../components/shared/LoadingState';
import { RefreshButton } from '../components/shared/RefreshButton';
import { EmptyState } from '../components/shared/EmptyState';

import { Skeleton } from '../components/ui/Skeleton';
import { AppIcon } from '../components/shared/AppIcon';
import { SegTabs } from '../components/ui/SegTabs';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { cn } from '../utils/cn';


// Utils & Constants
import { containerVariantsFast, itemVariantsSubtle } from '../constants/animations';
import { formatDuration, formatAppName, toLocalDateString } from '../utils/formatters';
import { useAppClassifier } from '../hooks/useAppClassifier';
import { computeFocusSessions } from '../utils/focusSessions';
import { DeepWorkSessions } from '../components/dashboard/DeepWorkSessions';
import { FocusCalendar } from '../components/insights/FocusCalendar';
import { EditorialIntro } from '../components/shared/EditorialIntro';

type TimeRange = 'today' | 'yesterday' | 'week' | 'prev_week' | 'month';
type ViewMode = 'all' | 'apps' | 'sessions';

const RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'prev_week', label: 'Last Week' },
    { id: 'month', label: 'This Month' },
];

export function Timeline() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    const [range, setRange] = useState<TimeRange>('today');
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [showRangePicker, setShowRangePicker] = useState(false);
    const [selectedApp, setSelectedApp] = useState<string | null>(null);

    // User-customizable per-app classifier (defaults + overrides)
    const classify = useAppClassifier();

    const categoryLabel = (name: string) => {
        const cls = classify(name);
        return cls === 'focus' ? 'Focus' : cls === 'ignore' ? 'Ignored' : 'Other';
    };
    const categoryTone = (name: string) => {
        const cls = classify(name);
        if (cls === 'focus') return 'var(--accent-focus)';
        if (cls === 'ignore') return 'var(--muted-foreground)';
        return 'var(--accent-warning)';
    };

    // Calculate dates
    const { startIso, endIso, startDate, endDate, rangeLabel } = useMemo(() => {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        let label = 'Today';

        if (range === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'Today';
        } else if (range === 'yesterday') {
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            label = 'Yesterday';
        } else if (range === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'This Week';
        } else if (range === 'prev_week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(diff + 6);
            end.setHours(23, 59, 59, 999);
            label = 'Last Week';
        } else if (range === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'This Month';
        }

        return {
            startIso: start.toISOString(),
            endIso: end.toISOString(),
            startDate: toLocalDateString(start),
            endDate: toLocalDateString(end),
            rangeLabel: label,
        };

    }, [range]);

    // Fetch Data
    const { data: events, isLoading: eventsLoading } = useTimelineEventsRange(
        startIso,
        endIso,
        (viewMode === 'all' || viewMode === 'sessions') && !selectedApp
    );
    const { data: appUsage, isLoading: appsLoading } = useAppUsageRange(
        startDate,
        endDate,
        viewMode === 'apps' && !selectedApp
    );
    const { data: appEvents, isLoading: appEventsLoading } = useTimelineRangeForApp(
        selectedApp,
        startIso,
        endIso,
        !!selectedApp
    );

    // Group events logic
    const displayEvents = selectedApp ? appEvents : events;
    const sessions = useMemo(
        () => computeFocusSessions(events ?? [], classify),
        [events, classify]
    );
    const groupedEvents = useMemo(() => {
        if (!displayEvents) return [];
        const groups: { [key: string]: typeof displayEvents } = {};

        displayEvents.forEach((event) => {
            const dateObj = new Date(event.timestamp);
            const dateStr = dateObj.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
            const hour = dateObj.getHours().toString().padStart(2, '0');
            const key = `${dateStr} ${hour}:00`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(event);
        });

        return Object.entries(groups)
            .map(([time, items]) => ({ time, items }))
            .sort((a, b) => b.time.localeCompare(a.time));
    }, [displayEvents]);


    const isLoading = selectedApp
        ? appEventsLoading
        : viewMode === 'all'
            ? eventsLoading
            : appsLoading;

    const rangePicker = (
        <div className="relative">
            <button
                onClick={() => setShowRangePicker(!showRangePicker)}
                className={cn(
                    'flex items-center gap-2 transition-colors font-mono uppercase tracking-[0.08em]',
                    isFlat
                        ? 'px-3 py-1.5 border border-[var(--border)] text-[10px] text-[var(--foreground)] hover:border-[var(--foreground)]'
                        : 'px-4 py-2 bg-[var(--secondary)] rounded-lg hover:bg-[var(--secondary)]/80 text-sm font-medium text-[var(--foreground)]'
                )}
            >
                <Calendar size={isFlat ? 12 : 16} />
                {rangeLabel}
            </button>

            <AnimatePresence>
                {showRangePicker && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowRangePicker(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={cn(
                                'absolute right-0 mt-2 w-48 z-20 py-1',
                                isFlat
                                    ? 'bg-[var(--background)] border border-[var(--foreground)]'
                                    : 'bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl'
                            )}
                        >
                            {RANGE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setRange(opt.id);
                                        setShowRangePicker(false);
                                    }}
                                    className={cn(
                                        'w-full text-left px-4 py-2 transition-colors flex items-center justify-between font-mono',
                                        isFlat ? 'text-[11px] uppercase tracking-[0.08em] hover:bg-[var(--surface)]' : 'text-sm hover:bg-[var(--secondary)]',
                                        range === opt.id
                                            ? 'text-[var(--accent-focus)] font-bold'
                                            : 'text-[var(--foreground)]'
                                    )}
                                >
                                    {opt.label}
                                    {range === opt.id && <CheckCircle2 size={isFlat ? 12 : 14} />}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );

    // Header Actions
    const headerActions = (
        <>
            {/* View Switcher - Hidden if drilling down */}
            {!selectedApp && (
                isFlat ? (
                    <SegTabs
                        options={[
                            { value: 'all', label: 'All log' },
                            { value: 'apps', label: 'App wise' },
                            { value: 'sessions', label: 'Sessions' },
                        ]}
                        value={viewMode}
                        onChange={setViewMode}
                    />
                ) : (
                    <div className="flex p-1 bg-[var(--secondary)] rounded-lg">
                        <button
                            onClick={() => setViewMode('all')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'all'
                                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <List size={16} />
                            All Log
                        </button>
                        <button
                            onClick={() => setViewMode('apps')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'apps'
                                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <LayoutList size={16} />
                            App Wise
                        </button>
                        <button
                            onClick={() => setViewMode('sessions')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'sessions'
                                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <Flame size={16} />
                            Sessions
                        </button>
                    </div>
                )
            )}

            {rangePicker}
            <RefreshButton />
            <div className="w-[1px] h-6 bg-border/40 mx-1" />
        </>
    );


    const backAction = selectedApp ? (
        <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setSelectedApp(null)}
            className="p-2 rounded-full bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-[var(--foreground)]"
            aria-label="Back to App List"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
        >
            <ArrowLeft size={20} />
        </motion.button>
    ) : undefined;

    /* ---------------- Flat: ruled bands ---------------- */
    if (isFlat) {
        return (
            <div className="flex flex-col min-h-full relative">
                <PageHeader
                    title={selectedApp ? selectedApp.replace('.exe', '') : 'Timeline'}
                    meta={`${rangeLabel} · ${groupedEvents.length} HOUR GROUPS`}
                    actions={headerActions}
                    leftAction={backAction}
                />

                <EditorialIntro
                    sentence={`${rangeLabel} ran in ${groupedEvents.length} hourly ${groupedEvents.length === 1 ? 'block' : 'blocks'} of activity, ${(events ?? []).length} ${(events ?? []).length === 1 ? 'window event' : 'window events'} in all.`}
                    note={`${selectedApp ? selectedApp.replace('.exe', '') : 'all apps'} · ${rangeLabel.toUpperCase()}`}
                />

                <div className="w-full px-8 pt-2 pb-10 space-y-4">
                    <FocusCalendar />

                    {viewMode === 'sessions' && !selectedApp ? (
                        <div className="py-2 border-b border-[var(--border)]">
                            <div className="widget px-6 py-5">
                                <DeepWorkSessions sessions={sessions} isLoading={eventsLoading} />
                            </div>
                        </div>
                    ) : viewMode === 'all' || selectedApp ? (
                        isLoading ? (
                            <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                        ) : groupedEvents.length > 0 ? (
                            <div className="border-b border-[var(--border)]">
                                {groupedEvents.map((group) => (
                                    <div key={group.time} className="border-b border-[var(--border)] last:border-b-0 py-4">
                                        <div className="flex items-baseline justify-between">
                                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                                                {group.time.replace(',', '')}
                                            </span>
                                            <span className="font-mono text-[10px] text-[var(--muted-foreground)]/70">
                                                {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            {group.items.map((event, idx) => (
                                                <div
                                                    key={`${event.timestamp}-${idx}`}
                                                    className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--border)]/70 last:border-b-0"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <AppIcon processName={event.process_name} size={16} />
                                                        <span className="text-[13.5px] font-semibold text-[var(--foreground)] truncate">
                                                            {formatAppName(event.process_name)}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-[var(--muted-foreground)] flex-shrink-0">
                                                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <span className="text-[12px] text-[var(--muted-foreground)] truncate max-w-[280px]">
                                                            {event.window_title || 'No title'}
                                                        </span>
                                                        <span
                                                            className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 border flex-shrink-0"
                                                            style={{ borderColor: categoryTone(event.process_name), color: categoryTone(event.process_name) }}
                                                        >
                                                            {categoryLabel(event.process_name)}
                                                        </span>
                                                        <span className="font-mono text-[12px] font-bold text-[var(--foreground)] flex-shrink-0">
                                                            {formatDuration(event.duration_seconds)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[12px] text-[var(--muted-foreground)]/60">No activity recorded for this period.</p>
                        )
                    ) : (
                        /* App Wise view - ruled table */
                        <div className="border-b border-[var(--border)]">
                            <div className="grid grid-cols-[1fr_120px_120px] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] pb-2 border-b border-[var(--border)]">
                                <span>App</span>
                                <span>Category</span>
                                <span className="text-right">Time</span>
                            </div>
                            {isLoading ? (
                                <div className="text-[12px] text-[var(--muted-foreground)] py-4">Loading…</div>
                            ) : appUsage && appUsage.length > 0 ? (
                                appUsage.map((app) => (
                                    <button
                                        key={app.name}
                                        onClick={() => setSelectedApp(app.name)}
                                        className="w-full grid grid-cols-[1fr_120px_120px] items-center py-2.5 border-b border-[var(--border)]/70 last:border-b-0 text-left hover:bg-[var(--surface)] transition-colors group"
                                    >
                                        <span className="flex items-center gap-3 min-w-0">
                                            <AppIcon processName={app.name} size={16} />
                                            <span className="text-[13.5px] font-semibold text-[var(--foreground)] truncate">
                                                {formatAppName(app.name)}
                                            </span>
                                        </span>
                                        <span
                                            className="font-mono text-[9px] uppercase tracking-[0.1em] w-fit px-2 py-0.5 border"
                                            style={{ borderColor: categoryTone(app.name), color: categoryTone(app.name) }}
                                        >
                                            {categoryLabel(app.name)}
                                        </span>
                                        <span className="text-right font-mono text-[12px] font-bold text-[var(--foreground)]">
                                            {formatDuration(app.seconds)}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-[12px] text-[var(--muted-foreground)]/60 py-4">No app usage data for this period.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ---------------- Glass ---------------- */
    return (
        <div className="flex flex-col min-h-full relative">
            <PageHeader
                title={selectedApp ? selectedApp.replace('.exe', '') : 'Timeline'}
                subtitle={
                    selectedApp
                        ? `Activity logs for ${rangeLabel}`
                        : 'Detailed activity log'
                }
                actions={headerActions}
                leftAction={backAction}
            />

            <div className="p-8 pt-6 space-y-6 flex-1">
                {/* Year overview - presence patterns */}
                <FocusCalendar />

                <AnimatePresence mode="wait">
                    {viewMode === 'sessions' && !selectedApp ? (
                        <motion.div
                            key="sessions-list"
                            variants={containerVariantsFast}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0 }}
                        >
                            <DeepWorkSessions sessions={sessions} isLoading={eventsLoading} />
                        </motion.div>
                    ) : viewMode === 'all' || selectedApp ? (
                        <motion.div
                            key="timeline-list"
                            variants={containerVariantsFast}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            {isLoading ? (
                                <LoadingState variant="list" count={5} />
                            ) : groupedEvents.length > 0 ? (
                                groupedEvents.map((group) => (
                                    <motion.div key={group.time} variants={itemVariantsSubtle}>
                                        <div className="flex items-center gap-2 mb-3 text-[var(--muted-foreground)] text-sm font-medium sticky top-[132px] bg-[var(--background)]/90 backdrop-blur-sm py-2 z-10 border-b border-[var(--border)]/30 w-fit px-3 rounded-r-full shadow-sm ring-1 ring-[var(--border)]/50">
                                            <Clock size={14} />
                                            {group.time}
                                        </div>
                                        <div className="space-y-3 pl-4 border-l-2 border-[var(--border)]">
                                            {group.items.map((event, idx) => (
                                                <motion.div
                                                    key={`${event.timestamp}-${idx}`}
                                                    whileHover={{ x: 4 }}
                                                >
                                                    <GlassCard
                                                        className="p-4 flex items-center justify-between group"
                                                        hover
                                                        spotlight
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <AppIcon processName={event.process_name} size={16} />
                                                                <span className="font-semibold text-[var(--foreground)] truncate font-display">
                                                                    {formatAppName(event.process_name)}
                                                                </span>
                                                                <span className="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                                                                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}

                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-[var(--muted-foreground)] mt-1 truncate max-w-md">
                                                                {event.window_title || 'No Title'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right pl-4 flex-shrink-0">
                                                            <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                                                                {formatDuration(event.duration_seconds)}
                                                            </span>
                                                        </div>
                                                    </GlassCard>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <EmptyState message="No activity recorded for this period." />
                            )}
                        </motion.div>
                    ) : (
                        /* App Wise View */
                        <motion.div
                            key="app-grid"
                            variants={containerVariantsFast}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {isLoading ? (
                                Array(6)
                                    .fill(0)
                                    .map((_, i) => (
                                        <Skeleton key={i} className="h-32 w-full rounded-xl" />
                                    ))
                            ) : appUsage && appUsage.length > 0 ? (
                                appUsage.map((app) => (
                                    <motion.div

                                        key={app.name}
                                        variants={itemVariantsSubtle}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <GlassCard
                                            className="p-5 relative group cursor-pointer"
                                            spotlight
                                            onClick={() => setSelectedApp(app.name)}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <AppIcon
                                                        processName={app.name}
                                                        size={40}
                                                        className="rounded-lg shadow-sm group-hover:scale-110 transition-transform"
                                                    />
                                                    <div>
                                                        <p className="font-bold text-[var(--foreground)] truncate max-w-[150px] font-display">
                                                            {formatAppName(app.name)}
                                                        </p>
                                                        <p className="text-xs text-[var(--muted-foreground)]">
                                                            {categoryLabel(app.name)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ArrowUpRight
                                                    className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                    size={20}
                                                />
                                            </div>
                                            <div className="text-right border-t border-[var(--border)] pt-4">
                                                <p className="text-xs text-[var(--muted-foreground)] mb-1">
                                                    Total Time
                                                </p>
                                                <p className="font-mono font-bold text-2xl text-[var(--foreground)]">
                                                    {formatDuration(app.seconds)}
                                                </p>
                                            </div>
                                        </GlassCard>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="col-span-full">
                                    <EmptyState message="No app usage data for this period." />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
