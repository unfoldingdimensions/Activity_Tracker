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

// Mock hourly input data
const hourlyInputData = [
    { hour: '09', keystrokes: 1200, clicks: 340 },
    { hour: '10', keystrokes: 980, clicks: 280 },
    { hour: '11', keystrokes: 1450, clicks: 420 },
    { hour: '12', keystrokes: 200, clicks: 50 },
    { hour: '13', keystrokes: 350, clicks: 120 },
    { hour: '14', keystrokes: 1100, clicks: 380 },
    { hour: '15', keystrokes: 1680, clicks: 510 },
    { hour: '16', keystrokes: 1320, clicks: 390 },
];

// Mock intensity scatter data
const intensityData = [
    { time: 9, intensity: 75, activity: 1200 },
    { time: 10, intensity: 60, activity: 980 },
    { time: 11, intensity: 90, activity: 1450 },
    { time: 12, intensity: 15, activity: 200 },
    { time: 13, intensity: 25, activity: 350 },
    { time: 14, intensity: 70, activity: 1100 },
    { time: 15, intensity: 95, activity: 1680 },
    { time: 16, intensity: 80, activity: 1320 },
];

export function ActivityPage() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    Input Activity
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Keyboard and mouse usage patterns
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
                            <p className="text-sm text-[var(--muted-foreground)]">Total Keystrokes</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">8,280</p>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]">
                            <MousePointer size={20} className="text-[#7c3aed]" />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted-foreground)]">Total Clicks</p>
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">2,490</p>
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
                            <p className="text-2xl font-bold font-display text-[var(--foreground)]">3 PM</p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Bar Chart */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Hourly Input Breakdown
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyInputData} barGap={4}>
                            <XAxis
                                dataKey="hour"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}:00`}
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
                                        {value === 'keystrokes' ? 'Keystrokes' : 'Clicks'}
                                    </span>
                                )}
                            />
                            <Bar dataKey="keystrokes" fill="#0f766e" radius={[4, 4, 0, 0]} name="keystrokes" />
                            <Bar dataKey="clicks" fill="#7c3aed" radius={[4, 4, 0, 0]} name="clicks" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>

            {/* Intensity Scatter */}
            <GlassCard className="p-6" hover={false}>
                <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                    Activity Intensity Map
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Bubble size represents total activity volume
                </p>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                            <XAxis
                                dataKey="time"
                                name="Hour"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}:00`}
                                domain={[8, 17]}
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
                            />
                            <Scatter data={intensityData} fill="#a16207" fillOpacity={0.8} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>
        </div>
    );
}
