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
    CartesianGrid,
} from 'recharts';
import { Monitor, MousePointer, Keyboard, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    useAppUsage,
    useDailyStats,
    useTimeline,
    formatStatsForCards,
    formatAppUsageForChart,
} from '../hooks/useTrackerData';
import { useState } from 'react';
import { InputHistoryModal } from '../components/InputHistoryModal';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { ChartGradients } from '../components/charts/ChartGradients';
import { Skeleton } from '../components/ui/Skeleton';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export function Dashboard() {
    // Local state
    const [showInputModal, setShowInputModal] = useState(false);

    // Fetch live data from backend
    const { data: appUsageRaw, isLoading: appLoading } = useAppUsage();
    const { data: dailyStats, isLoading: statsLoading } = useDailyStats();
    const { data: timelineRaw } = useTimeline();

    // Format data for display
    const formattedStats = formatStatsForCards(dailyStats);
    const appUsageData = formatAppUsageForChart(appUsageRaw);

    // Transform timeline data for Focus Flow chart
    const timelineData = timelineRaw?.map(segment => {
        const total = segment.active_seconds + segment.idle_seconds;
        const focus = total > 0 ? Math.round((segment.active_seconds / total) * 100) : 0;
        return {
            time: segment.time,
            focus,
            distraction: 100 - focus,
        };
    }) || [];

    // Stats cards configuration
    const stats = [
        {
            label: 'Screen Time',
            value: formattedStats.screenTime, // This is a string like "2h 30m"
            numericValue: dailyStats?.total_active_seconds || 0, // Fallback for numeric animation if needed, but string format is hard to animate directly
            icon: Monitor,
            change: 'today',
            positive: true,
            clickable: false,
        },
        {
            label: 'Mouse Clicks',
            value: formattedStats.mouseActivity,
            numericValue: parseInt(formattedStats.mouseActivity.replace(/,/g, ''), 10) || 0,
            icon: MousePointer,
            change: 'clicks',
            positive: true,
            clickable: true,
        },
        {
            label: 'Keystrokes',
            value: formattedStats.keystrokes,
            numericValue: parseInt(formattedStats.keystrokes.replace(/,/g, ''), 10) || 0,
            icon: Keyboard,
            change: 'today',
            positive: true,
            clickable: true,
        },
        {
            label: 'Focus Score',
            value: `${formattedStats.focusScore}%`,
            numericValue: formattedStats.focusScore,
            icon: Zap,
            change: 'score',
            positive: formattedStats.focusScore >= 50,
            clickable: false,
        },
    ];

    const isLoading = appLoading || statsLoading;

    return (
        <div className="flex flex-col min-h-full">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-6 border-b border-[var(--border)]/50 transition-all">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                        The Pulse
                    </h2>
                    <p className="text-[var(--muted-foreground)] mt-1">
                        Your productivity overview for today
                    </p>
                </motion.div>
            </div>

            {/* Content */}
            <div className="p-8 pt-6 space-y-8 flex-1">
                {/* Stats Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    {stats.map((stat) => (
                        <motion.div key={stat.label} variants={itemVariants}>
                            <GlassCard
                                className={`p-5 group relative overflow-hidden ${stat.clickable ? 'cursor-pointer hover:border-[var(--foreground)]/20 active:scale-95 transition-all' : ''}`}
                                spotlight
                                onClick={() => {
                                    if (stat.clickable) setShowInputModal(true);
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm text-[var(--muted-foreground)]">{stat.label}</p>
                                        <div className="text-2xl font-bold font-display mt-1 text-[var(--foreground)]">
                                            {isLoading ? (
                                                <Skeleton variant="text" className="h-8 w-24" />
                                            ) : (
                                                stat.label === 'Screen Time' ? (
                                                    stat.value
                                                ) : (
                                                    <div className="flex items-center">
                                                        <AnimatedNumber value={stat.numericValue} />
                                                        {stat.label === 'Focus Score' && '%'}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                                        <stat.icon size={20} className="text-[var(--foreground)]" />
                                    </div>
                                </div>
                                <p className="text-xs mt-3 font-medium text-[var(--muted-foreground)]">
                                    {stat.change}
                                </p>
                            </GlassCard>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Input History Modal */}
                {showInputModal && (
                    <InputHistoryModal onClose={() => setShowInputModal(false)} />
                )}

                {/* Charts Row */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                    {/* Focus Timeline */}
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <GlassCard className="p-6 h-full flex flex-col" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                                Focus Flow
                            </h3>
                            <div className="flex-1 min-h-[300px]">
                                <ChartGradients />
                                {timelineData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timelineData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                minTickGap={30}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                tickFormatter={(value) => `${value}%`}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '16px' }}
                                                formatter={(value) => (
                                                    <span style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                                                        {value === 'focus' ? 'Focus Session' : 'Distraction / Idle'}
                                                    </span>
                                                )}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="focus"
                                                stackId="1"
                                                stroke="#0f766e"
                                                fill="url(#emeraldGradient)"
                                                strokeWidth={3}
                                                name="focus"
                                                animationDuration={1500}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="distraction"
                                                stackId="1"
                                                stroke="#a16207"
                                                fill="url(#amberGradient)"
                                                strokeWidth={3}
                                                name="distraction"
                                                animationDuration={1500}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Skeleton className="w-48 h-48 rounded-full opacity-20" />
                                                <p>Loading timeline...</p>
                                            </div>
                                        ) : 'No activity recorded yet'}
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* App Usage Pie */}
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-6 h-full" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                                App Usage
                            </h3>
                            <div className="h-48">
                                {appUsageData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={appUsageData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                cornerRadius={4}
                                                stroke="none"
                                            >
                                                {appUsageData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<ChartTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                                        {isLoading ? <Skeleton variant="circular" className="w-32 h-32" /> : 'No data yet'}
                                    </div>
                                )}
                            </div>
                            {/* Legend */}
                            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-hide">
                                {isLoading ? (
                                    <>
                                        <Skeleton variant="text" className="h-8 w-full" />
                                        <Skeleton variant="text" className="h-8 w-full" />
                                        <Skeleton variant="text" className="h-8 w-full" />
                                    </>
                                ) : appUsageData.map((app) => (
                                    <motion.div
                                        whileHover={{ scale: 1.02, x: 2 }}
                                        key={app.name}
                                        className="flex items-center justify-between text-sm group cursor-pointer hover:bg-[var(--secondary)]/50 rounded-lg p-2 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full ring-2 ring-transparent group-hover:ring-[var(--border)] transition-all"
                                                style={{ backgroundColor: app.color }}
                                            />
                                            <span className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors truncate max-w-[120px] font-medium">
                                                {app.name}
                                            </span>
                                        </div>
                                        <span className="text-[var(--foreground)] font-bold font-mono">
                                            {app.value}m
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>

                {/* Focus Score */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                >
                    <GlassCard className="p-6" hover={false} spotlight>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                                    Today's Focus Score
                                </h3>
                                <p className="text-[var(--muted-foreground)] text-sm mt-1">
                                    Based on your active vs idle time ratio
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-5xl font-bold font-display text-gradient flex items-center justify-end">
                                    {isLoading ? (
                                        <Skeleton variant="text" className="h-12 w-20" />
                                    ) : (
                                        <AnimatedNumber value={formattedStats.focusScore} />
                                    )}
                                </div>
                                <p className="text-[var(--muted-foreground)] text-sm">out of 100</p>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        </div >
    );
}
