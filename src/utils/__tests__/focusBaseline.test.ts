import { describe, it, expect } from 'vitest';
import { hourlyFocusShare, medianByHour, alignBaseline, MIN_BASELINE_DAYS } from '../focusBaseline';

const classify = (name: string) =>
    name === 'code.exe' ? ('focus' as const) : name === 'unknown' ? ('ignore' as const) : ('distraction' as const);

/** Local-midnight epoch for a fixed date, so the test does not depend on the machine's zone offset. */
const dayStart = (y: number, m: number, d: number) => new Date(y, m, d, 0, 0, 0, 0).getTime();
const iso = (y: number, m: number, d: number, h: number, min = 0) =>
    new Date(y, m, d, h, min, 0, 0).toISOString();

describe('hourlyFocusShare', () => {
    it('splits one event across two hours by overlap', () => {
        const start = dayStart(2026, 10, 2);
        // 09:40 → 10:20: 20 minutes in hour 9, 20 in hour 10, each at 100% focus.
        const share = hourlyFocusShare(
            [{ timestamp: iso(2026, 10, 2, 9, 40), process_name: 'code.exe', duration_seconds: 2400 }],
            start,
            classify
        );
        expect(share.get(9)).toBeCloseTo((1200 / 3600) * 100, 5);
        expect(share.get(10)).toBeCloseTo((1200 / 3600) * 100, 5);
        expect(share.has(11)).toBe(false);
    });

    it('drops ignore-classified apps from both sides of the ratio', () => {
        const start = dayStart(2026, 10, 2);
        const share = hourlyFocusShare(
            [
                { timestamp: iso(2026, 10, 2, 9), process_name: 'code.exe', duration_seconds: 1800 },
                { timestamp: iso(2026, 10, 2, 9, 30), process_name: 'unknown', duration_seconds: 1800 },
            ],
            start,
            classify
        );
        // Half an hour of focus in a full hour, with the unattributable half-hour removed rather than counted as other.
        expect(share.get(9)).toBe(50);
    });

    it('reports a quiet hour as low, not missing, when something was recorded in it', () => {
        const start = dayStart(2026, 10, 2);
        const share = hourlyFocusShare(
            [{ timestamp: iso(2026, 10, 2, 9), process_name: 'code.exe', duration_seconds: 60 }],
            start,
            classify
        );
        // One focused minute in a 60-minute denominator is 1.67%, present and small.
        expect(share.get(9)).toBeCloseTo((60 / 3600) * 100, 5);
    });

    it('counts a non-focus hour as zero focus rather than omitting it', () => {
        const start = dayStart(2026, 10, 2);
        const share = hourlyFocusShare(
            [{ timestamp: iso(2026, 10, 2, 9), process_name: 'browser.exe', duration_seconds: 600 }],
            start,
            classify
        );
        expect(share.get(9)).toBe(0);
    });
});

describe('medianByHour', () => {
    it('takes the middle value for an odd count', () => {
        const medians = medianByHour([new Map([[9, 10]]), new Map([[9, 30]]), new Map([[9, 20]])]);
        expect(medians.get(9)).toBe(20);
    });

    it('averages the middle pair for an even count', () => {
        const medians = medianByHour([
            new Map([[9, 10]]),
            new Map([[9, 20]]),
            new Map([[9, 40]]),
            new Map([[9, 60]]),
        ]);
        expect(medians.get(9)).toBe(30);
    });

    it('refuses an hour with fewer than the minimum number of days', () => {
        const medians = medianByHour([
            new Map([[9, 10]]),
            new Map([[9, 30]]),
            new Map([[10, 80]]),
        ]);
        expect(medians.has(9)).toBe(false);
        expect(medians.has(10)).toBe(false);
        expect(MIN_BASELINE_DAYS).toBe(3);
    });

    it('ignores days that have no data at an hour instead of treating them as zero', () => {
        const medians = medianByHour([
            new Map([[9, 40]]),
            new Map([[9, 50]]),
            new Map([[9, 60]]),
            new Map([[10, 5]]), // a day that was asleep at 09:00 must not pull 09:00 down
        ]);
        expect(medians.get(9)).toBe(50);
    });
});

describe('alignBaseline', () => {
    it('maps each bucket to its own local hour', () => {
        const nine = new Date(2026, 10, 2, 9, 10).getTime();
        const ten = new Date(2026, 10, 2, 10, 10).getTime();
        const byHour = new Map([
            [9, 40],
            [10, 70],
        ]);
        expect(alignBaseline([nine, ten], byHour)).toEqual([40, 70]);
    });

    it('leaves a bucket without a timestamp or without an opinion as null', () => {
        const byHour = new Map([[9, 40]]);
        expect(alignBaseline([undefined, new Date(2026, 10, 2, 9).getTime()], byHour)).toEqual([null, 40]);
        expect(alignBaseline([new Date(2026, 10, 2, 3).getTime()], byHour)).toEqual([null]);
    });
});
