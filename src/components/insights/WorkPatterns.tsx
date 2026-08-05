import React, { useMemo } from 'react';
import { GlassCard } from '../GlassCard';
import { useInputHistory, useAppUsage } from '../../hooks/useTrackerData';
import { Activity, Brain } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { formatAppUsageForChart } from '../../hooks/useTrackerData';
import { Tooltip } from '../ui/Tooltip';
import { parseTimestamp } from '../../utils/formatters';
import type { AppUsageEntry, InputHistoryBucket } from '../../api/tauri';
import type { ChartDataPoint } from '../../types';
import { useVisualTheme } from '../../hooks/useVisualTheme';

export const WorkPatterns: React.FC = () => {
    // 24 hours of input history for the heatmap
    const { data: inputHistory } = useInputHistory(60, true);
    const { data: appUsage } = useAppUsage();
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    // Placeholder buckets so the 24-cell heatmap renders before data arrives
    const heatmapBuckets: InputHistoryBucket[] = inputHistory || Array.from(
        { length: 24 },
        () => ({ keystrokes: 0, mouse_clicks: 0, time: new Date().toISOString() })
    );

    const chartData = useMemo(() => formatAppUsageForChart(appUsage), [appUsage]);

    // Calculate Diversity Index
    const diversityIndex = useMemo(() => {
        if (!appUsage || appUsage.length === 0) return 0;

        const totalTime = appUsage.reduce((acc: number, curr: AppUsageEntry) => acc + curr.seconds, 0);
        if (totalTime === 0) return 0;

        // Count apps with significant usage (> 5%)
        const significantApps = appUsage.filter((app: AppUsageEntry) => (app.seconds / totalTime) > 0.05);
        return significantApps.length;
    }, [appUsage]);

    const cognitiveLoad = useMemo(() => {
        if (!inputHistory) return 'Low';
        const totalInputs = inputHistory.reduce((acc: number, curr: InputHistoryBucket) => acc + (curr.keystrokes || 0), 0);
        const avgInputs = totalInputs / inputHistory.length;

        if (avgInputs > 50 && diversityIndex > 4) return 'High';
        if (avgInputs > 30) return 'Medium';
        return 'Low';
    }, [inputHistory, diversityIndex]);

    // Helper for Heatmap Color
    const getIntensityColor = (inputs: number) => {
        if (inputs === 0) return 'bg-[var(--muted)]';
        if (inputs < 100) return 'bg-emerald-500/20';
        if (inputs < 500) return 'bg-emerald-500/40';
        if (inputs < 1000) return 'bg-emerald-500/60';
        return 'bg-emerald-500';
    };

    /* ---------- Flat: diversity & load band, bars not donuts ---------- */
    if (isFlat) {
        const topApp = appUsage && appUsage.length > 0 ? appUsage[0].name.replace(/\.exe$/i, '') : null;
        return (
            <div>
                <div className="flex items-baseline justify-between">
                    <h3 className="section-title text-[var(--foreground)]">Work patterns</h3>
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">DIVERSITY & LOAD</span>
                </div>
                <div className="mt-5 space-y-4 max-w-[420px]">
                    <div>
                        <div className="flex justify-between text-[11.5px]">
                            <span className="text-[var(--muted-foreground)]">App diversity</span>
                            <span className="font-mono font-bold text-[var(--foreground)]">{diversityIndex} apps</span>
                        </div>
                        <div className="mt-2 h-[3px] bg-[var(--border)]">
                            <div className="h-full" style={{ width: `${Math.min(100, diversityIndex * 15)}%`, backgroundColor: 'var(--foreground)', opacity: 0.6 }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[11.5px]">
                            <span className="text-[var(--muted-foreground)]">Cognitive load</span>
                            <span className={`font-mono font-bold ${cognitiveLoad === 'High' ? 'text-[var(--accent-negative)]' : cognitiveLoad === 'Medium' ? 'text-[var(--accent-warning)]' : 'text-[var(--accent-focus)]'}`}>
                                {cognitiveLoad}
                            </span>
                        </div>
                        <div className="mt-2 h-[3px] bg-[var(--border)]">
                            <div
                                className="h-full"
                                style={{
                                    width: cognitiveLoad === 'High' ? '80%' : cognitiveLoad === 'Medium' ? '50%' : '20%',
                                    backgroundColor: cognitiveLoad === 'High' ? 'var(--accent-negative)' : cognitiveLoad === 'Medium' ? 'var(--accent-warning)' : 'var(--accent-focus)',
                                }}
                            />
                        </div>
                    </div>
                    {topApp && (
                        <p className="text-[11.5px] leading-relaxed text-[var(--muted-foreground)] pt-1">
                            {diversityIndex} distinct apps in the last 24 hours — {topApp} leads.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Heatmap */}
            <GlassCard className="p-5 group h-full flex flex-col" spotlight>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Input Intensity</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Last 24 Hours</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Activity size={18} className="text-emerald-400" />
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-1 flex-1 min-h-32">
                    {heatmapBuckets.slice(-24).map((bucket: InputHistoryBucket, i: number) => {
                        const ts = parseTimestamp(bucket.time);
                        const date = ts ? new Date(ts) : null;
                        const dateLabel = date ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                        const startHour = date ? date.toLocaleTimeString([], { hour: 'numeric', hour12: true }) : '';
                        const endHour = date
                            ? new Date(date.getTime() + 3600_000).toLocaleTimeString([], { hour: 'numeric', hour12: true })
                            : '';
                        const timeRangeLabel = `${startHour} - ${endHour}`;

                        return (
                            <Tooltip
                                key={i}
                                content={`${dateLabel} • ${timeRangeLabel}\n${bucket.keystrokes || 0} inputs`}
                            >
                                <div
                                    className={`w-full h-full rounded-sm ${getIntensityColor(bucket.keystrokes || 0)} transition-all hover:scale-110`}
                                />
                            </Tooltip>
                        );
                    })}
                </div>
                <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-2">
                    <span>24h ago</span>
                    <span>Now</span>
                </div>
            </GlassCard>

            {/* Diversity & Cognitive Load */}
            <GlassCard className="p-5 group h-full flex flex-col" spotlight>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Work Patterns</h3>
                        <p className="text-xs text-[var(--muted-foreground)]"> Diversity & Load</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Brain size={18} className="text-purple-400" />
                    </div>
                </div>

                <div className="flex items-center gap-6 flex-1">
                    <div className="w-24 h-24 relative">
                        <ResponsiveContainer width="100%" height="100%" minHeight={96}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry: ChartDataPoint, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        fontSize: '12px'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-[var(--muted-foreground)]">App Diversity</span>
                                <span className="text-[var(--foreground)] font-bold font-display">{diversityIndex} Apps</span>
                            </div>
                            <div className="w-full bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full bg-purple-500"
                                    style={{ width: `${Math.min(100, diversityIndex * 15)}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-[var(--muted-foreground)]">Cognitive Load</span>
                                <span className={`font-bold font-display ${cognitiveLoad === 'High' ? 'text-rose-400' :
                                    cognitiveLoad === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                                    }`}>
                                    {cognitiveLoad}
                                </span>
                            </div>
                            <div className="w-full bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full ${cognitiveLoad === 'High' ? 'bg-rose-500' :
                                        cognitiveLoad === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: cognitiveLoad === 'High' ? '80%' : cognitiveLoad === 'Medium' ? '50%' : '20%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
