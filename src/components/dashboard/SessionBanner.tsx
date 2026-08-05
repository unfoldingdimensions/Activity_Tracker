import { useState, useMemo } from 'react';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { useActiveWindow } from '../../hooks/useTrackerData';
import { formatAppName } from '../../utils/formatters';
import { StatusDot } from '../ui/StatusDot';

const MIN_RUN_BUCKETS = 2;
const DEEP_WORK_MINUTES = 25;

interface SessionBannerProps {
    /** per-minute timeline buckets (chronological) */
    timeline: { time: string; focus: number; distraction: number; idle: number }[];
    /** bucket span in minutes (10 for past hour, 30 for 6h, 60 for 12h+) */
    bucketMinutes?: number;
}

/**
 * Live focus-run banner: shown while a contiguous focus run is in progress
 * (>= 2 trailing focus buckets), with a progress bar toward the 25-minute
 * deep-work threshold. DISMISS hides it for the current run.
 * Not shown on week/month ranges (buckets too coarse to mean "now").
 */
export function SessionBanner({ timeline, bucketMinutes = 10 }: SessionBannerProps) {
    const theme = useVisualTheme();
    const { data: activeWindow } = useActiveWindow();
    const [dismissed, setDismissed] = useState(false);

    const run = useMemo(() => {
        // Walk backwards from the end while focus is non-zero
        let buckets = 0;
        for (let i = timeline.length - 1; i >= 0; i--) {
            if ((timeline[i].focus ?? 0) > 0) {
                buckets += 1;
            } else {
                break;
            }
        }
        return buckets;
    }, [timeline]);

    const runMinutes = run >= MIN_RUN_BUCKETS ? run * bucketMinutes : 0;
    const appName = activeWindow?.process_name ? formatAppName(activeWindow.process_name) : 'an app';

    if (runMinutes === 0 || dismissed || bucketMinutes > 60) return null;

    const progress = Math.min(100, (runMinutes / DEEP_WORK_MINUTES) * 100);
    const toDeepWork = Math.max(0, DEEP_WORK_MINUTES - runMinutes);
    const qualifies = runMinutes >= DEEP_WORK_MINUTES;

    if (theme === 'flat') {
        return (
            <div className="mx-8 mt-4 flex items-center gap-4 px-4 py-3 border border-[var(--accent-focus)]">
                <StatusDot color="var(--accent-focus)" pulsing />
                <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                    Session in progress · {appName} · {runMinutes}m
                </span>
                <div className="flex-1 max-w-[260px] h-[2px] bg-[var(--border)]">
                    <div className="h-full bg-[var(--accent-focus)] transition-all duration-1000" style={{ width: `${progress}%` }} />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                    {qualifies ? 'Deep work session' : `Qualifies as deep work in ${toDeepWork} min`}
                </span>
                <button
                    onClick={() => setDismissed(true)}
                    className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                    Dismiss ×
                </button>
            </div>
        );
    }

    return (
        <div className="mx-8 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-focus)]/10 border border-[var(--accent-focus)]/30">
            <StatusDot color="var(--accent-focus)" pulsing />
            <span className="text-sm font-semibold text-[var(--foreground)]">
                Session in progress · {appName} · {runMinutes}m
            </span>
            <div className="flex-1 max-w-[260px] h-2 rounded-full bg-[var(--muted)]">
                <div className="h-full rounded-full bg-[var(--accent-focus)] transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-[var(--muted-foreground)]">
                {qualifies ? 'Deep work session' : `Qualifies as deep work in ${toDeepWork} min`}
            </span>
            <button
                onClick={() => setDismissed(true)}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
                Dismiss ×
            </button>
        </div>
    );
}
