/**
 * The "usual" line behind the focus chart: the median focus share for each local hour-of-day over the last N days.
 *
 * Same measure as the chart it sits behind — window events × classification, share of the hour — so the two lines
 * answer the same question over different windows instead of being two derivations of "focus" that quietly disagree
 * (`docs/flow.md` §4, one metric one owner).
 *
 * Median, not mean: one fourteen-hour outlier would otherwise define what "normal" means for that hour. Hours with no
 * recorded events are skipped, never counted as zero — a night's sleep must not drag the line to the floor.
 */

/** Fewer usable days than this at an hour and the line has no opinion there. */
export const MIN_BASELINE_DAYS = 3;

export interface BaselineEvent {
    timestamp: string;
    process_name: string;
    /** Wall-clock span of the event; the chart divides focus seconds by the bucket, so this one does too. */
    duration_seconds: number;
}

export type Classify = (name: string) => 'focus' | 'distraction' | 'ignore';
export type HourMap = Map<number, number>;

const HOUR_MS = 3_600_000;

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    return end > start ? (end - start) / 1000 : 0;
}

/**
 * Focus share for each local hour of one day, 0–100, in the chart's own units.
 *
 * Returns only hours that carry recorded time; `ignore`-classified apps contribute to neither side, so they are
 * dropped before the ratio (D-020).
 */
export function hourlyFocusShare(
    events: BaselineEvent[],
    dayStartMs: number,
    classify: Classify
): HourMap {
    const focusSeconds = new Map<number, number>();
    const totalSeconds = new Map<number, number>();

    for (const event of events) {
        const cls = classify(event.process_name);
        if (cls === 'ignore') continue;

        const start = Date.parse(event.timestamp);
        if (!Number.isFinite(start)) continue;
        const end = start + Math.max(0, event.duration_seconds) * 1000;

        for (let hour = 0; hour < 24; hour += 1) {
            const hStart = dayStartMs + hour * HOUR_MS;
            const overlap = overlapSeconds(start, end, hStart, hStart + HOUR_MS);
            if (overlap <= 0) continue;

            totalSeconds.set(hour, (totalSeconds.get(hour) ?? 0) + overlap);
            if (cls === 'focus') {
                focusSeconds.set(hour, (focusSeconds.get(hour) ?? 0) + overlap);
            }
        }
    }

    const shares: HourMap = new Map();
    // Denominator is the hour itself, exactly as the chart divides by the bucket: a quiet hour reads low, not absent.
    for (const hour of totalSeconds.keys()) {
        shares.set(hour, Math.min(100, ((focusSeconds.get(hour) ?? 0) / (HOUR_MS / 1000)) * 100));
    }
    return shares;
}

/** Median of the per-day shares for each hour, over the days that have that hour. */
export function medianByHour(dayShares: HourMap[]): HourMap {
    const samples = new Map<number, number[]>();
    for (const day of dayShares) {
        for (const [hour, share] of day) {
            const list = samples.get(hour);
            if (list) list.push(share);
            else samples.set(hour, [share]);
        }
    }

    const medians: HourMap = new Map();
    for (const [hour, values] of samples) {
        if (values.length < MIN_BASELINE_DAYS) continue;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
            sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        medians.set(hour, Math.round(median));
    }
    return medians;
}

/**
 * Line the baseline up with the chart's buckets, by the bucket's own start time.
 *
 * A bucket without a timestamp gets `null` rather than a guess: the chart never shows a comparison it cannot place.
 */
export function alignBaseline(bucketStarts: (number | undefined)[], byHour: HourMap): (number | null)[] {
    return bucketStarts.map((at) => {
        if (at === undefined || !Number.isFinite(at)) return null;
        const hour = new Date(at).getHours();
        return byHour.get(hour) ?? null;
    });
}
