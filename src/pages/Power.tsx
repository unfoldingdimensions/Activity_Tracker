/**
 * Power Page - Energy consumption estimates based on app usage
 * Refactored to use shared components
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import { Zap, Cpu, Monitor, Activity } from 'lucide-react';

// Hooks
import { useAppUsage, useDailyStats } from '../hooks/useTrackerData';
import { isTauri } from '../utils/isTauri';
import { getCpuSnapshot } from '../api/tauri';
import { MOCK_CPU_SNAPSHOT } from '../hooks/queries/mockData';

// Components
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/dashboard/StatCard';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';

// Utils & Constants
import { formatDuration } from '../utils/formatters';
import { containerVariants, itemVariants, CHART_COLORS } from '../constants';

// ============ Power Estimation Helpers ============

function estimatePower(appName: string): number {
    const n = appName.toLowerCase();
    if (n.includes('game') || n.includes('steam') || n.includes('unity')) return 80;
    if (n.includes('chrome') || n.includes('edge') || n.includes('firefox')) return 45;
    if (n.includes('code') || n.includes('studio') || n.includes('idea')) return 35;
    if (n.includes('slack') || n.includes('teams') || n.includes('discord')) return 25;
    if (n.includes('terminal') || n.includes('cmd') || n.includes('powershell')) return 15;
    if (n.includes('video') || n.includes('player') || n.includes('vlc')) return 30;
    return 15;
}

function estimateCPU(appName: string): number {
    const n = appName.toLowerCase();
    if (n.includes('game')) return 40;
    if (n.includes('chrome')) return 15;
    if (n.includes('code')) return 10;
    if (n.includes('slack')) return 5;
    return 2;
}

// ============ Component ============

export function Power() {
    const { data: appUsage, isLoading } = useAppUsage();
    const { data: stats } = useDailyStats();

    // Live top-CPU processes sampled by the backend (5s cadence)
    const { data: cpuSnapshot } = useQuery({
        queryKey: ['cpuSnapshot'],
        queryFn: async (): Promise<[string, number][]> => {
            if (!isTauri()) return MOCK_CPU_SNAPSHOT;
            return getCpuSnapshot();
        },
        refetchInterval: 5000,
        staleTime: 4000,
    });

    // Transform and calculate data
    const { powerData, topConsumers, avgPower, avgCPU } = useMemo(() => {
        const data = appUsage?.map((app) => ({
            app: app.name,
            time: parseFloat((app.seconds / 3600).toFixed(2)),
            power: estimatePower(app.name),
            cpu: estimateCPU(app.name),
            weightedImpact: estimatePower(app.name) * (app.seconds / 3600),
        })).filter((d) => d.time > 0.01) || [];

        const sorted = [...data].sort((a, b) => b.weightedImpact - a.weightedImpact);
        const top = sorted.slice(0, 5).map((item, i) => ({
            app: item.app,
            power: `${item.power}W avg`,
            usage: `${item.time}h`,
            impact: item.weightedImpact > 50 ? 'High' : item.weightedImpact > 10 ? 'Medium' : 'Low',
            color: CHART_COLORS[i % CHART_COLORS.length],
        }));

        const power = data.length > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.power, 0) / data.length) : 0;
        const cpu = data.length > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.cpu, 0) / data.length) : 0;

        return { powerData: data, topConsumers: top, avgPower: power, avgCPU: cpu };
    }, [appUsage]);

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <PageHeader
                title="Energy Vampire"
                subtitle="Estimated power consumption based on activity"
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
                            label="Avg. Power"
                            value={`${avgPower}W`}
                            numericValue={avgPower}
                            icon={Zap}
                            isLoading={isLoading}
                            suffix="W"
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label="Avg. CPU Est."
                            value={`${avgCPU}%`}
                            numericValue={avgCPU}
                            icon={Cpu}
                            isLoading={isLoading}
                            suffix="%"
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label="Screen Time"
                            value={stats ? formatDuration(stats.total_active_seconds) : '0m'}
                            numericValue={0}
                            icon={Monitor}
                            isLoading={isLoading}
                            useStringValue
                        />
                    </motion.div>
                </motion.div>

                {/* Live CPU Usage */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                >
                    <GlassCard className="p-6" hover={false}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                                <Activity size={20} className="text-cyan-500" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                                    Live CPU Usage
                                </h3>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Top processes right now (sampled every 5s)
                                </p>
                            </div>
                        </div>

                        {cpuSnapshot && cpuSnapshot.length > 0 ? (
                            <div className="space-y-2">
                                {cpuSnapshot.slice(0, 8).map(([name, cpu]) => (
                                    <div key={name} className="flex items-center gap-3">
                                        <span className="text-sm text-[var(--foreground)] w-44 truncate">
                                            {name}
                                        </span>
                                        <div className="flex-1 h-2 rounded-full bg-[var(--secondary)]/60 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-cyan-500/70 transition-all duration-700"
                                                style={{ width: `${Math.min(100, cpu * 2)}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-xs text-[var(--muted-foreground)] w-12 text-right">
                                            {cpu.toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Sampling CPU usage…
                            </p>
                        )}
                    </GlassCard>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                >
                    {/* Bubble Chart */}
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-6" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-2 text-[var(--foreground)]">
                                Power Impact Map
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)] mb-4">
                                X: Usage Time (hours) | Y: Power Draw (Watts) | Size: CPU Impact
                            </p>
                            <div className="h-72">
                                {isLoading ? (
                                    <LoadingState message="Estimating power draw..." />
                                ) : powerData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
                                            <XAxis dataKey="time" name="Time" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}h`} type="number" domain={[0, 'auto']} />
                                            <YAxis dataKey="power" name="Power" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}W`} domain={[0, 100]} />
                                            <ZAxis dataKey="cpu" range={[100, 1000]} name="CPU" />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Scatter name="Apps" data={powerData} fill="#7c3aed" fillOpacity={0.6} stroke="#7c3aed" strokeWidth={1} shape="circle" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyState message="No data available" />
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Top Consumers */}
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-6" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                                Top Energy Consumers
                            </h3>
                            <div className="space-y-4">
                                {topConsumers.length > 0 ? (
                                    topConsumers.map((item, index) => (
                                        <motion.div
                                            key={item.app}
                                            initial={{ x: -10, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)]"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white shadow-sm"
                                                    style={{ backgroundColor: item.color }}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[var(--foreground)]">{item.app}</p>
                                                    <p className="text-sm text-[var(--muted-foreground)]">Est. {item.power} • {item.usage} usage</p>
                                                </div>
                                            </div>
                                            <span
                                                className="px-3 py-1 rounded-full text-sm font-medium"
                                                style={{ backgroundColor: `${item.color}20`, color: item.color }}
                                            >
                                                {item.impact}
                                            </span>
                                        </motion.div>
                                    ))
                                ) : (
                                    <EmptyState message="No data yet" />
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
