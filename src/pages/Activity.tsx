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
    CartesianGrid,
} from 'recharts';
import { MousePointer, Keyboard, Activity as ActivityIcon } from 'lucide-react';
import { useTimeline, formatTimelineForChart } from '../hooks/useTrackerData';
import { motion } from 'framer-motion';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { ChartGradients } from '../components/charts/ChartGradients';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
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
    })).filter(d => d.activity > 0);

    const peakHour = chartData.reduce((max, curr) =>
        curr.active > (max.active || 0) ? curr : max
        , { time: '-', active: 0 });

    return (
        <div className="flex flex-col min-h-full">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-4 border-b border-[var(--border)]/50 transition-all">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                        Activity Timeline
                    </h2>
                    <p className="text-[var(--muted-foreground)] mt-1">
                        Active usage patterns throughout the day
                    </p>
                </motion.div>
            </div>

            {/* Content */}
            <div className="p-8 pt-6 space-y-8 flex-1">
                {/* Stats */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-5" hover spotlight>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--secondary)]">
                                    <Keyboard size={20} className="text-[#0f766e]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Active Duration</p>
                                    <div className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
                                        {isLoading ? (
                                            <Skeleton variant="text" className="h-8 w-20" />
                                        ) : (
                                            <>
                                                <AnimatedNumber value={Math.round(totalActive / 60)} />m
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-5" hover spotlight>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--secondary)]">
                                    <MousePointer size={20} className="text-[#7c3aed]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Idle Duration</p>
                                    <div className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
                                        {isLoading ? (
                                            <Skeleton variant="text" className="h-8 w-20" />
                                        ) : (
                                            <>
                                                <AnimatedNumber value={Math.round(totalIdle / 60)} />m
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-5" hover spotlight>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--secondary)]">
                                    <ActivityIcon size={20} className="text-[#a16207]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Peak Hour</p>
                                    <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                        {isLoading ? <Skeleton variant="text" className="h-8 w-20" /> : peakHour.time}
                                    </p>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                >
                    {/* Bar Chart */}
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-6" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                                Hourly Activity Breakdown (Minutes)
                            </h3>
                            <div className="h-72">
                                <ChartGradients />
                                {isLoading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Skeleton className="w-full h-48 rounded-lg opacity-20" />
                                            <p className="text-[var(--muted-foreground)]">Loading charts...</p>
                                        </div>
                                    </div>
                                ) : chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} barGap={4}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '16px' }}
                                                formatter={(value) => (
                                                    <span style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                                                        {value === 'active' ? 'Active Time' : 'Idle Time'}
                                                    </span>
                                                )}
                                            />
                                            <Bar
                                                dataKey="active"
                                                fill="url(#emeraldGradient)"
                                                stroke="#0f766e"
                                                strokeWidth={1}
                                                radius={[4, 4, 0, 0]}
                                                name="active"
                                                animationDuration={1500}
                                            />
                                            <Bar
                                                dataKey="idle"
                                                fill="url(#violetGradient)"
                                                stroke="#7c3aed"
                                                strokeWidth={1}
                                                radius={[4, 4, 0, 0]}
                                                name="idle"
                                                animationDuration={1500}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                                        No activity data for today
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Intensity Scatter */}
                    <motion.div variants={itemVariants}>
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
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
                                            <XAxis
                                                dataKey="time"
                                                name="Hour"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                domain={[0, 24]}
                                                type="number"
                                                tickFormatter={(val) => `${val}:00`}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <YAxis
                                                dataKey="intensity"
                                                name="Intensity"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                domain={[0, 100]}
                                                tickFormatter={(value) => `${value}%`}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <ZAxis dataKey="activity" range={[50, 400]} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Scatter
                                                data={scatterData}
                                                fill="#a16207"
                                                fillOpacity={0.6}
                                                stroke="#a16207"
                                                strokeWidth={1}
                                                name="Activity"
                                                animationDuration={1500}
                                            />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                                        No data available
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
