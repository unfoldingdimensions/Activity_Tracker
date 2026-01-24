import { GlassCard } from '../components/GlassCard';
import { Clock, Calendar, TrendingUp } from 'lucide-react';

// Mock timeline data representing activity blocks throughout the day
const timelineBlocks = [
    { start: '09:00', end: '10:30', app: 'VS Code', category: 'productive', project: 'Activity Tracker' },
    { start: '10:30', end: '10:45', app: 'Slack', category: 'communication', project: null },
    { start: '10:45', end: '12:00', app: 'VS Code', category: 'productive', project: 'Activity Tracker' },
    { start: '12:00', end: '13:00', app: 'Idle', category: 'break', project: null },
    { start: '13:00', end: '13:30', app: 'Chrome', category: 'distraction', project: null },
    { start: '13:30', end: '15:00', app: 'VS Code', category: 'productive', project: 'Client Project' },
    { start: '15:00', end: '15:15', app: 'Slack', category: 'communication', project: null },
    { start: '15:15', end: '17:00', app: 'VS Code', category: 'productive', project: 'Activity Tracker' },
];

// Monochrome category colors
const categoryColors: Record<string, string> = {
    productive: '#18181b',
    communication: '#52525b',
    distraction: '#a1a1aa',
    break: '#e4e4e7',
};

export function Timeline() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                        Timeline
                    </h2>
                    <p className="text-[var(--muted-foreground)] mt-1">
                        Your activity breakdown by time
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Calendar size={18} />
                    <span>Today</span>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <TrendingUp size={20} className="text-[var(--foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Productive Time</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">5h 15m</p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Clock size={20} className="text-[var(--foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Communication</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">45m</p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Clock size={20} className="text-[var(--muted-foreground)]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Distractions</p>
                            <p className="text-xl font-bold font-display text-[var(--foreground)]">30m</p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Timeline Visualization */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-6 text-[var(--foreground)]">
                    Activity Blocks
                </h3>
                <div className="space-y-3">
                    {timelineBlocks.map((block, index) => (
                        <div key={index} className="flex items-center gap-4">
                            {/* Time */}
                            <div className="w-24 text-sm text-[var(--muted-foreground)] font-mono">
                                {block.start}
                            </div>
                            {/* Block */}
                            <div
                                className="flex-1 p-4 rounded-lg transition-all duration-250 interactive-hover"
                                style={{
                                    backgroundColor: 'var(--secondary)',
                                    borderLeft: `3px solid ${categoryColors[block.category]}`,
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-[var(--foreground)]">{block.app}</p>
                                        {block.project && (
                                            <p className="text-sm text-[var(--muted-foreground)]">{block.project}</p>
                                        )}
                                    </div>
                                    <span className="text-sm text-[var(--muted-foreground)]">
                                        {block.start} - {block.end}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
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
