/**
 * Timeline Page - detailed activity log with app drill-down
 * Refactored to use shared components
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, CheckCircle2, LayoutList, List, ArrowLeft, ArrowUpRight } from 'lucide-react';

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


// Utils & Constants
import { containerVariantsFast, itemVariantsSubtle } from '../constants/animations';
import { formatDuration, formatAppName, toLocalDateString } from '../utils/formatters';
import { useAppClassifier } from '../hooks/useAppClassifier';

type TimeRange = 'today' | 'yesterday' | 'week' | 'prev_week' | 'month';
type ViewMode = 'all' | 'apps';

export function Timeline() {
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
        viewMode === 'all' && !selectedApp
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

    // Header Actions
    const headerActions = (
        <>
            {/* View Switcher - Hidden if drilling down */}
            {!selectedApp && (
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
                </div>
            )}

            {/* Date Picker */}
            <div className="relative">
                <button
                    onClick={() => setShowRangePicker(!showRangePicker)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] rounded-lg hover:bg-[var(--secondary)]/80 transition-colors text-sm font-medium text-[var(--foreground)]"
                >
                    <Calendar size={16} />
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
                                className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1"
                            >
                                {[
                                    { id: 'today', label: 'Today' },
                                    { id: 'yesterday', label: 'Yesterday' },
                                    { id: 'week', label: 'This Week' },
                                    { id: 'prev_week', label: 'Last Week' },
                                    { id: 'month', label: 'This Month' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setRange(opt.id as TimeRange);
                                            setShowRangePicker(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--secondary)] transition-colors flex items-center justify-between ${range === opt.id
                                            ? 'text-[var(--primary)] font-medium'
                                            : 'text-[var(--foreground)]'
                                            }`}
                                    >
                                        {opt.label}
                                        {range === opt.id && <CheckCircle2 size={14} />}
                                    </button>
                                ))}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
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
                <AnimatePresence mode="wait">
                    {viewMode === 'all' || selectedApp ? (
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
