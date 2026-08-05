
import React from 'react';
import { GlassCard } from '../GlassCard';
import { useAnalytics, getFlowColor } from '../../hooks/useAnalytics';
import { Zap, Layers, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

export const FlowStateMetrics: React.FC = () => {
    const { flowScore, contextSwitchingRate, longestStreak, isFlowing } = useAnalytics();
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    // Determine status text based on Flow Score
    const getFlowStatus = (score: number) => {
        if (score >= 90) return 'Deep focus';
        if (score >= 70) return 'Flowing';
        if (score >= 50) return 'Engaged';
        if (score >= 30) return 'Distracted';
        return 'Fragmented';
    };

    // ---------- Flat: three-cell ruled KPI row ----------
    if (isFlat) {
        const cells = [
            {
                label: 'Flow score',
                value: String(flowScore),
                status: getFlowStatus(flowScore),
                statusColor: getFlowColor(flowScore),
            },
            {
                label: 'Context switches',
                value: String(contextSwitchingRate),
                status:
                    contextSwitchingRate < 10
                        ? 'low fragmentation'
                        : contextSwitchingRate > 30
                          ? 'high fragmentation'
                          : 'moderate switching',
                statusColor: 'var(--muted-foreground)',
            },
            {
                label: 'Longest streak',
                value: String(longestStreak),
                status: `min · ${Math.min(100, Math.round((longestStreak / 60) * 100))}% of 60`,
                statusColor: 'var(--muted-foreground)',
            },
        ];
        return (
            <div className="grid grid-cols-3 widget widget-interactive px-6 py-4 mt-5">
                {cells.map((cell, i) => (
                    <div key={cell.label} className={cn(i > 0 && 'pl-6 border-l border-[var(--border)]')}>
                        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{cell.label}</div>
                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="sub-metric text-[var(--foreground)]">{cell.value}</span>
                            <span className="text-[12px]" style={{ color: cell.statusColor }}>
                                {cell.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Flow Score Card */}
            <GlassCard className="p-5 group relative overflow-hidden h-full flex flex-col" spotlight>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Flow Score</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Real-time focus intensity</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110`}>
                        <Zap size={18} color={getFlowColor(flowScore)} />
                    </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-display text-[var(--foreground)]">{flowScore}</span>
                    <span className="text-sm font-medium" style={{ color: getFlowColor(flowScore) }}>
                        {getFlowStatus(flowScore)}
                    </span>
                </div>

                {/* Animated Background Pulse if Flowing */}
                {isFlowing && (
                    <motion.div
                        className="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 4, repeat: Infinity }}
                    />
                )}
            </GlassCard>

            {/* Context Switching Card */}
            <GlassCard className="p-5 group h-full flex flex-col" spotlight>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Context Switches</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">App changes / last hour</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Layers size={18} className="text-indigo-400" />
                    </div>
                </div>

                <div className="mt-4">
                    <span className="text-3xl font-bold font-display text-[var(--foreground)]">{contextSwitchingRate}</span>
                    <span className="text-sm text-[var(--muted-foreground)] ml-1">switches</span>
                </div>

                <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {contextSwitchingRate < 10 ? (
                        <span className="text-emerald-400">Low fragmentation</span>
                    ) : contextSwitchingRate > 30 ? (
                        <span className="text-rose-400">High fragmentation</span>
                    ) : (
                        <span className="text-amber-400">Moderate switching</span>
                    )}
                </div>
            </GlassCard>

            {/* Streak Card */}
            <GlassCard className="p-5 group h-full flex flex-col" spotlight>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Longest Streak</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Uninterrupted work today</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                        <Clock size={18} className="text-amber-400" />
                    </div>
                </div>

                <div className="mt-4">
                    <span className="text-3xl font-bold font-display text-[var(--foreground)]">{longestStreak}</span>
                    <span className="text-sm text-[var(--muted-foreground)] ml-1">min</span>
                </div>

                <div className="mt-2 w-full bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${Math.min(100, (longestStreak / 60) * 100)}%` }}
                    />
                </div>
            </GlassCard>
        </div>
    );
};
