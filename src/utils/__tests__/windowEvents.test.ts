import { describe, it, expect } from 'vitest';
import { withActiveDuration, withActiveDurations } from '../windowEvents';
import type { WindowEvent } from '../../api/tauri';

function event(overrides: Partial<WindowEvent> = {}): WindowEvent {
    return {
        timestamp: '2026-10-28T09:00:00.000Z',
        process_name: 'Claude.exe',
        window_title: 'Claude',
        duration_seconds: 14832, // 4h 07m of wall clock, mostly idle
        ...overrides,
    };
}

describe('withActiveDuration', () => {
    it('uses active_seconds as the duration when the row has it', () => {
        const normalised = withActiveDuration(event({ active_seconds: 540 }));

        expect(normalised.duration_seconds).toBe(540);
        expect(normalised.wall_clock_seconds).toBe(14832);
    });

    it('treats active_seconds = 0 as a real value, not as missing', () => {
        // A window can hold focus for a tick while the machine is idle throughout.
        // A falsy fallback here would report the full wall-clock span instead.
        const normalised = withActiveDuration(event({ active_seconds: 0 }));

        expect(normalised.duration_seconds).toBe(0);
    });

    it('falls back to the wall-clock span when active_seconds is null', () => {
        const normalised = withActiveDuration(event({ active_seconds: null }));

        expect(normalised.duration_seconds).toBe(14832);
        expect(normalised.wall_clock_seconds).toBe(14832);
    });

    it('falls back to the wall-clock span when active_seconds is absent', () => {
        const normalised = withActiveDuration(event());

        expect(normalised.duration_seconds).toBe(14832);
    });

    it('keeps every other field untouched', () => {
        const normalised = withActiveDuration(event({ active_seconds: 540 }));

        expect(normalised.process_name).toBe('Claude.exe');
        expect(normalised.window_title).toBe('Claude');
        expect(normalised.timestamp).toBe('2026-10-28T09:00:00.000Z');
        expect(normalised.active_seconds).toBe(540);
    });

    it('normalises a page in order', () => {
        const page = [
            event({ timestamp: '2026-10-28T09:00:00.000Z', active_seconds: 10 }),
            event({ timestamp: '2026-10-28T09:01:00.000Z', active_seconds: null }),
        ];

        const normalised = withActiveDurations(page);

        expect(normalised.map((e) => e.duration_seconds)).toEqual([10, 14832]);
        expect(normalised.map((e) => e.timestamp)).toEqual(page.map((e) => e.timestamp));
    });
});
