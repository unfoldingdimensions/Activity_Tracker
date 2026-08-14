/**
 * Daily Stats Hooks
 * Queries for daily statistics data
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { useVisibility } from '../../context/VisibilityContext';
import { getDailyStats, getStatsRange, type DailyStats } from '../../api/tauri';
import { MOCK_DAILY_STATS } from './mockData';

/**
 * Get daily stats with auto-refresh
 * 
 * @example
 * ```tsx
 * const { data: stats, isLoading } = useDailyStats();
 * console.log(stats?.total_keystrokes);
 * ```
 */
export function useDailyStats() {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['dailyStats'],
        queryFn: async (): Promise<DailyStats | null> => {
            if (isTauri()) {
                return await getDailyStats();
            }
            return MOCK_DAILY_STATS;
        },
        refetchInterval: visible ? 5000 : false,
        staleTime: 4000,
    });
}

/**
 * Get stats for a custom time range
 */
export function useStatsRange(startIso: string, endIso: string, enabled: boolean = true) {
    return useQuery({
        queryKey: ['statsRange', startIso, endIso],
        queryFn: async (): Promise<DailyStats> => {
            if (isTauri()) {
                return await getStatsRange(startIso, endIso);
            }
            return MOCK_DAILY_STATS;
        },
        enabled: enabled && !!startIso && !!endIso,
    });
}

