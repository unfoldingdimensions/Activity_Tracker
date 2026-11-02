import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFocusBaseline } from '../useFocusBaseline';
import { createWrapper } from '../../test/utils';
import * as tauri from '../../api/tauri';
import { isTauri } from '../../utils/isTauri';

vi.mock('../../api/tauri', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/tauri')>();
    return { ...actual, getTimelineRangePaginated: vi.fn() };
});

vi.mock('../../utils/isTauri', () => ({ isTauri: vi.fn(() => true) }));

const event = (daysAgo: number, hour: number, seconds: number, process = 'code.exe') => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, 0, 0, 0);
    return {
        timestamp: d.toISOString(),
        process_name: process,
        window_title: '',
        duration_seconds: seconds,
    };
};

describe('useFocusBaseline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it('does not read seven days of events when the caller says the range is not hourly', async () => {
        // Week/Month buckets are days, so a per-hour reference has nothing to attach to.
        const { result } = renderHook(() => useFocusBaseline(7, false), { wrapper: createWrapper() });

        expect(result.current.byHour).toBeNull();
        expect(tauri.getTimelineRangePaginated).not.toHaveBeenCalled();
    });

    it('returns null instead of a partial baseline when there is not enough history', async () => {
        // Two days carry the same hour; the third day has nothing, so no hour reaches the three-sample minimum.
        vi.mocked(tauri.getTimelineRangePaginated).mockResolvedValue([
            event(1, 10, 1800) as never,
            event(2, 10, 1800) as never,
        ]);

        const { result } = renderHook(() => useFocusBaseline(7, true), { wrapper: createWrapper() });

        await waitFor(() => expect(tauri.getTimelineRangePaginated).toHaveBeenCalled());
        await waitFor(() => expect(result.current.byHour).toBeNull());
    });

    it('takes the median of the hour across days', async () => {
        vi.mocked(tauri.getTimelineRangePaginated).mockResolvedValue([
            event(1, 10, 1800) as never, // 50%
            event(2, 10, 3600) as never, // 100%
            event(3, 10, 900) as never, // 25%
        ]);

        const { result } = renderHook(() => useFocusBaseline(7, true), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.byHour).not.toBeNull());
        expect(result.current.byHour?.get(10)).toBe(50);
    });
});
