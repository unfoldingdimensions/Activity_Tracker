import { GlassCard } from '../components/GlassCard';
import { Clock, Calendar, TrendingUp } from 'lucide-react';
import { useRecentEvents } from '../hooks/useTrackerData';
import { formatDuration } from '../api/tauri';

// Monochrome category colors
const categoryColors: Record<string, string> = {
    productive: '#18181b',
    communication: '#52525b',
    distraction: '#a1a1aa',
    break: '#e4e4e7',
};

const getCategory = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('code') || n.includes('studio') || n.includes('terminal') || n.includes('git')) return 'productive';
    if (n.includes('slack') || n.includes('discord') || n.includes('teams') || n.includes('outlook')) return 'communication';
    if (n.includes('chrome') || n.includes('edge') || n.includes('firefox') || n.includes('brave')) return 'distraction';
    return 'break';
}

export function Timeline() {
    const { data: events, isLoading } = useRecentEvents();

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                        Timeline
                    </h2>
                    <p className="text-[var(--muted-foreground)] mt-1">
                        Recent activity breakdown
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Calendar size={18} />
                    <span>Today</span>
                </div>
            </div>

            {/* Summary Stats (Placeholder for now until we aggregate) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <TrendingUp size={20} className="text-[var(--foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Most Used</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">
                                {events && events.length > 0 ? events[0].process_name : '-'}
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Clock size={20} className="text-[var(--foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Events</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">
                                {events?.length || 0}
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Clock size={20} className="text-[var(--muted-foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Status</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">
                                {isLoading ? 'Loading...' : 'Active'}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Timeline Visualization */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-6 text-[var(--foreground)]">
                    Recent Activity Blocks
                </h3>
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-8 text-[var(--muted-foreground)]">
                            Loading timeline...
                        </div>
                    ) : events && events.length > 0 ? (
                        events.map((event, index) => {
                            const category = getCategory(event.process_name);
                            const startTime = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div key={index} className="flex items-center gap-4">
                                    {/* Time */}
                                    <div className="w-24 text-sm text-[var(--muted-foreground)] font-mono">
                                        {startTime}
                                    </div>
                                    {/* Block */}
                                    <div
                                        className="flex-1 p-4 rounded-lg transition-all duration-250 interactive-hover"
                                        style={{
                                            backgroundColor: 'var(--secondary)',
                                            borderLeft: `3px solid ${categoryColors[category]}`,
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-[var(--foreground)]">
                                                    {event.process_name}
                                                </p>
                                                {event.window_title && (
                                                    <p className="text-sm text-[var(--muted-foreground)] truncate max-w-md">
                                                        {event.window_title}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-sm text-[var(--muted-foreground)]">
                                                {formatDuration(event.duration_seconds)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-[var(--muted-foreground)]">
                            No recent activity recorded.
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6">
                {Object.entries(categoryColors).map(([category, color]) => (
                    <div key={category} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-sm text-[var(--muted-foreground)] capitalize">
                            {category}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
