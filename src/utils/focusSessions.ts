import type { WindowEvent } from '../api/tauri';
import type { AppClassification } from '../context/SettingsContext';
import { parseTimestamp } from './formatters';

export interface FocusSession {
    /** Epoch ms of the first focus event */
    startTime: number;
    /** Epoch ms of the last focus event */
    endTime: number;
    /** Wall-clock duration in seconds */
    durationSeconds: number;
    /** Dominant app (most seconds inside the session) */
    appName: string;
    /** Distraction events that overlapped the session */
    interruptions: number;
}

/** A block is "deep work" when it reaches this length */
export const MIN_FOCUS_SESSION_SECONDS = 25 * 60;
/** A gap longer than this between focus events splits the session */
export const MAX_SESSION_GAP_SECONDS = 2 * 60;

/**
 * Detect contiguous focus blocks from window events.
 *
 * - Focus events accumulate into the current session; a gap > MAX_SESSION_GAP
 *   between focus events closes it.
 * - Distraction events that overlap the session window count as interruptions.
 * - 'ignore'-classified apps are skipped entirely.
 * - Sessions shorter than MIN_FOCUS_SESSION_SECONDS are dropped.
 */
export function computeFocusSessions(
    events: WindowEvent[],
    classify: (name: string) => AppClassification
): FocusSession[] {
    const sorted = [...events].sort(
        (a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp)
    );

    interface OpenSession {
        start: number;
        end: number;
        interruptions: number;
        appSeconds: Map<string, number>;
    }

    const sessions: FocusSession[] = [];
    let current: OpenSession | null = null;

    const close = () => {
        if (!current) return;
        const durationSeconds = Math.round((current.end - current.start) / 1000);
        if (durationSeconds >= MIN_FOCUS_SESSION_SECONDS) {
            let appName = 'Unknown';
            let max = -1;
            current.appSeconds.forEach((seconds, name) => {
                if (seconds > max) {
                    max = seconds;
                    appName = name;
                }
            });
            sessions.push({
                startTime: current.start,
                endTime: current.end,
                durationSeconds,
                appName,
                interruptions: current.interruptions,
            });
        }
        current = null;
    };

    sorted.forEach((e) => {
        const start = parseTimestamp(e.timestamp);
        const end = start + e.duration_seconds * 1000;
        const cls = classify(e.process_name);

        if (cls === 'focus') {
            if (!current) {
                current = { start, end, interruptions: 0, appSeconds: new Map() };
            } else if (start - current.end > MAX_SESSION_GAP_SECONDS * 1000) {
                close();
                current = { start, end, interruptions: 0, appSeconds: new Map() };
            } else {
                current.end = Math.max(current.end, end);
            }
            const existing = current.appSeconds.get(e.process_name) ?? 0;
            current.appSeconds.set(e.process_name, existing + e.duration_seconds);
        } else if (cls === 'distraction' && current) {
            // Count as an interruption when it falls inside the session
            // window (including the grace gap, since a focus event could
            // still join it there)
            if (start < current.end + MAX_SESSION_GAP_SECONDS * 1000 && end > current.start) {
                current.interruptions += 1;
            }
        }
        // 'ignore': skipped entirely
    });

    close();
    return sessions;
}

export interface DailyDigest {
    /** Total focus-classified seconds in the period */
    focusSeconds: number;
    /** Number of deep-work sessions (>= 25 min) */
    sessionCount: number;
    /** Label of the hour with the most focus, e.g. "10 AM" */
    peakHour: string | null;
    /** App with the most usage in the period */
    topAppName: string | null;
    /** Focus-seconds delta vs the previous period (null when unknown) */
    deltaVsPrevious: number | null;
}

/**
 * Build a compact daily/weekly digest from already-computed pieces.
 */
export function buildDigest(input: {
    focusSeconds: number;
    sessions: FocusSession[];
    /** Hour buckets in the shape [{ time: "10 AM", focus: 42, ... }] */
    timeline: { time: string; focus: number }[];
    /** App usage in the shape [{ name, seconds }] */
    appUsage: { name: string; seconds: number }[];
    previousFocusSeconds: number | null;
}): DailyDigest {
    const { focusSeconds, sessions, timeline, appUsage, previousFocusSeconds } = input;

    let peakHour: string | null = null;
    let peakFocus = -1;
    timeline.forEach((bucket) => {
        if (bucket.focus > peakFocus) {
            peakFocus = bucket.focus;
            peakHour = bucket.time;
        }
    });

    let topAppName: string | null = null;
    let topSeconds = -1;
    appUsage.forEach((app) => {
        if (app.seconds > topSeconds) {
            topSeconds = app.seconds;
            topAppName = app.name;
        }
    });

    return {
        focusSeconds,
        sessionCount: sessions.length,
        peakHour,
        topAppName,
        deltaVsPrevious:
            previousFocusSeconds === null ? null : focusSeconds - previousFocusSeconds,
    };
}
