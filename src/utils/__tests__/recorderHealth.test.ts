import { describe, it, expect } from 'vitest';
import { describeSampleAge, STALE_AFTER_SECONDS } from '../recorderHealth';

describe('describeSampleAge', () => {
    it('calls a fresh write "just now" rather than counting zero', () => {
        expect(describeSampleAge(0)).toEqual({ label: 'just now', stale: false });
        expect(describeSampleAge(1).label).toBe('just now');
    });

    it('reports seconds once the tick is a moment old', () => {
        expect(describeSampleAge(4)).toEqual({ label: '4s', stale: false });
        expect(describeSampleAge(4.4).label).toBe('4s');
    });

    it('stays calm at the threshold and turns stale just past it', () => {
        expect(describeSampleAge(STALE_AFTER_SECONDS).stale).toBe(false);
        expect(describeSampleAge(STALE_AFTER_SECONDS + 1).stale).toBe(true);
    });

    it('treats unknown as not-fine, never as fresh', () => {
        // No history, a failed read, or an unreadable timestamp are all "no evidence", not "recording fine".
        for (const value of [null, undefined, Number.NaN]) {
            expect(describeSampleAge(value as number | null).stale).toBe(true);
        }
        expect(describeSampleAge(null).label).toBe('no samples yet');
    });

    it('never shows a negative age', () => {
        expect(describeSampleAge(-30).label).toBe('just now');
    });
});
