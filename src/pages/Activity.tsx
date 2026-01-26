/**
 * Activity Page - Detailed activity timeline and analytics
 * Refactored to use shared components
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
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

// Hooks
import { useTimeline, formatTimelineForChart } from '../hooks/useTrackerData';

// Components
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/dashboard/StatCard';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { ChartGradients } from '../components/charts/ChartGradients';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { RefreshButton } from '../components/shared/RefreshButton';


// Constants
import { containerVariants, itemVariants } from '../constants/animations';

export function ActivityPage() {
    const { data: timelineData, isLoading } = useTimeline();
    const chartData = formatTimelineForChart(timelineData);

    // Calculate totals
    const { totalActive, totalIdle, peakHour, scatterData } = useMemo(() => {
        const active = timelineData?.reduce((acc, curr) => acc + curr.active_seconds, 0) || 0;
        const idle = timelineData?.reduce((acc, curr) => acc + curr.idle_seconds, 0) || 0;

        const scatter = chartData.map((item) => ({
            time: parseInt(item.time.split(':')[0], 10),
            intensity: Math.min(100, Math.round((item.active / 60) * 100)),
            activity: item.active + item.idle,
        })).filter((d) => d.activity > 0);

        const peak = chartData.reduce(
            (max, curr) => (curr.active > (max.active || 0) ? curr : max),
            { time: '-', active: 0 }
        );

        return { totalActive: active, totalIdle: idle, peakHour: peak, scatterData: scatter };
    }, [timelineData, chartData]);

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <PageHeader
                title="Activity Timeline"
                subtitle="Active usage patterns throughout the day"
                actions={<RefreshButton />}
            />


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
                        <StatCard
                            label="Active Duration"
                            value={`${Math.round(totalActive / 60)}m`}
                            numericValue={Math.round(totalActive / 60)}
                            icon={Keyboard}
                            isLoading={isLoading}
                            suffix="m"
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label="Idle Duration"
                            value={`${Math.round(totalIdle / 60)}m`}
                            numericValue={Math.round(totalIdle / 60)}
                            icon={MousePointer}
                            isLoading={isLoading}
                            suffix="m"
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label="Peak Hour"
                            value={isLoading ? '-' : peakHour.time}
                            numericValue={0}
                            icon={ActivityIcon}
                            isLoading={isLoading}
                            useStringValue
                        />
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
                                    <LoadingState message="Loading charts..." />
                                ) : chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} barGap={4}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine
                                                axisLine
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine
                                                axisLine
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '16px' }}
                                                formatter={(value) => (
                                                    <span className="font-display" style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 600 }}>
                                                        {value === 'active' ? 'Active Time' : 'Idle Time'}
                                                    </span>

                                                )}
                                            />
                                            <Bar dataKey="active" fill="url(#emeraldGradient)" stroke="#0f766e" strokeWidth={1} radius={[4, 4, 0, 0]} name="active" animationDuration={1500} />
                                            <Bar dataKey="idle" fill="url(#violetGradient)" stroke="#7c3aed" strokeWidth={1} radius={[4, 4, 0, 0]} name="idle" animationDuration={1500} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyState message="No activity data for today" />
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Scatter Chart */}
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
                                                domain={[0, 24]}
                                                type="number"
                                                tickFormatter={(val) => `${val}:00`}
                                            />
                                            <YAxis
                                                dataKey="intensity"
                                                name="Intensity"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                domain={[0, 100]}
                                                tickFormatter={(val) => `${val}%`}
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
                                    <EmptyState message="No data available" />
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
