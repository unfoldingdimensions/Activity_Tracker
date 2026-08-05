/**
 * Activity Page - 6-day columns, metric spark strips, focus calendar,
 * today's apps. Same band structure on both skins (glass containers).
 */

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

// Hooks
import { useTimeline, useInputHistory, useAppUsage } from '../hooks/useTrackerData';
import { useFocusCalendar } from '../hooks/useFocusCalendar';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { cn } from '../utils/cn';

// Components
import { PageHeader } from '../components/shared/PageHeader';
import { RefreshButton } from '../components/shared/RefreshButton';
import { FocusCalendar } from '../components/insights/FocusCalendar';
import { formatDuration } from '../utils/formatters';

/** Tiny inline sparkline: values -> polyline in an 88x22 viewBox */
function Sparkline({ values, color }: { values: number[]; color: string }) {
    const path = useMemo(() => {
        if (values.length < 2) return '';
        const w = 88;
        const h = 22;
        const max = Math.max(...values, 1);
        const pts = values.map((v, i) => {
            const x = (i / (values.length - 1)) * w;
            const y = h - (v / max) * h;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `M${pts.join(' L')}`;
    }, [values]);

    return (
        <svg viewBox="0 0 88 22" width="88" height="22" preserveAspectRatio="none" className="block">
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
    );
}

export function ActivityPage() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    const { data: timelineData, isLoading } = useTimeline();
    const { data: inputHistory } = useInputHistory(60, true);
    const { data: calendarDays } = useFocusCalendar();
    const { data: appUsage } = useAppUsage();

    // 6-day column series from the focus-calendar daily data (real query)
    const weekDays = useMemo(() => {
        const days = (calendarDays ?? []).slice(-6);
        return days.map((d) => {
            const date = new Date(d.date + 'T00:00:00');
            return {
                day: date.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
                minutes: Math.round(d.focusSeconds / 60),
            };
        });
    }, [calendarDays]);

    // Four spark strips (last 24h of hourly buckets)
    const sparks = useMemo(() => {
        const buckets = (inputHistory ?? []).slice(-24);
        const k = buckets.map((b) => b.keystrokes || 0);
        const m = buckets.map((b) => b.mouse_clicks || 0);
        const t = buckets.map((b) => (b.keystrokes || 0) + (b.mouse_clicks || 0));
        const f = (timelineData ?? []).map((s) => {
            const total = (s.active_seconds || 0) + (s.idle_seconds || 0);
            return total > 0 ? Math.round((s.active_seconds / total) * 100) : 0;
        });
        return [
            { label: 'Keystrokes', value: k.reduce((a, b) => a + b, 0).toLocaleString(), values: k, color: 'var(--accent-focus)' },
            { label: 'Mouse clicks', value: m.reduce((a, b) => a + b, 0).toLocaleString(), values: m, color: 'var(--accent-support)' },
            { label: 'Input', value: t.reduce((a, b) => a + b, 0).toLocaleString(), values: t, color: 'var(--accent-warning)' },
            { label: 'Focus', value: f.length ? `${Math.round(f.reduce((a, b) => a + b, 0) / f.length)}%` : '—', values: f, color: 'var(--accent-focus)' },
        ];
    }, [inputHistory, timelineData]);

    const band = isFlat
        ? 'widget px-6 py-5'
        : 'rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 backdrop-blur-md p-6';

    const sortedApps = useMemo(
        () => [...(appUsage ?? [])].sort((a, b) => b.seconds - a.seconds),
        [appUsage]
    );
    const appsTotal = sortedApps.reduce((s, a) => s + a.seconds, 0) || 1;

    const weekMax = Math.max(...weekDays.map((d) => d.minutes), 1);

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader title="Activity" meta="TODAY · UPDATED ON RANGE CHANGE" actions={<RefreshButton />} />

            <div className={cn(isFlat ? 'w-full px-8 pt-2 pb-10 space-y-4' : 'p-8 pt-6 space-y-6 flex-1')}>
                {/* ===== Last 6 days columns ===== */}
                <div className={isFlat ? '' : ''}>
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Last 6 days</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                {weekDays.reduce((s, d) => s + d.minutes, 0)} min focused
                            </span>
                        </div>
                        <div className="mt-5 h-[180px]">
                            {isLoading && weekDays.length === 0 ? (
                                <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                            ) : weekDays.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weekDays} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
                                        <XAxis
                                            dataKey="day"
                                            tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                            tickLine={false}
                                            axisLine={{ stroke: 'var(--border)' }}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--muted-foreground)' }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'var(--surface)' }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const p = payload[0].payload as { day: string; minutes: number };
                                                return (
                                                    <div className="bg-[var(--background)] border border-[var(--foreground)] px-2.5 py-1.5 font-mono text-[10px]">
                                                        <div className="text-[var(--muted-foreground)] tracking-[0.1em]">{p.day}</div>
                                                        <div className="font-bold">{p.minutes} min focused</div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Bar dataKey="minutes" fill="var(--accent-focus)" radius={[1, 1, 0, 0]} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-[12px] text-[var(--muted-foreground)]/60">No activity data yet.</div>
                            )}
                        </div>
                        <div className="mt-2 flex justify-between font-mono text-[9px] text-[var(--muted-foreground)]">
                            <span>FOCUSED MINUTES / DAY</span>
                            <span>PEAK {weekMax} MIN</span>
                        </div>
                    </div>
                </div>

                {/* ===== Spark strips ===== */}
                <div className={isFlat ? '' : ''}>
                    <div className={band}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {sparks.map((spark, i) => (
                                <div key={spark.label} className={cn('min-w-0', i > 0 && 'lg:border-l lg:border-[var(--border)] lg:pl-6')}>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                                        {spark.label}
                                    </div>
                                    <div className="flex items-end justify-between gap-3 mt-2">
                                        <span className="font-display text-[24px] font-semibold tracking-[-0.04em] tabular-nums text-[var(--foreground)]">
                                            {spark.value}
                                        </span>
                                        <Sparkline values={spark.values} color={spark.color} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ===== Focus calendar ===== */}
                <FocusCalendar />

                {/* ===== Today's apps ===== */}
                <div className={isFlat ? '' : ''}>
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Today's apps</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                {sortedApps.length} apps · {formatDuration(appsTotal)} total
                            </span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {isLoading && sortedApps.length === 0 && (
                                <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                            )}
                            {!isLoading && sortedApps.length === 0 && (
                                <div className="text-[12px] text-[var(--muted-foreground)]/60">No usage recorded yet.</div>
                            )}
                            {sortedApps.slice(0, 8).map((app, i) => {
                                const pct = (app.seconds / appsTotal) * 100;
                                return (
                                    <div key={app.name} className="flex items-center gap-4">
                                        <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-[13px] font-semibold text-[var(--foreground)] w-36 truncate flex-shrink-0">
                                            {app.name.replace(/\.exe$/i, '')}
                                        </span>
                                        <div className="flex-1 h-[3px] bg-[var(--border)] min-w-0">
                                            <div
                                                className="h-full"
                                                style={{ width: `${pct}%`, backgroundColor: i === 0 ? 'var(--accent-focus)' : 'var(--foreground)' }}
                                            />
                                        </div>
                                        <span className="font-mono text-[11px] text-[var(--muted-foreground)] w-14 text-right flex-shrink-0">
                                            {formatDuration(app.seconds)}
                                        </span>
                                        <span className="font-mono text-[11px] text-[var(--muted-foreground)]/70 w-10 text-right flex-shrink-0">
                                            {Math.round(pct)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
