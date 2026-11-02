import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTrackingControl } from '../useTrackingControl';
import { createWrapper } from '../../test/utils';
import * as tauri from '../../api/tauri';
import { isTauri } from '../../utils/isTauri';

vi.mock('../../api/tauri', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/tauri')>();
    return {
        ...actual,
        isTracking: vi.fn(),
        startTracking: vi.fn(),
        stopTracking: vi.fn(),
        notifyTrackingChanged: vi.fn().mockResolvedValue(undefined),
        onTrackingChanged: vi.fn().mockResolvedValue(() => {}),
    };
});

vi.mock('../../utils/isTauri', () => ({
    isTauri: vi.fn(),
}));

describe('useTrackingControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
        vi.mocked(tauri.notifyTrackingChanged).mockResolvedValue(undefined);
        vi.mocked(tauri.onTrackingChanged).mockResolvedValue(() => {});
    });

    it('reads the recorder state from the backend', async () => {
        vi.mocked(tauri.isTracking).mockResolvedValue(false);

        const { result } = renderHook(() => useTrackingControl(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isTracking).toBe(false));
    });

    it('treats an unanswered read as recording, never as paused', async () => {
        // A false negative here would tell the user their activity is not being recorded while it is.
        vi.mocked(tauri.isTracking).mockResolvedValue(null as unknown as boolean);

        const { result } = renderHook(() => useTrackingControl(), { wrapper: createWrapper() });

        await waitFor(() => expect(tauri.isTracking).toHaveBeenCalled());
        expect(result.current.isTracking).toBe(true);
    });

    it('does not report paused when the stop command fails', async () => {
        vi.mocked(tauri.isTracking).mockResolvedValue(true);
        vi.mocked(tauri.stopTracking).mockRejectedValue(new Error('ipc closed'));

        const { result } = renderHook(() => useTrackingControl(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isTracking).toBe(true));

        await act(async () => {
            await expect(result.current.setTracking(false)).rejects.toThrow('ipc closed');
        });

        expect(result.current.isTracking).toBe(true);
        expect(result.current.error).toBeTruthy();
    });

    it('re-reads the backend after a successful pause', async () => {
        vi.mocked(tauri.isTracking).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        vi.mocked(tauri.stopTracking).mockResolvedValue(undefined);

        const { result } = renderHook(() => useTrackingControl(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isTracking).toBe(true));

        await act(async () => {
            await result.current.setTracking(false);
        });

        expect(tauri.stopTracking).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.isTracking).toBe(false));
    });

    it('announces the change so the other window stops showing the old state', async () => {
        // Measured on the installed build: pausing in the tray popup left the rail saying PAUSED, because the two
        // webviews have separate caches and nothing told the second one.
        vi.mocked(tauri.isTracking).mockResolvedValue(true);
        vi.mocked(tauri.stopTracking).mockResolvedValue(undefined);

        const { result } = renderHook(() => useTrackingControl(), { wrapper: createWrapper() });
        await waitFor(() => expect(tauri.isTracking).toHaveBeenCalled());

        await act(async () => {
            await result.current.setTracking(false);
        });

        expect(tauri.notifyTrackingChanged).toHaveBeenCalledTimes(1);
    });
});
