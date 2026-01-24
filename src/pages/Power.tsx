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

// Mock power data - apps with their usage time and estimated power
const powerData = [
    { app: 'VS Code', time: 4.5, power: 35, cpu: 8 },
    { app: 'Chrome', time: 2.0, power: 65, cpu: 15 },
    { app: 'Slack', time: 0.75, power: 20, cpu: 3 },
    { app: 'Terminal', time: 1.5, power: 15, cpu: 2 },
    { app: 'Spotify', time: 5.0, power: 25, cpu: 4 },
    { app: 'Discord', time: 0.5, power: 30, cpu: 5 },
];

// Top power consumers with distinct colors
const topConsumers = [
    { app: 'Chrome', power: '65W avg', impact: 'High', color: '#be185d' },
    { app: 'VS Code', power: '35W avg', impact: 'Medium', color: '#a16207' },
    { app: 'Discord', power: '30W avg', impact: 'Medium', color: '#0f766e' },
];

export function Power() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    Energy Vampire
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Power consumption estimates by application
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
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">34W</p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <Cpu size={20} className="text-[#7c3aed]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Avg. CPU</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">12%</p>
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
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">6h 42m</p>
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
                    X: Usage Time | Y: Power Draw | Size: CPU Usage
                </p>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                            <XAxis
                                dataKey="time"
                                name="Time"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}h`}
                                domain={[0, 6]}
                            />
                            <YAxis
                                dataKey="power"
                                name="Power"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}W`}
                                domain={[0, 80]}
                            />
                            <ZAxis dataKey="cpu" range={[100, 600]} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: 'var(--foreground)',
                                    boxShadow: 'var(--shadow-swiss)',
                                }}
                                labelFormatter={(_, payload) => payload[0]?.payload?.app || ''}
                            />
                            <Scatter data={powerData} fill="#7c3aed" fillOpacity={0.8} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* Top Consumers */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Top Energy Consumers
                </h3>
                <div className="space-y-4">
                    {topConsumers.map((item, index) => (
                        <div
                            key={item.app}
                            className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)]"
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white"
                                    style={{ backgroundColor: item.color }}
                                >
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">{item.app}</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">{item.power}</p>
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
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}
