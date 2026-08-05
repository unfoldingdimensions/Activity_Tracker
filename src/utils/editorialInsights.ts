import type { DailyDigest, FocusSession } from './focusSessions';
import type { AppUsageEntry } from '../api/tauri';
import type { AppClassification } from '../context/SettingsContext';
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

/**
 * The top focus-classified app and its share of TOTAL active time (all
 * apps), for "X led at Y% of active time" insights. Returns null when
 * there is no focus usage at all.
 */
export function focusLeader(
    appUsage: AppUsageEntry[],
    classify: (name: string) => AppClassification
): { name: string; seconds: number; sharePct: number } | null {
    let totalSeconds = 0;
    let focusSeconds = 0;
    let topName: string | null = null;
    let topSeconds = -1;

    appUsage.forEach((app) => {
        const cls = classify(app.name);
        // 'ignore' removes the app from the focus equation entirely
        // (same rule as the dashboard's reconciled focus score).
        if (cls === 'ignore') return;
        totalSeconds += app.seconds;
        if (cls !== 'focus') return;
        focusSeconds += app.seconds;
        if (app.seconds > topSeconds) {
            topSeconds = app.seconds;
            topName = app.name;
        }
    });

    if (!topName || focusSeconds <= 0) return null;
    return { name: topName, seconds: topSeconds, sharePct: pct(topSeconds, totalSeconds) };
}

// ---------------------------------------------------------------------------
// Builders — one per surface. Implemented task-by-task; each returns [] until
// its inputs are present, and [] again when the data is empty or too thin.
// ---------------------------------------------------------------------------

export function buildDashboardInsights(
    digest: DailyDigest,
    sessions: FocusSession[],
    timeline: { time: string; focus: number }[],
    appUsage: AppUsageEntry[],
    classify: (name: string) => AppClassification
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

    void appUsage; void classify;
    return insights.slice(0, 3);
}

export function buildActivityInsights(
    weekDays: { day: string; minutes: number }[],
    sortedApps: AppUsageEntry[],
    appsTotalSeconds: number
): EditorialInsight[] {
    void weekDays; void sortedApps; void appsTotalSeconds;
    return [];
}

export function buildPowerInsights(
    avgPower: number,
    topConsumers: { app: string; power: number }[],
    totalCpu: number,
    processCount: number
): EditorialInsight[] {
    void avgPower; void topConsumers; void totalCpu; void processCount;
    return [];
}

export function buildTimelineInsights(
    rangeLabel: string,
    hourlyGroups: unknown[],
    events: unknown[],
    sessions: FocusSession[],
    selectedApp: string | null
): EditorialInsight[] {
    void rangeLabel; void hourlyGroups; void events; void sessions; void selectedApp;
    return [];
}

export function buildToolsInsights(
    workSessions: number,
    goalsMet: number,
    goalCount: number,
    wellbeing: {
        needsBreak: boolean;
        sedentaryMinutes: number;
        timeSinceLastBreak: number;
    }
): EditorialInsight[] {
    void workSessions; void goalsMet; void goalCount; void wellbeing;
    return [];
}

// Re-exported so builders and callers share one duration formatter.
export { formatDuration };
