import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from 'recharts';
import { useState, memo } from 'react';
import { GlassCard } from '../GlassCard';
import { ChartGradients } from '../charts/ChartGradients';
import { ChartTooltip } from '../charts/ChartTooltip';
import { LoadingState } from '../shared/LoadingState';
import { EmptyState } from '../shared/EmptyState';
import { FLOW_COLORS } from '../../constants/colors';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

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

export const FocusFlowChart = memo(function FocusFlowChart({
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
        { id: 'idle', label: 'Idle', color: 'var(--muted-foreground)' },
    ];

    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    /* ---------- Flat: hairline stroke chart, no fills ---------- */
    if (isFlat) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-baseline justify-between">
                    <h3 className="section-title text-[var(--foreground)]">{title}</h3>
                    <div className="flex gap-4">
                        {metrics.map((m) => {
                            const isActive = activeMetrics.has(m.id);
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => toggleMetric(m.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-opacity',
                                        isActive ? 'text-[var(--foreground)]' : 'line-through opacity-60 text-[var(--muted-foreground)]'
                                    )}
                                >
                                    <span className="w-3 h-[1.5px]" style={{ backgroundColor: m.color }} />
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 mt-4" style={{ minHeight }}>
                    {isLoading ? (
                        <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                    ) : hasData ? (
                        <ResponsiveContainer width="100%" height="100%" minHeight={minHeight ?? 250}>
                            <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--border)' }}
                                    interval={data.length > 8 ? Math.ceil(data.length / 6) : 0}
                                    tickFormatter={(tick) => (typeof tick === 'string' && tick.includes(':') ? tick.slice(0, 5) : tick)}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    ticks={[0, 25, 50, 75, 100]}
                                    tick={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v: number) => `${v}`}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'var(--foreground)', strokeWidth: 1, opacity: 0.45 }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const p = payload[0].payload as FocusFlowDataPoint;
                                        return (
                                            <div className="bg-[var(--background)] border border-[var(--foreground)] px-2.5 py-2 font-mono text-[10px] leading-[1.7] tracking-[0.03em] whitespace-nowrap">
                                                <div className="tracking-[0.1em] text-[var(--muted-foreground)]">{label}</div>
                                                <div className="flex justify-between gap-4">
                                                    <span>FOCUS</span>
                                                    <span className="font-bold text-[var(--accent-focus)]">{Math.round(p.focus)}%</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span>OTHER</span>
                                                    <span className="font-bold">{Math.round(p.distraction)}%</span>
                                                </div>
                                                <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                                                    <span>IDLE</span>
                                                    <span>{Math.round(p.idle)}%</span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                {activeMetrics.has('focus') && (
                                    <Line type="monotone" dataKey="focus" stroke={FLOW_COLORS.focus} strokeWidth={1.75} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                                )}
                                {activeMetrics.has('distraction') && (
                                    <Line type="monotone" dataKey="distraction" stroke={FLOW_COLORS.distraction} strokeWidth={1.25} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                                )}
                                {activeMetrics.has('idle') && (
                                    <Line type="monotone" dataKey="idle" stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="3 3" opacity={0.6} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-[12px] text-[var(--muted-foreground)]">No activity recorded yet.</div>
                    )}
                </div>
            </div>
        );
    }

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
                    <ResponsiveContainer width="100%" height="100%" minHeight={minHeight ?? 260}>
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
                                interval={data.length > 8 ? Math.ceil(data.length / 6) : 0}
                                tickFormatter={(tick) => {
                                    if (typeof tick === 'string' && tick.includes(':')) {
                                        const lower = tick.toLowerCase();
                                        if (lower.includes('am') || lower.includes('pm')) {
                                            return tick.replace(/\s+/g, '\n').toUpperCase();
                                        }
                                        const [h, m] = tick.split(':');
                                        if (h && m) {
                                            const hour = parseInt(h);
                                            const ampm = hour >= 12 ? 'PM' : 'AM';
                                            const displayHour = hour % 12 || 12;
                                            const cleanM = m.replace(/[^0-9]/g, '');
                                            return `${displayHour}:${cleanM}\n${ampm}`;
                                        }
                                    }
                                    return tick;
                                }}
                                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
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
                                    stroke="var(--muted-foreground)"
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
});

