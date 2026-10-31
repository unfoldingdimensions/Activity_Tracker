import type { AppClassification } from '../context/SettingsContext';

/**
 * One definition of "focus score", in one place.
 *
 * Focus score = seconds in apps classified `focus`, over seconds in apps that are
 * classified at all. Apps classified `ignore` are removed from *both* sides of the
 * ratio — they are not "time you spent", they are time the metric declines to judge.
 *
 * Two things this is **not**:
 *  - It is not share of the clock: idle and untracked time are excluded from the
 *    denominator, so it measures the quality of the time that was actually spent.
 *  - It is not the Focus Flow chart's share: that one divides by the interval's wall
 *    time and therefore includes an idle segment. Same word, different denominator;
 *    the chart is a density timeline, this is a summary ratio.
 */
export interface FocusBreakdown {
    /** Seconds in apps classified `focus`. */
    focusSeconds: number;
    /** Seconds in apps classified `distraction`. */
    otherSeconds: number;
    /** Seconds in apps the user told us not to judge. */
    ignoredSeconds: number;
    /** focusSeconds + otherSeconds — the ratio's denominator. */
    totalClassifiedSeconds: number;
    /** focusSeconds / totalClassifiedSeconds, rounded; 0 when nothing was classified. */
    score: number;
}

export interface ScoredApp {
    name: string;
    seconds: number;
}

export function computeFocusScore(
    appUsage: readonly ScoredApp[] | null | undefined,
    classify: (name: string) => AppClassification
): FocusBreakdown {
    let focusSeconds = 0;
    let otherSeconds = 0;
    let ignoredSeconds = 0;

    for (const app of appUsage ?? []) {
        const seconds = Number.isFinite(app.seconds) ? app.seconds : 0;
        if (seconds <= 0) continue;

        const cls = classify(app.name);
        if (cls === 'ignore') {
            ignoredSeconds += seconds;
        } else if (cls === 'focus') {
            focusSeconds += seconds;
        } else {
            otherSeconds += seconds;
        }
    }

    const totalClassifiedSeconds = focusSeconds + otherSeconds;

    return {
        focusSeconds,
        otherSeconds,
        ignoredSeconds,
        totalClassifiedSeconds,
        score: totalClassifiedSeconds > 0
            ? Math.round((focusSeconds / totalClassifiedSeconds) * 100)
            : 0,
    };
}
