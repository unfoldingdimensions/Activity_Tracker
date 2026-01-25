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
import { EmptyState } from '../components/shared/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// Utils & Constants
import { containerVariantsFast, itemVariantsSubtle } from '../constants/animations';
import { formatDuration } from '../utils/formatters';

type TimeRange = 'today' | 'yesterday' | 'week' | 'prev_week' | 'month';
type ViewMode = 'all' | 'apps';

export function Timeline() {
    const [range, setRange] = useState<TimeRange>('today');
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [showRangePicker, setShowRangePicker] = useState(false);
    const [selectedApp, setSelectedApp] = useState<string | null>(null);

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

        const toLocalIso = (d: Date) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().slice(0, -1);
        };

        return {
            startIso: toLocalIso(start),
            endIso: toLocalIso(end),
            startDate: toLocalIso(start).split('T')[0],
            endDate: toLocalIso(end).split('T')[0],
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
            const date = event.timestamp.split('T')[0];
            const hour = event.timestamp.split('T')[1]?.substring(0, 2) || '00';
            const key = `${date} ${hour}:00`;
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
                                                                <span className="font-semibold text-[var(--foreground)] truncate">
                                                                    {event.process_name?.replace('.exe', '')}
                                                                </span>
                                                                <span className="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                                                                    {event.timestamp
                                                                        .split('T')[1]
                                                                        .substring(0, 8)}
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
                                appUsage.map((app, idx) => (
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
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm transition-transform group-hover:scale-110"
                                                        style={{
                                                            backgroundColor: [
                                                                '#be185d',
                                                                '#a16207',
                                                                '#0f766e',
                                                                '#7c3aed',
                                                                '#1c1917',
                                                            ][idx % 5],
                                                        }}
                                                    >
                                                        {app.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-[var(--foreground)] truncate max-w-[150px]">
                                                            {app.name.replace('.exe', '')}
                                                        </p>
                                                        <p className="text-xs text-[var(--muted-foreground)]">
                                                            Application
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
