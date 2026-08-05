import type { DailyDigest, FocusSession } from './focusSessions';
import type { AppUsageEntry } from '../api/tauri';
import { formatDuration } from './formatters';

/**
 * Editorial-mode insights: one interpretation + one number per row,
 * derived from the same data the Data-mode widgets already show.
 *
 * Rules (see DESIGN.md):
 * - Same truth two ways: every figure must match what Data mode renders.
 * - Explain, don't report: a bare number is a caption, not an insight.
 * - The instrument is honest: unknown comparisons are omitted, never invented.
 * - Max 3 insights per page, priority-ordered. Empty data yields [].
 */

export interface EditorialInsight {
    /** Mono uppercase caption, e.g. "PEAK HOUR" or "LONGEST RUN" */
    label: string;
    /** One sentence: interpretation + number. Never a bare number. */
    text: string;
}

/** Round a part/whole ratio to a whole percent (0 when whole <= 0). */
export function pct(part: number, whole: number): number {
    if (whole <= 0) return 0;
    return Math.round((part / whole) * 100);
}

/** "session" / "sessions" — keep call sites readable. */
export function pluralize(n: number, single: string, plural: string): string {
    return n === 1 ? single : plural;
}

/** The longest focus session, or null when none qualify. */
export function longestSession(sessions: FocusSession[]): FocusSession | null {
    if (sessions.length === 0) return null;
    return sessions.reduce((a, b) => (b.durationSeconds > a.durationSeconds ? b : a));
}

// ---------------------------------------------------------------------------
// Builders — one per surface. Empty data yields [] — the lede covers it.
// ---------------------------------------------------------------------------

export function buildDashboardInsights(
    digest: DailyDigest,
    sessions: FocusSession[],
    timeline: { time: string; focus: number }[]
): EditorialInsight[] {
    const insights: EditorialInsight[] = [];

    // 1. Peak hour — the strongest bucket in the focus-flow timeline.
    if (digest.peakHour) {
        const peak = timeline.find((b) => b.time === digest.peakHour);
        const share = peak ? Math.min(100, Math.max(0, Math.round(peak.focus))) : null;
        if (share !== null && share > 0) {
            insights.push({
                label: 'PEAK HOUR',
                text: `Focus peaked at ${digest.peakHour} — ${share}% of that hour was deep work.`,
            });
        }
    }

    // 2. Longest uninterrupted run.
    const longest = longestSession(sessions);
    if (longest && longest.durationSeconds >= 25 * 60) {
        const dur = formatDuration(longest.durationSeconds);
        const inter = longest.interruptions > 0
            ? ` — ${longest.interruptions} ${pluralize(longest.interruptions, 'interruption', 'interruptions')}`
            : '';
        insights.push({
            label: 'LONGEST RUN',
            text: `${dur} uninterrupted in ${longest.appName}${inter}.`,
        });
    }

    // 3. Delta vs the previous period — omitted when unknown (honest instrument).
    if (digest.deltaVsPrevious !== null) {
        const abs = formatDuration(Math.abs(digest.deltaVsPrevious));
        insights.push({
            label: 'VS YESTERDAY',
            text: digest.deltaVsPrevious >= 0
                ? `${abs} more focus than yesterday.`
                : `${abs} less focus than yesterday.`,
        });
    }

    return insights.slice(0, 3);
}

export function buildActivityInsights(
    weekDays: { day: string; minutes: number }[],
    sortedApps: AppUsageEntry[],
    appsTotalSeconds: number
): EditorialInsight[] {
    const insights: EditorialInsight[] = [];

    // 1. Strongest day of the trailing week.
    if (weekDays.length > 0) {
        const peak = weekDays.reduce((a, b) => (b.minutes > a.minutes ? b : a));
        if (peak.minutes > 0) {
            insights.push({
                label: 'STRONGEST DAY',
                text: `${peak.day} carried the week — ${peak.minutes} min of focus.`,
            });
        }
    }

    // 2. The app with the most active seconds and its share of the total.
    //    sortedApps is already descending; the page's own caption uses the
    //    same total, so the share matches Data mode exactly.
    const leader = sortedApps[0];
    if (leader && leader.seconds > 0 && appsTotalSeconds > 0) {
        insights.push({
            label: 'LEADING APP',
            text: `${leader.name} led at ${pct(leader.seconds, appsTotalSeconds)}% of active time.`,
        });
    }

    return insights.slice(0, 3);
}

export function buildPowerInsights(
    topConsumers: { app: string; power: number }[],
    totalCpu: number,
    processCount: number
): EditorialInsight[] {
    const insights: EditorialInsight[] = [];

    // 1. Top consumer and its share of the listed draw.
    const top = topConsumers[0];
    if (top && top.power > 0) {
        const listed = topConsumers.reduce((s, c) => s + c.power, 0);
        if (listed > 0) {
            insights.push({
                label: 'TOP DRAW',
                text: `${top.app.replace(/\.exe$/i, '')} asks for the most — ${top.power}W, about ${pct(top.power, listed)}% of the draw.`,
            });
        }
    }

    // 2. Machine load: processes sampled at CPU total.
    if (processCount > 0 && totalCpu > 0) {
        insights.push({
            label: 'LOAD',
            text: `${processCount} processes sampled at ${totalCpu}% CPU.`,
        });
    }

    return insights.slice(0, 3);
}

export function buildTimelineInsights(
    hourlyGroups: { time: string; items: unknown[] }[],
    sessions: FocusSession[]
): EditorialInsight[] {
    const insights: EditorialInsight[] = [];

    // 1. Busiest hour group — most window events in a single hour block.
    if (hourlyGroups.length > 0) {
        const busiest = hourlyGroups.reduce((a, b) => (b.items.length > a.items.length ? b : a));
        if (busiest.items.length > 0) {
            const hourNum = Number(busiest.time.split(' ')[1]?.split(':')[0]);
            const hourLabel = !Number.isNaN(hourNum)
                ? new Date(2000, 0, 1, hourNum).toLocaleTimeString([], { hour: 'numeric' })
                : busiest.time;
            insights.push({
                label: 'BUSIEST HOUR',
                text: `${hourLabel} was the busiest hour — ${busiest.items.length} ${pluralize(busiest.items.length, 'window event', 'window events')}.`,
            });
        }
    }

    // 2. Longest uninterrupted run inside the range.
    const longest = longestSession(sessions);
    if (longest && longest.durationSeconds >= 25 * 60) {
        const inter = longest.interruptions > 0
            ? ` — ${longest.interruptions} ${pluralize(longest.interruptions, 'interruption', 'interruptions')}`
            : '';
        insights.push({
            label: 'LONGEST RUN',
            text: `${formatDuration(longest.durationSeconds)} uninterrupted in ${longest.appName}${inter}.`,
        });
    }

    return insights.slice(0, 3);
}

export function buildToolsInsights(
    workSessions: number,
    goalsMet: number,
    goalCount: number,
    wellbeing: {
        needsBreak: boolean;
        sedentaryMinutes: number;
    }
): EditorialInsight[] {
    const insights: EditorialInsight[] = [];

    // 1. Daily targets: the gap is only named when it exists.
    if (goalCount > 0) {
        if (goalsMet >= goalCount) {
            insights.push({
                label: 'TARGETS',
                text: `All ${goalCount} ${pluralize(goalCount, 'target', 'targets')} met today.`,
            });
        } else {
            const gap = goalCount - goalsMet;
            insights.push({
                label: 'TARGETS',
                text: `${goalsMet} of ${goalCount} ${pluralize(goalCount, 'target', 'targets')} met — ${gap} still to reach.`,
            });
        }
    }

    // 2. Break advice only when the instrument says a break is due.
    if (wellbeing.needsBreak && wellbeing.sedentaryMinutes > 0) {
        insights.push({
            label: 'BREAK',
            text: `You have been seated ${formatDuration(wellbeing.sedentaryMinutes * 60)} — time for a walk.`,
        });
    }

    // 3. Pomodoro count when any were closed.
    if (workSessions > 0) {
        insights.push({
            label: 'POMODOROS',
            text: `${workSessions} ${pluralize(workSessions, 'pomodoro', 'pomodoros')} closed today.`,
        });
    }

    return insights.slice(0, 3);
}
