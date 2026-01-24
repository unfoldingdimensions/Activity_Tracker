import { GlassCard } from '../components/GlassCard';
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
import { Zap, Cpu, Monitor } from 'lucide-react';
import { useAppUsage, useDailyStats } from '../hooks/useTrackerData';
import { formatDuration } from '../api/tauri';
import { motion } from 'framer-motion';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Skeleton } from '../components/ui/Skeleton';

// Estimate power based on app name (W)
const estimatePower = (appName: string): number => {
    const n = appName.toLowerCase();

    if (n.includes('game') || n.includes('steam') || n.includes('unity')) return 80;
    if (n.includes('chrome') || n.includes('edge') || n.includes('firefox')) return 45;
    if (n.includes('code') || n.includes('studio') || n.includes('idea')) return 35;
    if (n.includes('slack') || n.includes('teams') || n.includes('discord')) return 25;
    if (n.includes('terminal') || n.includes('cmd') || n.includes('powershell')) return 15;
    if (n.includes('video') || n.includes('player') || n.includes('vlc')) return 30;

    return 15; // Default low usage
};

// Estimate CPU load based on app name (%)
const estimateCPU = (appName: string): number => {
    const n = appName.toLowerCase();

    if (n.includes('game')) return 40;
    if (n.includes('chrome')) return 15;
    if (n.includes('code')) return 10;
    if (n.includes('slack')) return 5;
    return 2;
};

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

export function Power() {
    const { data: appUsage, isLoading } = useAppUsage();
    const { data: stats } = useDailyStats();

    // Transform real data
    const powerData = appUsage?.map(app => {
        const hours = app.seconds / 3600;
        const power = estimatePower(app.name);
        const cpu = estimateCPU(app.name);

        return {
            app: app.name,
            time: parseFloat(hours.toFixed(2)),
            power,
            cpu,
            weightedImpact: power * hours
        };
    }).filter(d => d.time > 0.01) || []; // Filter very small usage

    // Sort by impact (Power * Time)
    const sortedByImpact = [...powerData].sort((a, b) => b.weightedImpact - a.weightedImpact);
    const topConsumers = sortedByImpact.slice(0, 5).map((item, i) => {
        const colors = ['#be185d', '#a16207', '#0f766e', '#7c3aed', '#1c1917'];
        const impactLabel = item.weightedImpact > 50 ? 'High' : item.weightedImpact > 10 ? 'Medium' : 'Low';

        return {
            app: item.app,
            power: `${item.power}W avg`,
            usage: `${item.time}h`,
            impact: impactLabel,
            color: colors[i % colors.length]
        };
    });

    // Calculate totals
    const avgPower = powerData.length > 0 ? Math.round(powerData.reduce((acc, curr) => acc + curr.power, 0) / powerData.length) : 0;
    const avgCPU = powerData.length > 0 ? Math.round(powerData.reduce((acc, curr) => acc + curr.cpu, 0) / powerData.length) : 0;

    return (
        <div className="flex flex-col min-h-full">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-4 border-b border-[var(--border)]/50 transition-all">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                        Energy Vampire
                    </h2>
                    <p className="text-[var(--muted-foreground)] mt-1">
                        Estimated power consumption based on activity
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
                                    <Zap size={20} className="text-[#a16207]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Avg. Power</p>
                                    <div className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
                                        {isLoading ? <Skeleton variant="text" className="h-8 w-16" /> : (
                                            <>
                                                <AnimatedNumber value={avgPower} />W
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
                                    <Cpu size={20} className="text-[#7c3aed]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Avg. CPU Est.</p>
                                    <div className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
                                        {isLoading ? <Skeleton variant="text" className="h-8 w-16" /> : (
                                            <>
                                                <AnimatedNumber value={avgCPU} />%
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
                                    <Monitor size={20} className="text-[#0f766e]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--muted-foreground)]">Screen Time</p>
                                    <p className="text-2xl font-bold font-display text-[var(--foreground)]">
                                        {stats ? formatDuration(stats.total_active_seconds) : '0m'}
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
                                    <div className="h-full flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Skeleton className="w-full h-48 rounded-lg opacity-20" />
                                            <p className="text-[var(--muted-foreground)]">Estimating power draw...</p>
                                        </div>
                                    </div>
                                ) : powerData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
                                            <XAxis
                                                dataKey="time"
                                                name="Time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                tickFormatter={(value) => `${value}h`}
                                                type="number"
                                                domain={[0, 'auto']}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <YAxis
                                                dataKey="power"
                                                name="Power"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={true}
                                                axisLine={true}
                                                tickFormatter={(value) => `${value}W`}
                                                domain={[0, 100]}
                                                style={{ fontFamily: 'var(--font-body)' }}
                                            />
                                            <ZAxis dataKey="cpu" range={[100, 1000]} name="CPU" />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Scatter
                                                name="Apps"
                                                data={powerData}
                                                fill="#7c3aed"
                                                fillOpacity={0.6}
                                                stroke="#7c3aed"
                                                strokeWidth={1}
                                                shape="circle"
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

                    {/* Top Consumers */}
                    <motion.div variants={itemVariants}>
                        <GlassCard className="p-6" hover={false}>
                            <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                                Top Energy Consumers
                            </h3>
                            <div className="space-y-4">
                                {topConsumers.length > 0 ? topConsumers.map((item, index) => (
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
                                                <p className="text-sm text-[var(--muted-foreground)]">
                                                    Est. {item.power} • {item.usage} usage
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className="px-3 py-1 rounded-full text-sm font-medium"
                                            style={{
                                                backgroundColor: `${item.color}20`,
                                                color: item.color,
                                            }}
                                        >
                                            {item.impact}
                                        </span>
                                    </motion.div>
                                )) : (
                                    <p className="text-[var(--muted-foreground)] text-center py-4">No data yet</p>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
