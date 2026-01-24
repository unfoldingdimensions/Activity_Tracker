import { GlassCard } from '../components/GlassCard';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    Legend,
} from 'recharts';
import { MousePointer, Keyboard, Activity as ActivityIcon } from 'lucide-react';
import { useTimeline, formatTimelineForChart } from '../hooks/useTrackerData';

export function ActivityPage() {
    const { data: timelineData, isLoading } = useTimeline();
    const chartData = formatTimelineForChart(timelineData);

    // Calculate totals
    const totalActive = timelineData?.reduce((acc, curr) => acc + curr.active_seconds, 0) || 0;
    const totalIdle = timelineData?.reduce((acc, curr) => acc + curr.idle_seconds, 0) || 0;

    // Create scatter data from timeline
    const scatterData = chartData.map(item => ({
        time: parseInt(item.time.split(':')[0], 10),
        intensity: Math.min(100, Math.round((item.active / 60) * 100)), // % active in hour
        activity: item.active + item.idle,
    }));

    const peakHour = chartData.reduce((max, curr) =>
        curr.active > (max.active || 0) ? curr : max
        , { time: '-', active: 0 });

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    Activity Timeline
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Active usage patterns throughout the day
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Keyboard size={20} className="text-[#0f766e]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Active Duration</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {Math.round(totalActive / 60)}m
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <MousePointer size={20} className="text-[#7c3aed]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Idle Duration</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {Math.round(totalIdle / 60)}m
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <ActivityIcon size={20} className="text-[#a16207]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Peak Hour</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {peakHour.time}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Bar Chart */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Hourly Activity Breakdown (Minutes)
                </h3>
                <div className="h-72">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                            Loading activity data...
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={4}>
                                <XAxis
                                    dataKey="time"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-swiss)',
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '16px' }}
                                    formatter={(value) => (
                                        <span style={{ color: 'var(--foreground)', fontSize: '12px' }}>
                                            {value === 'active' ? 'Active Time' : 'Idle Time'}
                                        </span>
                                    )}
                                />
                                <Bar dataKey="active" fill="#0f766e" radius={[4, 4, 0, 0]} name="active" />
                                <Bar dataKey="idle" fill="#7c3aed" radius={[4, 4, 0, 0]} name="idle" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                            No activity data for today
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Intensity Scatter */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Activity Intensity Map
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Bubble size represents total duration per hour
                </p>
                <div className="h-64">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <XAxis
                                    dataKey="time"
                                    name="Hour"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, 24]}
                                    type="number"
                                    tickFormatter={(val) => `${val}:00`}
                                />
                                <YAxis
                                    dataKey="intensity"
                                    name="Intensity"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, 100]}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <ZAxis dataKey="activity" range={[50, 400]} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-swiss)',
                                    }}
                                    formatter={(value, name) => [
                                        name === 'Intensity' ? `${value}% Active` : `${value} min Total`,
                                        name
                                    ]}
                                    labelFormatter={(val) => `Hour ${val}:00`}
                                />
                                <Scatter data={scatterData} fill="#a16207" fillOpacity={0.8} name="Activity" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                            No data available
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
