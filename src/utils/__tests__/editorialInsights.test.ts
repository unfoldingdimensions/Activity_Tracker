import { describe, expect, it } from 'vitest';
import {
    buildDashboardInsights,
    buildActivityInsights,
    buildPowerInsights,
    buildTimelineInsights,
    buildToolsInsights,
    pct,
    pluralize,
    longestSession,
} from '../editorialInsights';
import type { DailyDigest, FocusSession } from '../focusSessions';
import type { AppUsageEntry } from '../../api/tauri';

const digest = (overrides: Partial<DailyDigest> = {}): DailyDigest => ({
    focusSeconds: 3600,
    sessionCount: 3,
    peakHour: '10 AM',
    topAppName: 'Code.exe',
    deltaVsPrevious: 900,
    ...overrides,
});

const session = (overrides: Partial<FocusSession> = {}): FocusSession => ({
    startTime: 1700000000000,
    endTime: 1700003600000,
    durationSeconds: 3600,
    appName: 'Code.exe',
    interruptions: 0,
    ...overrides,
});

const usage = (name: string, seconds: number): AppUsageEntry => ({ name, seconds });

describe('shared helpers', () => {
    it('pct rounds part/whole to a whole percent', () => {
        expect(pct(1, 4)).toBe(25);
        expect(pct(1, 3)).toBe(33);
        expect(pct(5, 0)).toBe(0);
        expect(pct(5, -2)).toBe(0);
    });

    it('pluralize picks singular/plural by count', () => {
        expect(pluralize(1, 'session', 'sessions')).toBe('session');
        expect(pluralize(2, 'session', 'sessions')).toBe('sessions');
    });

    it('longestSession returns the max-duration session or null', () => {
        expect(longestSession([])).toBeNull();
        const short = session({ durationSeconds: 1500 });
        const long = session({ durationSeconds: 4320, appName: 'Figma.exe' });
        expect(longestSession([short, long])).toBe(long);
    });

});

describe('buildDashboardInsights', () => {
    it('reports the peak hour with its focus share', () => {
        const insights = buildDashboardInsights(
            digest(),
            [],
            [{ time: '10 AM', focus: 87 }, { time: '11 AM', focus: 40 }]);
        expect(insights[0]).toEqual({
            label: 'PEAK HOUR',
            text: 'Focus peaked at 10 AM — 87% of that hour was deep work.',
        });
    });

    it('reports the longest session with app and interruptions when present', () => {
        const insights = buildDashboardInsights(
            digest(),
            [
                session({ durationSeconds: 3600, appName: 'Code.exe', interruptions: 2 }),
                session({ durationSeconds: 1500, appName: 'Figma.exe', interruptions: 0 }),
            ],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights).toContainEqual({
            label: 'LONGEST RUN',
            text: '1h uninterrupted in Code.exe — 2 interruptions.',
        });
    });

    it('omits the interruptions clause when the longest session had none', () => {
        const insights = buildDashboardInsights(
            digest(),
            [session({ durationSeconds: 3600, interruptions: 0 })],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights).toContainEqual({
            label: 'LONGEST RUN',
            text: '1h uninterrupted in Code.exe.',
        });
    });

    it('reports a positive delta vs yesterday', () => {
        const insights = buildDashboardInsights(
            digest({ deltaVsPrevious: 900 }),
            [],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights).toContainEqual({
            label: 'VS YESTERDAY',
            text: '15m more focus than yesterday.',
        });
    });

    it('reports a negative delta vs yesterday', () => {
        const insights = buildDashboardInsights(
            digest({ deltaVsPrevious: -1800 }),
            [],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights).toContainEqual({
            label: 'VS YESTERDAY',
            text: '30m less focus than yesterday.',
        });
    });

    it('omits the delta row when the comparison is unknown', () => {
        const insights = buildDashboardInsights(
            digest({ deltaVsPrevious: null }),
            [],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights.find((i) => i.label === 'VS YESTERDAY')).toBeUndefined();
    });

    it('omits the peak-hour row when there is no peak', () => {
        const insights = buildDashboardInsights(
            digest({ peakHour: null }),
            [],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights.find((i) => i.label === 'PEAK HOUR')).toBeUndefined();
    });

    it('caps at three insights, priority peak > longest run > delta', () => {
        const insights = buildDashboardInsights(
            digest(),
            [session({ durationSeconds: 3600, interruptions: 1 })],
            [{ time: '10 AM', focus: 87 }]);
        expect(insights.length).toBeLessThanOrEqual(3);
        expect(insights.map((i) => i.label)).toEqual(['PEAK HOUR', 'LONGEST RUN', 'VS YESTERDAY']);
    });

    it('returns [] when nothing meaningful exists', () => {
        expect(buildDashboardInsights(digest({ peakHour: null, deltaVsPrevious: null }), [], [])).toEqual([]);
        expect(buildDashboardInsights(digest({ peakHour: null, deltaVsPrevious: null }), [session({ durationSeconds: 1499 })], [])).toEqual([]);
    });
});

describe('buildActivityInsights', () => {
    it('reports the strongest day with its minutes', () => {
        const insights = buildActivityInsights(
            [
                { day: 'Monday', minutes: 90 },
                { day: 'Wednesday', minutes: 214 },
                { day: 'Friday', minutes: 60 },
            ],
            [usage('Code.exe', 3600)],
            3600
        );
        expect(insights[0]).toEqual({
            label: 'STRONGEST DAY',
            text: 'Wednesday carried the week — 214 min of focus.',
        });
    });

    it('reports the top app share of active time', () => {
        const insights = buildActivityInsights(
            [{ day: 'Monday', minutes: 90 }],
            [usage('Code.exe', 3600), usage('Chrome.exe', 6000)],
            9600
        );
        expect(insights).toContainEqual({
            label: 'LEADING APP',
            text: 'Code.exe led at 38% of active time.',
        });
    });

    it('returns [] when there is no weekly data', () => {
        expect(buildActivityInsights([], [], 0)).toEqual([]);
    });
});

describe('buildPowerInsights', () => {
    it('reports the top consumer and its share of the draw', () => {
        const insights = buildPowerInsights([
            { app: 'Chrome.exe', power: 18 },
            { app: 'Code.exe', power: 9 },
        ], 23, 12);
        expect(insights[0]).toEqual({
            label: 'TOP DRAW',
            text: 'Chrome asks for the most — 18W, about 67% of the draw.',
        });
    });

    it('reports CPU and process count', () => {
        const insights = buildPowerInsights([{ app: 'Chrome.exe', power: 18 }], 23, 12);
        expect(insights).toContainEqual({
            label: 'LOAD',
            text: '12 processes sampled at 23% CPU.',
        });
    });

    it('returns [] when nothing is sampled', () => {
        expect(buildPowerInsights([], 0, 0)).toEqual([]);
    });
});

describe('buildTimelineInsights', () => {
    // Real shape from Timeline.tsx: { time: "08/06/2026 15:00", items: WindowEvent[] }
    const groups = [
        { time: '08/06/2026 15:00', items: Array.from({ length: 14 }, () => ({ id: 'x' })) },
        { time: '08/06/2026 09:00', items: Array.from({ length: 6 }, () => ({ id: 'y' })) },
    ];

    it('reports the busiest hour group', () => {
        const insights = buildTimelineInsights(groups, []);
        expect(insights[0]).toEqual({
            label: 'BUSIEST HOUR',
            text: '3 PM was the busiest hour — 14 window events.',
        });
    });

    it('reports the longest session in the range', () => {
        const insights = buildTimelineInsights(
            groups,
            [session({ durationSeconds: 4500, appName: 'Code.exe', interruptions: 1 })]
        );
        expect(insights).toContainEqual({
            label: 'LONGEST RUN',
            text: '1h 15m uninterrupted in Code.exe — 1 interruption.',
        });
    });

    it('returns [] when the range is empty', () => {
        expect(buildTimelineInsights([], [])).toEqual([]);
    });
});

describe('buildToolsInsights', () => {
    const wellbeing = { needsBreak: false, sedentaryMinutes: 30 };

    it('reports goals met and the gap to an unmet goal', () => {
        const insights = buildToolsInsights(3, 2, 3, wellbeing);
        expect(insights[0]).toEqual({
            label: 'TARGETS',
            text: '2 of 3 targets met — 1 still to reach.',
        });
    });

    it('reports all targets met without inventing a gap', () => {
        const insights = buildToolsInsights(3, 3, 3, wellbeing);
        expect(insights[0]).toEqual({
            label: 'TARGETS',
            text: 'All 3 targets met today.',
        });
    });

    it('advises a break only when the wellbeing data calls for it', () => {
        const ok = buildToolsInsights(3, 2, 3, wellbeing);
        expect(ok.find((i) => i.label === 'BREAK')).toBeUndefined();

        const due = buildToolsInsights(3, 2, 3, { needsBreak: true, sedentaryMinutes: 160 });
        expect(due).toContainEqual({
            label: 'BREAK',
            text: 'You have been seated 2h 40m — time for a walk.',
        });
    });

    it('reports pomodoro count when there were any', () => {
        const insights = buildToolsInsights(4, 2, 3, wellbeing);
        expect(insights).toContainEqual({
            label: 'POMODOROS',
            text: '4 pomodoros closed today.',
        });
    });

    it('returns [] when nothing happened', () => {
        expect(buildToolsInsights(0, 0, 0, wellbeing)).toEqual([]);
    });
});
