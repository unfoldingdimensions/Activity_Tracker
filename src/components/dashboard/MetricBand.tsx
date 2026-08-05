import { useMemo } from 'react';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { MetricValue } from '../ui/MetricValue';
import { cn } from '../../utils/cn';
import { formatDuration, formatDistance } from '../../utils/formatters';

interface MetricBandProps {
    screenTimeSeconds: number;
    keystrokes: number;
    mouseClicks: number;
    mouseDistance: number;
    focusScore: number;
    /** focus percentages per minute, for the sparkline */
    spark: number[];
    isLoading?: boolean;
}

/**
 * The Pulse metric band: four cells divided by 1px rules. Big tabular
 * numbers with muted unit suffixes, a delta/annotation line and (for
 * screen time) an 80x16 sparkline.
 */
export function MetricBand({
    screenTimeSeconds,
    keystrokes,
    mouseClicks,
    mouseDistance,
    focusScore,
    spark,
    isLoading = false,
}: MetricBandProps) {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    const sparkPath = useMemo(() => {
        if (spark.length < 2) return '';
        const w = 80;
        const h = 16;
        const max = Math.max(...spark, 1);
        const pts = spark.map((v, i) => {
            const x = (i / (spark.length - 1)) * w;
            const y = h - (v / max) * h;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `M${pts.join(' L')}`;
    }, [spark]);

    const keystrokesPerMin = Math.round(keystrokes / 60);
    if (isFlat) {
        const cells = [
            {
                label: 'Screen time',
                value: <MetricValue value={formatDuration(screenTimeSeconds)} />,
                caption: (
                    <div className="flex items-center gap-2 mt-3">
                        <span className="font-mono text-[9.5px] text-[var(--accent-focus)]">in range</span>
                        <svg viewBox="0 0 120 18" width="80" height="14" preserveAspectRatio="none" className="block">
                            <path d={sparkPath.replace(/^M/, 'M0 15 ')} fill="none" stroke="var(--accent-focus)" strokeWidth="1.4" />
                        </svg>
                    </div>
                ),
            },
            {
                label: 'Keystrokes',
                value: <MetricValue value={keystrokes.toLocaleString()} />,
                caption: (
                    <div className="flex items-center gap-2 mt-3 font-mono text-[9.5px] text-[var(--muted-foreground)]">
                        <span>{keystrokesPerMin}/min avg</span>
                    </div>
                ),
            },
            {
                label: 'Mouse clicks',
                value: <MetricValue value={mouseClicks.toLocaleString()} />,
                caption: (
                    <div className="flex items-center gap-2 mt-3 font-mono text-[9.5px] text-[var(--muted-foreground)]">
                        <span>{formatDistance(mouseDistance)} travelled</span>
                    </div>
                ),
            },
            {
                label: 'Focus score',
                value: <MetricValue value={focusScore} unit="%" color="var(--accent-focus)" />,
                caption: (
                    <div className="mt-3 h-[2px] bg-[var(--border)]">
                        <div className="h-full bg-[var(--accent-focus)]" style={{ width: `${focusScore}%` }} />
                    </div>
                ),
            },
        ];

        return (
            <div className="grid grid-cols-4 border-b border-[var(--border)]">
                {cells.map((cell, i) => (
                    <div key={cell.label} className={cn('py-[22px] pb-6', i > 0 ? 'px-7 border-l border-[var(--border)]' : 'px-8')}>
                        <div className="label-mono">{cell.label}</div>
                        <div className="mt-3">{isLoading ? <span className="metric-value text-[var(--muted-foreground)]">—</span> : cell.value}</div>
                        {cell.caption}
                    </div>
                ))}
            </div>
        );
    }

    // Glass: reuse the stat-card grid
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: 'Screen Time', value: formatDuration(screenTimeSeconds) },
                { label: 'Keystrokes', value: keystrokes.toLocaleString() },
                { label: 'Mouse Clicks', value: mouseClicks.toLocaleString() },
                { label: 'Focus Score', value: `${focusScore}%` },
            ].map((cell) => (
                <div key={cell.label} className="card p-4">
                    <p className="text-xs text-[var(--muted-foreground)]">{cell.label}</p>
                    <p className="font-display text-3xl font-bold text-[var(--foreground)] mt-2">{cell.value}</p>
                </div>
            ))}
        </div>
    );
}
