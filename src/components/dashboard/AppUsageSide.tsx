import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { Bar } from '../ui/Bar';
import { cn } from '../../utils/cn';
import { formatDuration } from '../../utils/formatters';

interface AppUsageLike {
    /** display name */
    name: string;
    /** seconds of use */
    value: number;
}

interface AppUsageSideProps {
    appUsage: AppUsageLike[];
    isLoading?: boolean;
}

/**
 * The Pulse 300px side column (flat): app-usage bar rows with a hover
 * filter hint, a 'today's apps' mono list, and the distraction-guard bar.
 * Clicking a bar row filters the list to that app; clicking again clears.
 */
export function AppUsageSide({ appUsage, isLoading = false }: AppUsageSideProps) {
    const theme = useVisualTheme();
    const { settings } = useSettings();
    const [filtered, setFiltered] = useState<string | null>(null);

    // Merge case-insensitive duplicates (e.g. "claude.exe" vs "Claude.exe" are
    // the same app on Windows) and sort by usage descending.
    const merged = new Map<string, AppUsageLike>();
    for (const app of appUsage ?? []) {
        const key = app.name.toLowerCase();
        const existing = merged.get(key);
        if (existing) {
            existing.value += app.value;
        } else {
            merged.set(key, { ...app });
        }
    }
    const rows = [...merged.values()].sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, a) => s + a.value, 0) || 1;
    const visible = filtered ? rows.filter((a) => a.name.toLowerCase().includes(filtered.toLowerCase())) : rows;
    const top = visible[0];

    // Distraction guard: the most-used limited app's status
    const limitEntry = Object.entries(settings.appLimits)[0];
    const guardApp = limitEntry
        ? rows.find((a) => a.name.toLowerCase().includes(limitEntry[0].toLowerCase()))
        : undefined;
    const guardLimitMinutes = limitEntry ? Math.round(limitEntry[1] / 60) : 0;
    const guardUsed = guardApp ? Math.round(guardApp.value / 60) : 0;
    const guardPct = guardLimitMinutes > 0 ? (guardUsed / guardLimitMinutes) * 100 : 0;

    return (
        <div className={cn('flex flex-col gap-5 widget widget-interactive', theme === 'flat' ? 'px-6 py-5' : 'h-full rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 backdrop-blur-md px-5 py-5')}>
            <div>
                <div className="flex items-baseline justify-between">
                    <h3 className="section-title text-[var(--foreground)]">App usage</h3>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                        {filtered ? 'FILTERED' : 'TODAY'}
                    </span>
                </div>

                <div className="mt-4 space-y-3">
                    {isLoading && <div className="text-[12px] text-[var(--muted-foreground)]">Loading…</div>}
                    {!isLoading && visible.length === 0 && (
                        <div className="text-[12px] text-[var(--muted-foreground)]/60">No usage recorded yet.</div>
                    )}
                    {visible.slice(0, 6).map((app) => {
                        const pct = (app.value / total) * 100;
                        const isTop = top && app.name === top.name;
                        return (
                            <button
                                key={app.name}
                                onClick={() =>
                                    setFiltered(filtered && app.name.toLowerCase().includes(filtered.toLowerCase()) ? null : app.name)
                                }
                                className={cn('block w-full text-left py-1.5 -mx-2 px-2 transition-colors', filtered ? 'opacity-60' : 'hover:bg-[var(--surface)]')}
                            >
                                <div className="flex justify-between font-mono text-[12px]">
                                    <span className={cn('font-bold text-[var(--foreground)]', !isTop && 'text-[var(--foreground)]/55')}>
                                        {app.name.replace(/\.exe$/i, '')}
                                    </span>
                                    <span className="text-[var(--muted-foreground)]">
                                        {formatDuration(app.value)} · {Math.round(pct)}%
                                    </span>
                                </div>
                                <div className="h-[3px] bg-[var(--border)] mt-1.5">
                                    <div
                                        className="h-full"
                                        style={{ width: `${pct}%`, backgroundColor: isTop ? 'var(--accent-focus)' : 'var(--foreground)' }}
                                    />
                                </div>
                                {filtered && app.name.toLowerCase().includes(filtered.toLowerCase()) && (
                                    <div className="font-mono text-[9.5px] text-[var(--muted-foreground)] mt-1.5">
                                        CLICK AGAIN TO CLEAR
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    {!filtered && top && (
                        <div className="font-mono text-[9.5px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]">
                            CLICK TO FILTER THE PAGE BY THIS APP
                        </div>
                    )}
                </div>
            </div>

            {/* Today's apps */}
            <div className="border-t border-[var(--border)] pt-4">
                <h3 className="section-title text-[var(--foreground)]">Today's apps</h3>
                <div className="mt-3 space-y-2.5 font-mono text-[12px]">
                    {rows.slice(0, 5).map((app) => (
                        <div key={app.name} className="flex justify-between">
                            <span className="font-bold text-[var(--foreground)]">{app.name.replace(/\.exe$/i, '')}</span>
                            <span className="text-[var(--muted-foreground)]">{formatDuration(app.value)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Distraction guard */}
            {limitEntry && (
                <div className="border-t border-[var(--border)] pt-4">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                        DISTRACTION GUARD · {guardApp ? guardApp.name.replace(/\.exe$/i, '') : limitEntry[0]} {formatDuration((guardApp?.value ?? 0))} / {formatDuration(limitEntry[1])} LIMIT
                    </div>
                    <div className="mt-2">
                        <Bar value={guardPct} color="var(--accent-warning)" height="hair" />
                    </div>
                </div>
            )}
        </div>
    );
}
