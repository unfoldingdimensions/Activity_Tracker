/**
 * Daily Stats Hooks
 * Queries for daily statistics data
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { getDailyStats, type DailyStats } from '../../api/tauri';
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
    return useQuery({
        queryKey: ['dailyStats'],
        queryFn: async (): Promise<DailyStats | null> => {
            if (isTauri()) {
                return await getDailyStats();
            }
            return MOCK_DAILY_STATS;
        },
        refetchInterval: 5000,
        staleTime: 4000,
    });
}
