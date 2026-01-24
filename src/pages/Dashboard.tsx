import { GlassCard } from '../components/GlassCard';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { Monitor, MousePointer, Keyboard, Zap } from 'lucide-react';

// Mock data for the activity timeline
const timelineData = [
    { time: '09:00', focus: 85, distraction: 15 },
    { time: '10:00', focus: 70, distraction: 30 },
    { time: '11:00', focus: 90, distraction: 10 },
    { time: '12:00', focus: 40, distraction: 60 },
    { time: '13:00', focus: 30, distraction: 70 },
    { time: '14:00', focus: 75, distraction: 25 },
    { time: '15:00', focus: 95, distraction: 5 },
    { time: '16:00', focus: 80, distraction: 20 },
];

// Mock data for app usage pie chart
const appUsageData = [
    { name: 'VS Code', value: 35, color: '#1c1917' },
    { name: 'Chrome', value: 25, color: '#a16207' },
    { name: 'Slack', value: 15, color: '#0f766e' },
    { name: 'Terminal', value: 15, color: '#7c3aed' },
    { name: 'Other', value: 10, color: '#78716c' },
];

// Stats cards data
const stats = [
    {
        label: 'Screen Time',
        value: '6h 42m',
        icon: Monitor,
        change: '+12%',
        positive: false,
    },
    {
        label: 'Mouse Activity',
        value: '2,847',
        icon: MousePointer,
        change: '+5%',
        positive: true,
    },
    {
        label: 'Keystrokes',
        value: '12,493',
        icon: Keyboard,
        change: '+23%',
        positive: true,
    },
    {
        label: 'Power Usage',
        value: '34W avg',
        icon: Zap,
        change: '-8%',
        positive: true,
    },
];

export function Dashboard() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="animate-fade-in">
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    The Pulse
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Your productivity overview for today
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                {stats.map((stat) => (
                    <GlassCard
                        key={stat.label}
                        className="p-5 group"
                        spotlight
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-[var(--muted-foreground)]">{stat.label}</p>
                                <p className="text-2xl font-bold font-display mt-1 text-[var(--foreground)] animate-number">
                                    {stat.value}
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                                <stat.icon size={20} className="text-[var(--foreground)]" />
                            </div>
                        </div>
                        <p
                            className={`text-xs mt-3 font-medium ${stat.positive
                                    ? 'text-[#0f766e]'
                                    : 'text-[var(--destructive)]'
                                }`}
                        >
                            {stat.change} from yesterday
                        </p>
                    </GlassCard>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Focus Timeline */}
                <GlassCard className="lg:col-span-2 p-6 animate-fade-in-up" hover={false}>
                    <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                        Focus Flow
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData}>
                                <defs>
                                    <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="distractionGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a16207" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#a16207" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
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
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-lg)',
                                        backdropFilter: 'blur(8px)',
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '16px' }}
                                    formatter={(value) => (
                                        <span style={{ color: 'var(--foreground)', fontSize: '12px' }}>
                                            {value === 'focus' ? 'Focus' : 'Distraction'}
                                        </span>
                                    )}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="focus"
                                    stroke="#0f766e"
                                    fill="url(#focusGradient)"
                                    strokeWidth={2}
                                    name="focus"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="distraction"
                                    stroke="#a16207"
                                    fill="url(#distractionGradient)"
                                    strokeWidth={2}
                                    name="distraction"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* App Usage Pie */}
                <GlassCard className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: '100ms' } as React.CSSProperties}>
                    <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                        App Usage
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={appUsageData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {appUsageData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-lg)',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-4 space-y-2">
                        {appUsageData.map((app) => (
                            <div
                                key={app.name}
                                className="flex items-center justify-between text-sm group cursor-pointer hover-lift rounded-lg p-1 -mx-1"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full transition-transform duration-[var(--duration-fast)] group-hover:scale-125"
                                        style={{ backgroundColor: app.color }}
                                    />
                                    <span className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">
                                        {app.name}
                                    </span>
                                </div>
                                <span className="text-[var(--foreground)] font-medium">
                                    {app.value}%
                                </span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>

            {/* Focus Score */}
            <GlassCard className="p-6 animate-fade-in-up" hover={false} spotlight>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                            Today's Focus Score
                        </h3>
                        <p className="text-[var(--muted-foreground)] text-sm mt-1">
                            Based on your activity patterns and app usage
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-bold font-display text-gradient animate-number">
                            78
                        </div>
                        <p className="text-[var(--muted-foreground)] text-sm">out of 100</p>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
