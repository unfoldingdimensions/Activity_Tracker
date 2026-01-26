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
import { useState } from 'react';
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
    idle: number;
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

type MetricType = 'focus' | 'distraction' | 'idle';

export function FocusFlowChart({
    data,
    isLoading = false,
    title = 'Focus Flow',
    minHeight = 300,
}: FocusFlowChartProps) {
    const [activeMetrics, setActiveMetrics] = useState<Set<MetricType>>(new Set(['focus', 'distraction', 'idle']));
    const hasData = data.length > 0;

    const toggleMetric = (metric: MetricType) => {
        const next = new Set(activeMetrics);
        if (next.has(metric)) {
            if (next.size > 1) { // Keep at least one metric visible
                next.delete(metric);
            }
        } else {
            next.add(metric);
        }
        setActiveMetrics(next);
    };

    const metrics: { id: MetricType; label: string; color: string }[] = [
        { id: 'focus', label: 'Focus', color: FLOW_COLORS.focus },
        { id: 'distraction', label: 'Other', color: FLOW_COLORS.distraction },
        { id: 'idle', label: 'Idle', color: '#78716c' },
    ];

    return (
        <GlassCard className="p-6 h-full flex flex-col" hover={false}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                    {title}
                </h3>

                <div className="flex flex-wrap items-center gap-3">
                    {metrics.map((m) => {
                        const isActive = activeMetrics.has(m.id);
                        return (
                            <button
                                key={m.id}
                                onClick={() => toggleMetric(m.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border btn-press
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                        : 'bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground grayscale opacity-60'
                                    }
                                `}
                                style={{
                                    boxShadow: isActive ? `0 0 15px ${m.color}30` : 'none',
                                    borderColor: isActive ? m.color : 'transparent',
                                }}
                            >
                                <div
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${isActive ? 'scale-110 shadow-[0_0_8px_currentColor]' : 'scale-90'}`}
                                    style={{
                                        backgroundColor: m.color,
                                        color: m.color
                                    }}
                                />
                                {m.label}
                            </button>
                        );
                    })}
                </div>

            </div>

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
                                fontSize={11}
                                tickLine={true}
                                axisLine={true}
                                interval={0}
                                minTickGap={10}
                                tickFormatter={(tick) => {
                                    // Handle cases where label might already be formatted or is a raw time
                                    if (typeof tick === 'string' && tick.includes(':')) {
                                        // Ensure it's in 1:00 AM format if it's e.g. "13:00"
                                        const [h, m] = tick.split(':');
                                        if (h && m && !tick.includes('AM') && !tick.includes('PM')) {
                                            const hour = parseInt(h);
                                            const ampm = hour >= 12 ? 'PM' : 'AM';
                                            const displayHour = hour % 12 || 12;
                                            return `${displayHour}:00 ${ampm}`;
                                        }
                                        return tick;
                                    }
                                    return tick;
                                }}
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
                                        {value === 'focus' ? 'Focus Session' : value === 'distraction' ? 'Other Activity' : 'Idle / Away'}
                                    </span>

                                )}
                            />
                            {activeMetrics.has('focus') && (
                                <Area
                                    type="monotone"
                                    dataKey="focus"
                                    stroke={FLOW_COLORS.focus}
                                    fill="url(#emeraldGradient)"
                                    fillOpacity={0.6}
                                    strokeWidth={3}
                                    name="focus"
                                    animationDuration={1500}
                                />
                            )}
                            {activeMetrics.has('distraction') && (
                                <Area
                                    type="monotone"
                                    dataKey="distraction"
                                    stroke={FLOW_COLORS.distraction}
                                    fill="url(#amberGradient)"
                                    fillOpacity={0.4}
                                    strokeWidth={2}
                                    name="distraction"
                                    animationDuration={1500}
                                />
                            )}
                            {activeMetrics.has('idle') && (
                                <Area
                                    type="monotone"
                                    dataKey="idle"
                                    stroke="#78716c"
                                    fill="url(#grayGradient)"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                    name="idle"
                                    animationDuration={1500}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState message="No activity recorded yet" />
                )}
            </div>
        </GlassCard>
    );
}

