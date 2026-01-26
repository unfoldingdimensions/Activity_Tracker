import React, { useMemo, useState } from 'react';
import { GlassCard } from '../GlassCard';
import { useInputHistory, useAppUsage } from '../../hooks/useTrackerData';
import { Activity, Brain } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { formatAppUsageForChart } from '../../hooks/useTrackerData';
import { Tooltip } from '../ui/Tooltip';
import type { AppUsageEntry, InputHistoryBucket } from '../../api/tauri';

export const WorkPatterns: React.FC = () => {
    // 24 hours of input history for the heatmap
    const { data: inputHistory } = useInputHistory(60, true);
    const { data: appUsage } = useAppUsage();

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Heatmap */}
            <GlassCard className="p-5 group" spotlight>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Input Intensity</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Last 24 Hours</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Activity size={18} className="text-emerald-400" />
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-1 h-32">
                    {(inputHistory || Array.from({ length: 24 }).fill({ keystrokes: 0, time: new Date().toISOString() }) as any[]).slice(-24).map((bucket: any, i: number) => {
                        const date = new Date(bucket.time);
                        const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        const startHour = date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
                        const nextDate = new Date(date);
                        nextDate.setHours(date.getHours() + 1);
                        const endHour = nextDate.toLocaleTimeString([], { hour: 'numeric', hour12: true });
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
            <GlassCard className="p-5 group" spotlight>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Work Patterns</h3>
                        <p className="text-xs text-[var(--muted-foreground)]"> Diversity & Load</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Brain size={18} className="text-purple-400" />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry: any, index: number) => (
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
