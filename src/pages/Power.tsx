import { GlassCard } from '../components/GlassCard';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Zap, Cpu, Monitor } from 'lucide-react';
import { useAppUsage, useDailyStats } from '../hooks/useTrackerData';
import { formatDuration } from '../api/tauri';

// Estimate power based on app name (W)
const estimatePower = (appName: string): number => {
    const n = appName.toLowerCase();

    if (n.includes('game') || n.includes('steam') || n.includes('unity')) return 80;
    if (n.includes('chrome') || n.includes('edge') || n.includes('firefox')) return 45;
    if (n.includes('code') || n.includes('studio') || n.includes('idea')) return 35;
    if (n.includes('slack') || n.includes('teams') || n.includes('discord')) return 25;
    if (n.includes('terminal') || n.includes('cmd') || n.includes('powershell')) return 15;
    if (n.includes('video') || n.includes('player') || n.includes('vlc')) return 30;

    return 15; // Default low usage
};

// Estimate CPU load based on app name (%)
const estimateCPU = (appName: string): number => {
    const n = appName.toLowerCase();

    if (n.includes('game')) return 40;
    if (n.includes('chrome')) return 15;
    if (n.includes('code')) return 10;
    if (n.includes('slack')) return 5;
    return 2;
};

export function Power() {
    const { data: appUsage, isLoading } = useAppUsage();
    const { data: stats } = useDailyStats();

    // Transform real data
    const powerData = appUsage?.map(app => {
        const hours = app.seconds / 3600;
        const power = estimatePower(app.name);
        const cpu = estimateCPU(app.name);

        return {
            app: app.name,
            time: parseFloat(hours.toFixed(2)),
            power,
            cpu,
            weightedImpact: power * hours
        };
    }).filter(d => d.time > 0.01) || []; // Filter very small usage

    // Sort by impact (Power * Time)
    const sortedByImpact = [...powerData].sort((a, b) => b.weightedImpact - a.weightedImpact);
    const topConsumers = sortedByImpact.slice(0, 5).map((item, i) => {
        const colors = ['#be185d', '#a16207', '#0f766e', '#7c3aed', '#1c1917'];
        const impactLabel = item.weightedImpact > 50 ? 'High' : item.weightedImpact > 10 ? 'Medium' : 'Low';

        return {
            app: item.app,
            power: `${item.power}W avg`,
            usage: `${item.time}h`,
            impact: impactLabel,
            color: colors[i % colors.length]
        };
    });

    // Calculate totals
    const totalPower = powerData.reduce((acc, curr) => acc + (curr.power * curr.time), 0);
    const avgPower = powerData.length > 0 ? Math.round(powerData.reduce((acc, curr) => acc + curr.power, 0) / powerData.length) : 0;
    const avgCPU = powerData.length > 0 ? Math.round(powerData.reduce((acc, curr) => acc + curr.cpu, 0) / powerData.length) : 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    Energy Vampire
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Estimated power consumption based on activity
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Zap size={20} className="text-[#a16207]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Avg. Power</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {isLoading ? '-' : `${avgPower}W`}
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Cpu size={20} className="text-[#7c3aed]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Avg. CPU Est.</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {isLoading ? '-' : `${avgCPU}%`}
                            </p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Monitor size={20} className="text-[#0f766e]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Screen Time</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                {stats ? formatDuration(stats.total_active_seconds) : '0m'}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Bubble Chart */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-2 text-[var(--foreground)]">
                    Power Impact Map
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    X: Usage Time (hours) | Y: Power Draw (Watts) | Size: CPU Impact
                </p>
                <div className="h-72">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                            Loading power estimates...
                        </div>
                    ) : powerData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                <XAxis
                                    dataKey="time"
                                    name="Time"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}h`}
                                    type="number"
                                    domain={[0, 'auto']}
                                />
                                <YAxis
                                    dataKey="power"
                                    name="Power"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}W`}
                                    domain={[0, 100]}
                                />
                                <ZAxis dataKey="cpu" range={[100, 1000]} name="CPU" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-swiss)',
                                    }}
                                    cursor={{ strokeDasharray: '3 3' }}
                                    formatter={(value, name) => [
                                        name === 'Power' ? `${value} W` : name === 'Time' ? `${value} h` : `${value}%`,
                                        name
                                    ]}
                                    labelFormatter={() => ''}
                                />
                                <Scatter name="Apps" data={powerData} fill="#7c3aed" fillOpacity={0.6} shape="circle" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                            No data available
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Top Consumers */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Top Energy Consumers
                </h3>
                <div className="space-y-4">
                    {topConsumers.length > 0 ? topConsumers.map((item, index) => (
                        <div
                            key={item.app}
                            className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)]"
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white shadow-sm"
                                    style={{ backgroundColor: item.color }}
                                >
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">{item.app}</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Est. {item.power} • {item.usage} usage
                                    </p>
                                </div>
                            </div>
                            <span
                                className="px-3 py-1 rounded-full text-sm font-medium"
                                style={{
                                    backgroundColor: `${item.color}20`,
                                    color: item.color,
                                }}
                            >
                                {item.impact}
                            </span>
                        </div>
                    )) : (
                        <p className="text-[var(--muted-foreground)] text-center py-4">No data yet</p>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
