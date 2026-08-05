/**
 * Power Page - live CPU sample, power impact map, per-app power table.
 * Same band structure on both skins (glass containers).
 */

import { useMemo } from 'react';
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

// Hooks
import { useAppUsage } from '../hooks/useTrackerData';
import { isTauri } from '../utils/isTauri';
import { getCpuSnapshot } from '../api/tauri';
import { MOCK_CPU_SNAPSHOT } from '../hooks/queries/mockData';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { cn } from '../utils/cn';

// Components
import { PageHeader } from '../components/shared/PageHeader';
import { RefreshButton } from '../components/shared/RefreshButton';
import { EditorialIntro } from '../components/shared/EditorialIntro';
import { CHART_COLORS } from '../constants';

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
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    const { data: appUsage, isLoading } = useAppUsage();

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
    const { powerData, topConsumers, avgPower, totalCpu } = useMemo(() => {
        const data = appUsage?.map((app) => ({
            app: app.name,
            time: parseFloat((app.seconds / 3600).toFixed(2)),
            power: estimatePower(app.name),
            cpu: estimateCPU(app.name),
            weightedImpact: estimatePower(app.name) * (app.seconds / 3600),
        })).filter((d) => d.time > 0.01) || [];

        const sorted = [...data].sort((a, b) => b.weightedImpact - a.weightedImpact);
        const top = sorted.slice(0, 8).map((item, i) => ({
            app: item.app,
            power: item.power,
            usage: item.time,
            impact: item.weightedImpact > 50 ? 'High' : item.weightedImpact > 10 ? 'Medium' : 'Low',
            color: CHART_COLORS[i % CHART_COLORS.length],
            weightedImpact: item.weightedImpact,
        }));

        const power = data.length > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.power, 0) / data.length) : 0;
        const cpu = (cpuSnapshot ?? []).reduce((acc, [, v]) => acc + v, 0);

        return { powerData: data, topConsumers: top, avgPower: power, totalCpu: Math.min(100, Math.round(cpu)) };
    }, [appUsage, cpuSnapshot]);

    const band = isFlat
        ? 'widget px-6 py-5'
        : 'rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 backdrop-blur-md p-6';

    const memUsed = (cpuSnapshot ?? []).length;
    const topConsumer = topConsumers[0];

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader
                title="Power"
                meta={`CPU ${totalCpu}% · ${memUsed} PROCESSES SAMPLED · AVG DRAW ${avgPower}W`}
                actions={<RefreshButton />}
            />

            <EditorialIntro
                sentence={`Across today's apps the estimated draw averages ${avgPower}W${topConsumer ? ` — ${topConsumer.app.replace(/\.exe$/i, '')} asks for the most` : ''}.`}
                note={`ESTIMATES · ${topConsumer ? `${topConsumer.power}W TOP DRAW` : 'NO USAGE YET'}`}
            />

            <div className={cn(isFlat ? 'w-full px-8 pt-2 pb-10 space-y-4' : 'p-8 pt-6 space-y-6 flex-1')}>
                {/* ===== Live CPU + power map ===== */}
                <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2', isFlat && 'py-2')}>
                    {/* Live CPU */}
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Live CPU</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                top processes · 5s cadence
                            </span>
                        </div>
                        <div className="mt-4 space-y-2.5">
                            {cpuSnapshot && cpuSnapshot.length > 0 ? (
                                cpuSnapshot.slice(0, 8).map(([name, cpu]) => (
                                    <div key={name} className="flex items-center gap-3">
                                        <span className="text-[13px] font-semibold text-[var(--foreground)] w-44 truncate">
                                            {name}
                                        </span>
                                        <div className="flex-1 h-[3px] bg-[var(--border)] min-w-0">
                                            <div
                                                className="h-full transition-all duration-700"
                                                style={{ width: `${Math.min(100, cpu * 2)}%`, backgroundColor: 'var(--accent-focus)' }}
                                            />
                                        </div>
                                        <span className="font-mono text-[11px] text-[var(--muted-foreground)] w-12 text-right">
                                            {cpu.toFixed(1)}%
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[12px] text-[var(--muted-foreground)]">Sampling CPU usage…</p>
                            )}
                        </div>
                    </div>

                    {/* Power impact map */}
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Power impact map</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                x hours · y watts · size cpu
                            </span>
                        </div>
                        <div className="mt-4 h-[220px]">
                            {isLoading ? (
                                <div className="text-[12px] text-[var(--muted-foreground)]">Estimating power draw…</div>
                            ) : powerData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 4, left: -14 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
                                        <XAxis
                                            dataKey="time"
                                            name="Time"
                                            tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                            tickLine={false}
                                            axisLine={{ stroke: 'var(--border)' }}
                                            tickFormatter={(v: number) => `${v}h`}
                                            type="number"
                                            domain={[0, 'auto']}
                                        />
                                        <YAxis
                                            dataKey="power"
                                            name="Power"
                                            tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v: number) => `${v}W`}
                                            domain={[0, 100]}
                                        />
                                        <ZAxis dataKey="cpu" range={[80, 600]} name="CPU" />
                                        <Tooltip
                                            cursor={{ stroke: 'var(--foreground)', strokeWidth: 1, opacity: 0.45 }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const p = payload[0].payload as { app: string; time: number; power: number; cpu: number };
                                                return (
                                                    <div className="bg-[var(--background)] border border-[var(--foreground)] px-2.5 py-1.5 font-mono text-[10px] leading-[1.7]">
                                                        <div className="font-bold">{p.app}</div>
                                                        <div>{p.time}h · {p.power}W · cpu {p.cpu}%</div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Scatter name="Apps" data={powerData} fill="var(--accent-support)" fillOpacity={0.55} stroke="var(--accent-support)" strokeWidth={1} shape="circle" isAnimationActive={false} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-[12px] text-[var(--muted-foreground)]/60">No data available.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== Per-app power table ===== */}
                <div className={isFlat ? '' : ''}>
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Top energy consumers</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                est. watts × hours
                            </span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {isLoading && topConsumers.length === 0 && (
                                <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                            )}
                            {!isLoading && topConsumers.length === 0 && (
                                <div className="text-[12px] text-[var(--muted-foreground)]/60">No data yet.</div>
                            )}
                            {topConsumers.map((item, index) => (
                                <div key={item.app} className="flex items-center gap-4">
                                    <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <span className="text-[13px] font-semibold text-[var(--foreground)] w-36 truncate flex-shrink-0">
                                        {item.app.replace(/\.exe$/i, '')}
                                    </span>
                                    <div className="flex-1 h-[3px] bg-[var(--border)] min-w-0">
                                        <div
                                            className="h-full"
                                            style={{ width: `${(item.weightedImpact / (topConsumers[0]?.weightedImpact || 1)) * 100}%`, backgroundColor: item.color }}
                                        />
                                    </div>
                                    <span className="font-mono text-[11px] text-[var(--muted-foreground)] w-16 text-right flex-shrink-0">
                                        {item.power}W · {item.usage}h
                                    </span>
                                    <span
                                        className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 border w-fit flex-shrink-0"
                                        style={{ borderColor: item.impact === 'High' ? 'var(--accent-negative)' : item.impact === 'Medium' ? 'var(--accent-warning)' : 'var(--accent-focus)', color: item.impact === 'High' ? 'var(--accent-negative)' : item.impact === 'Medium' ? 'var(--accent-warning)' : 'var(--accent-focus)' }}
                                    >
                                        {item.impact}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
