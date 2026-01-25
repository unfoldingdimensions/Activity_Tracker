/**
 * FocusFlowChart - Stacked area chart showing focus vs distraction over time
 * Extracted from Dashboard.tsx for reusability
 */

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from 'recharts';
import { GlassCard } from '../GlassCard';
import { ChartGradients } from '../charts/ChartGradients';
import { ChartTooltip } from '../charts/ChartTooltip';
import { LoadingState } from '../shared/LoadingState';
import { EmptyState } from '../shared/EmptyState';
import { FLOW_COLORS } from '../../constants/colors';

export interface FocusFlowDataPoint {
    time: string;
    focus: number;
    distraction: number;
}

export interface FocusFlowChartProps {
    /** Chart data array */
    data: FocusFlowDataPoint[];
    /** Loading state */
    isLoading?: boolean;
    /** Chart title */
    title?: string;
    /** Minimum height for the chart container */
    minHeight?: number;
}

export function FocusFlowChart({
    data,
    isLoading = false,
    title = 'Focus Flow',
    minHeight = 300,
}: FocusFlowChartProps) {
    const hasData = data.length > 0;

    return (
        <GlassCard className="p-6 h-full flex flex-col" hover={false}>
            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                {title}
            </h3>
            <div className="flex-1" style={{ minHeight }}>
                <ChartGradients />
                {isLoading ? (
                    <LoadingState message="Loading timeline..." />
                ) : hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="var(--border)"
                                opacity={0.2}
                            />
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
                                    <span
                                        style={{
                                            color: 'var(--foreground)',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            fontFamily: 'var(--font-body)',
                                        }}
                                    >
                                        {value === 'focus' ? 'Focus Session' : 'Distraction / Idle'}
                                    </span>
                                )}
                            />
                            <Area
                                type="monotone"
                                dataKey="focus"
                                stackId="1"
                                stroke={FLOW_COLORS.focus}
                                fill="url(#emeraldGradient)"
                                strokeWidth={3}
                                name="focus"
                                animationDuration={1500}
                            />
                            <Area
                                type="monotone"
                                dataKey="distraction"
                                stackId="1"
                                stroke={FLOW_COLORS.distraction}
                                fill="url(#amberGradient)"
                                strokeWidth={3}
                                name="distraction"
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState message="No activity recorded yet" />
                )}
            </div>
        </GlassCard>
    );
}
