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
 * The focus-classified seconds and the top app's share of it, for the
 * "X led at Y% of focus" insight. Returns null when there is nothing.
 */
export function focusLeader(
    appUsage: AppUsageEntry[],
    classify: (name: string) => AppClassification
): { name: string; seconds: number; sharePct: number } | null {
    let focusSeconds = 0;
    let topName: string | null = null;
    let topSeconds = -1;

    appUsage.forEach((app) => {
        if (classify(app.name) !== 'focus') return;
        focusSeconds += app.seconds;
        if (app.seconds > topSeconds) {
            topSeconds = app.seconds;
            topName = app.name;
        }
    });

    if (!topName || focusSeconds <= 0) return null;
    return { name: topName, seconds: topSeconds, sharePct: pct(topSeconds, focusSeconds) };
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
    void digest; void sessions; void timeline; void appUsage; void classify;
    return [];
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
