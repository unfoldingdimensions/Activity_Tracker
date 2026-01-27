/**
 * AppUsageChart - Donut chart showing app usage distribution with interactive legend
 * Extracted from Dashboard.tsx for reusability
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard';
import { ChartTooltip } from '../charts/ChartTooltip';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../shared/EmptyState';
import { AppIcon } from '../shared/AppIcon';
import { memo } from 'react';


export interface AppUsageDataPoint {
    name: string;
    value: number;
    color: string;
}

export interface AppUsageChartProps {
    /** Chart data array */
    data: AppUsageDataPoint[];
    /** Loading state */
    isLoading?: boolean;
    /** Chart title */
    title?: string;
    /** Show legend below chart */
    showLegend?: boolean;
    /** Click handler for legend items */
    onAppClick?: (appName: string) => void;
}

export const AppUsageChart = memo(function AppUsageChart({
    data,
    isLoading = false,
    title = 'App Usage',
    showLegend = true,
    onAppClick,
}: AppUsageChartProps) {
    const hasData = data.length > 0;

    return (
        <GlassCard className="p-6 h-full" hover={false}>
            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                {title}
            </h3>
            <div className="h-48">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <Skeleton variant="circular" className="w-32 h-32" />
                    </div>
                ) : hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                cornerRadius={4}
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState message="No data yet" />
                )}
            </div>

            {/* Legend */}
            {showLegend && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-hide">
                    {isLoading ? (
                        <>
                            <Skeleton variant="text" className="h-8 w-full" />
                            <Skeleton variant="text" className="h-8 w-full" />
                            <Skeleton variant="text" className="h-8 w-full" />
                        </>
                    ) : (
                        data.map((app) => (
                            <motion.div
                                whileHover={{ scale: 1.02, x: 2 }}
                                key={app.name}
                                className="flex items-center justify-between text-sm group cursor-pointer hover:bg-[var(--secondary)]/50 rounded-lg p-2 transition-colors"
                                onClick={() => onAppClick?.(app.name)}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full ring-2 ring-transparent group-hover:ring-[var(--border)] transition-all"
                                        style={{ backgroundColor: app.color }}
                                    />
                                    <AppIcon processName={app.name} size={16} />
                                    <span className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors truncate max-w-[120px] font-semibold font-display">
                                        {app.name}
                                    </span>
                                </div>

                                <span className="text-[var(--foreground)] font-bold font-mono">
                                    {app.value}m
                                </span>
                            </motion.div>
                        ))
                    )}
                </div>
            )}
        </GlassCard>
    );
});
