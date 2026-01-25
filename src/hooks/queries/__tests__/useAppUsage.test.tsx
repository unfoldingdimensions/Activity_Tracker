
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppUsage, useAppUsageRange } from '../useAppUsage';
import { createWrapper } from '../../../test/utils';
import * as tauri from '../../../api/tauri';
import { MOCK_APP_USAGE } from '../mockData';

// Mock the Tauri API
vi.mock('../../../api/tauri', () => ({
    getAppUsage: vi.fn(),
    getAppUsageRange: vi.fn(),
    isTauri: vi.fn(), // If needed, but we mock the whole module usually or separate utils
}));

// We need to mock isTauri util since it's used in the hook
vi.mock('../../../utils/isTauri', () => ({
    isTauri: vi.fn(),
}));

import { isTauri } from '../../../utils/isTauri';

describe('useAppUsage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('fetches app usage data successfully when in Tauri environment', async () => {
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const mockData = [{ name: 'Code.exe', seconds: 120 }];
        (tauri.getAppUsage as any).mockResolvedValue(mockData);

        const { result } = renderHook(() => useAppUsage(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockData);
        expect(tauri.getAppUsage).toHaveBeenCalledTimes(1);
    });

    it('returns mock data when not in Tauri environment', async () => {
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

        const { result } = renderHook(() => useAppUsage(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(MOCK_APP_USAGE);
        expect(tauri.getAppUsage).not.toHaveBeenCalled();
    });
});

describe('useAppUsageRange', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('fetches range data successfully', async () => {
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const mockData = [{ name: 'Chrome.exe', seconds: 300 }];
        (tauri.getAppUsageRange as any).mockResolvedValue(mockData);

        const { result } = renderHook(() => useAppUsageRange('2024-01-01', '2024-01-02'), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockData);
        expect(tauri.getAppUsageRange).toHaveBeenCalledWith('2024-01-01', '2024-01-02');
    });

    it('respects the enabled flag', () => {
        (isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

        const { result } = renderHook(() => useAppUsageRange('2024-01-01', '2024-01-02', false), {
            wrapper: createWrapper(),
        });

        expect(result.current.isFetching).toBe(false);
        expect(tauri.getAppUsageRange).not.toHaveBeenCalled();
    });
});
