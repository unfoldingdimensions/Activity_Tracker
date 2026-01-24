import { GlassCard } from '../components/GlassCard';
import { useTimelineEventsRange, useAppUsageRange, useTimelineRangeForApp } from '../hooks/useTrackerData';
import { formatDuration } from '../api/tauri';
import { Clock, Calendar, CheckCircle2, LayoutList, List, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useState, useMemo } from 'react';

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
            // This week (from Monday)
            const day = now.getDay(); // 0 is Sunday
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

        const startDateStr = toLocalIso(start).split('T')[0];
        const endDateStr = toLocalIso(end).split('T')[0];

        return {
            startIso: toLocalIso(start),
            endIso: toLocalIso(end),
            startDate: startDateStr,
            endDate: endDateStr,
            rangeLabel: label
        };
    }, [range]);

    // Fetch Data
    const { data: events, isLoading: eventsLoading } = useTimelineEventsRange(startIso, endIso, viewMode === 'all' && !selectedApp);
    const { data: appUsage, isLoading: appsLoading } = useAppUsageRange(startDate, endDate, viewMode === 'apps' && !selectedApp);
    const { data: appEvents, isLoading: appEventsLoading } = useTimelineRangeForApp(selectedApp, startIso, endIso, !!selectedApp);

    // Group events logic (reused for both 'all' events and 'appEvents')
    const displayEvents = selectedApp ? appEvents : events;
    const groupedEvents = useMemo(() => {
        if (!displayEvents) return [];
        const groups: { [key: string]: typeof displayEvents } = {};

        displayEvents.forEach(event => {
            const date = event.timestamp.split('T')[0];
            const hour = event.timestamp.split('T')[1]?.substring(0, 2) || '00';
            const key = `${date} ${hour}:00`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(event);
        });

        return Object.entries(groups).map(([time, items]) => ({
            time,
            items
        })).sort((a, b) => b.time.localeCompare(a.time));
    }, [displayEvents]);

    const handleAppClick = (appName: string) => {
        setSelectedApp(appName);
    };

    const isLoading = selectedApp ? appEventsLoading : (viewMode === 'all' ? eventsLoading : appsLoading);

    return (
        <div className="flex flex-col min-h-full animate-fade-in relative">
            {/* Sticky Header */}
            <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-6 border-b border-[var(--border)]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {selectedApp && (
                        <button
                            onClick={() => setSelectedApp(null)}
                            className="p-2 rounded-full bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-[var(--foreground)]"
                            aria-label="Back to App List"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="font-display text-3xl font-bold text-[var(--foreground)] flex items-center gap-2">
                            {selectedApp ? selectedApp.replace('.exe', '') : 'Timeline'}
                        </h2>
                        <p className="text-[var(--muted-foreground)] mt-1">
                            {selectedApp ? `Activity logs for ${rangeLabel}` : 'Detailed activity log'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
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

                        {showRangePicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowRangePicker(false)} />
                                <div className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 animate-fade-in-up">
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
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--secondary)] transition-colors flex items-center justify-between ${range === opt.id ? 'text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'
                                                }`}
                                        >
                                            {opt.label}
                                            {range === opt.id && <CheckCircle2 size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="p-8 pt-6 space-y-6 flex-1">
                {(viewMode === 'all' || selectedApp) ? (
                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="text-center py-10 text-[var(--muted-foreground)]">Loading events...</div>
                        ) : groupedEvents.length > 0 ? (
                            groupedEvents.map((group) => (
                                <div key={group.time} className="animate-fade-in">
                                    <div className="flex items-center gap-2 mb-3 text-[var(--muted-foreground)] text-sm font-medium sticky top-[132px] bg-[var(--background)]/90 backdrop-blur-sm py-2 z-10 border-b border-[var(--border)]/30 w-fit px-3 rounded-r-full shadow-sm">
                                        <Clock size={14} />
                                        {group.time}
                                    </div>
                                    <div className="space-y-3 pl-4 border-l-2 border-[var(--border)]">
                                        {group.items.map((event, idx) => (
                                            <GlassCard
                                                key={`${event.timestamp}-${idx}`}
                                                className="p-4 flex items-center justify-between group"
                                                hover
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-[var(--foreground)]">
                                                            {event.process_name?.replace('.exe', '')}
                                                        </span>
                                                        <span className="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-full">
                                                            {event.timestamp.split('T')[1].substring(0, 8)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--muted-foreground)] mt-1 truncate max-w-md">
                                                        {event.window_title || 'No Title'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                                                        {formatDuration(event.duration_seconds)}
                                                    </span>
                                                </div>
                                            </GlassCard>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-[var(--muted-foreground)]">No activity recorded for this period.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* App Wise View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoading ? (
                            <div className="col-span-full text-center py-10 text-[var(--muted-foreground)]">Loading usage...</div>
                        ) : appUsage && appUsage.length > 0 ? (
                            appUsage.map((app, idx) => (
                                <GlassCard
                                    key={app.name}
                                    className="p-5 relative group cursor-pointer active:scale-95 transition-all"
                                    spotlight
                                    onClick={() => handleAppClick(app.name)}
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: ['#be185d', '#a16207', '#0f766e', '#7c3aed', '#1c1917'][idx % 5] }}
                                            >
                                                {app.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--foreground)]">{app.name.replace('.exe', '')}</p>
                                                <p className="text-xs text-[var(--muted-foreground)]">Application</p>
                                            </div>
                                        </div>
                                        <ArrowUpRight className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                                    </div>
                                    <div className="text-right border-t border-[var(--border)] pt-4">
                                        <p className="text-xs text-[var(--muted-foreground)] mb-1">Total Time</p>
                                        <p className="font-mono font-bold text-2xl text-[var(--foreground)]">{formatDuration(app.seconds)}</p>
                                    </div>
                                </GlassCard>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-10 text-[var(--muted-foreground)]">
                                No app usage data for this period.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
