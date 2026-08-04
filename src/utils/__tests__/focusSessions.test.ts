import { describe, it, expect } from 'vitest';
import { computeFocusSessions, buildDigest, MIN_FOCUS_SESSION_SECONDS } from '../focusSessions';
import type { WindowEvent } from '../../api/tauri';
import type { AppClassification } from '../../context/SettingsContext';

const T0 = Date.UTC(2026, 7, 5, 9, 0, 0); // 09:00 UTC

function evt(
    offsetSec: number,
    processName: string,
    durationSec: number
): WindowEvent {
    return {
        timestamp: new Date(T0 + offsetSec * 1000).toISOString(),
        process_name: processName,
        window_title: null,
        duration_seconds: durationSec,
    };
}

function classifier(map: Record<string, AppClassification>) {
    return (name: string): AppClassification => map[name] ?? 'distraction';
}

const FOCUS = classifier({ code: 'focus' });
const MIXED = classifier({ code: 'focus', discord: 'distraction', spotify: 'ignore' });

describe('computeFocusSessions', () => {
    it('returns an empty list for no events', () => {
        expect(computeFocusSessions([], FOCUS)).toEqual([]);
    });

    it('detects a single contiguous focus block', () => {
        const events = [
            evt(0, 'code', 600),
            evt(600, 'code', 600),
            evt(1200, 'code', 600),
        ];
        const sessions = computeFocusSessions(events, FOCUS);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].durationSeconds).toBe(1800);
        expect(sessions[0].interruptions).toBe(0);
        expect(sessions[0].appName).toBe('code');
    });

    it('drops sessions shorter than the 25-minute threshold', () => {
        const events = [evt(0, 'code', 600)];
        expect(computeFocusSessions(events, FOCUS)).toEqual([]);
    });

    it('splits sessions across a gap longer than 2 minutes', () => {
        const events = [
            evt(0, 'code', 1500),
            evt(1800, 'code', 1500), // 30-min gap (1800s > 120s)
        ];
        const sessions = computeFocusSessions(events, FOCUS);
        expect(sessions).toHaveLength(2);
        expect(sessions[0].durationSeconds).toBe(1500);
        expect(sessions[1].durationSeconds).toBe(1500);
    });

    it('keeps a session together across a short gap and counts interruptions', () => {
        const events = [
            evt(0, 'code', 1500),
            evt(1501, 'discord', 30), // distraction inside the block
            evt(1560, 'code', 1500),
        ];
        const sessions = computeFocusSessions(events, MIXED);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].interruptions).toBe(1);
    });

    it('ignores ignore-classified apps entirely', () => {
        const events = [
            evt(0, 'code', 1500),
            evt(1500, 'spotify', 60), // ignored: neither extends nor interrupts
            evt(1560, 'code', 1500), // 60s gap stays inside the session
        ];
        const sessions = computeFocusSessions(events, MIXED);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].interruptions).toBe(0);
        // Wall-clock span (includes the 60s ignored-app gap)
        expect(sessions[0].durationSeconds).toBe(3060);
    });

    it('picks the dominant app in a mixed session', () => {
        const events = [
            evt(0, 'code', 1500),
            evt(1500, 'figma', 60),
            evt(1560, 'code', 1500),
        ];
        const sessions = computeFocusSessions(events, FOCUS);
        expect(sessions[0].appName).toBe('code');
    });

    it('handles out-of-order events', () => {
        const events = [
            evt(1200, 'code', 600),
            evt(0, 'code', 600),
            evt(600, 'code', 600),
        ];
        const sessions = computeFocusSessions(events, FOCUS);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].durationSeconds).toBe(1800);
    });

    it('exports a sane minimum threshold', () => {
        expect(MIN_FOCUS_SESSION_SECONDS).toBe(1500);
    });
});

describe('buildDigest', () => {
    const base = {
        focusSeconds: 6 * 3600,
        sessions: [{ startTime: 0, endTime: 1, durationSeconds: 1800, appName: 'code', interruptions: 0 }],
        timeline: [
            { time: '9 AM', focus: 10 },
            { time: '10 AM', focus: 90 },
            { time: '11 AM', focus: 40 },
        ],
        appUsage: [
            { name: 'Code', seconds: 12000 },
            { name: 'Chrome', seconds: 6000 },
        ],
        previousFocusSeconds: 5 * 3600,
    };

    it('finds peak hour and top app', () => {
        const digest = buildDigest(base);
        expect(digest.peakHour).toBe('10 AM');
        expect(digest.topAppName).toBe('Code');
        expect(digest.sessionCount).toBe(1);
        expect(digest.focusSeconds).toBe(21600);
    });

    it('computes the delta vs the previous period', () => {
        const digest = buildDigest(base);
        expect(digest.deltaVsPrevious).toBe(3600);
    });

    it('returns nulls when there is no data', () => {
        const digest = buildDigest({ ...base, timeline: [], appUsage: [], previousFocusSeconds: null });
        expect(digest.peakHour).toBeNull();
        expect(digest.topAppName).toBeNull();
        expect(digest.deltaVsPrevious).toBeNull();
    });
});
