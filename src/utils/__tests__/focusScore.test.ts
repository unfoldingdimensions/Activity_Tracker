import { describe, it, expect } from 'vitest';
import { computeFocusScore } from '../focusScore';
import type { AppClassification } from '../../context/SettingsContext';

function classifier(map: Record<string, AppClassification>) {
    return (name: string): AppClassification => map[name] ?? 'distraction';
}

const MIXED = classifier({ code: 'focus', chrome: 'focus', slack: 'distraction', netflix: 'ignore' });

describe('computeFocusScore', () => {
    it('is the focus share of classified app time', () => {
        const result = computeFocusScore(
            [
                { name: 'code', seconds: 3600 },
                { name: 'chrome', seconds: 1800 },
                { name: 'slack', seconds: 5400 },
            ],
            MIXED
        );

        expect(result.focusSeconds).toBe(5400);
        expect(result.otherSeconds).toBe(5400);
        expect(result.totalClassifiedSeconds).toBe(10800);
        expect(result.score).toBe(50);
    });

    it('removes ignored apps from both sides of the ratio', () => {
        // 1h focus, 1h distraction, 10h ignored -> still 50%, not 9%.
        const result = computeFocusScore(
            [
                { name: 'code', seconds: 3600 },
                { name: 'slack', seconds: 3600 },
                { name: 'netflix', seconds: 36000 },
            ],
            MIXED
        );

        expect(result.ignoredSeconds).toBe(36000);
        expect(result.totalClassifiedSeconds).toBe(7200);
        expect(result.score).toBe(50);
    });

    it('is 0 when nothing was classified', () => {
        expect(computeFocusScore([], MIXED).score).toBe(0);
        expect(computeFocusScore(null, MIXED).score).toBe(0);

        const onlyIgnored = computeFocusScore([{ name: 'netflix', seconds: 600 }], MIXED);
        expect(onlyIgnored.totalClassifiedSeconds).toBe(0);
        expect(onlyIgnored.score).toBe(0);
    });

    it('is 100 when every classified second is focus', () => {
        const result = computeFocusScore([{ name: 'code', seconds: 1800 }], MIXED);
        expect(result.score).toBe(100);
    });

    it('rounds to the nearest whole percent', () => {
        // 2h focus / 3h classified = 66.67% -> 67
        const result = computeFocusScore(
            [
                { name: 'code', seconds: 7200 },
                { name: 'slack', seconds: 3600 },
            ],
            MIXED
        );
        expect(result.score).toBe(67);
    });

    it('ignores non-positive and non-finite seconds instead of distorting the ratio', () => {
        const result = computeFocusScore(
            [
                { name: 'code', seconds: 600 },
                { name: 'slack', seconds: 0 },
                { name: 'chrome', seconds: Number.NaN },
                { name: 'slack', seconds: -300 },
            ],
            MIXED
        );

        expect(result.focusSeconds).toBe(600);
        expect(result.otherSeconds).toBe(0);
        expect(result.score).toBe(100);
    });
});
