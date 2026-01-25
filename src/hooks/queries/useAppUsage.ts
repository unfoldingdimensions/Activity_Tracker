/**
 * App Usage Hooks
 * Queries for application usage data
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { getAppUsage, getAppUsageRange, type AppUsageEntry } from '../../api/tauri';
import { MOCK_APP_USAGE } from './mockData';

/**
 * Get app usage data for today with auto-refresh
 * 
 * @example
 * ```tsx
 * const { data: appUsage, isLoading } = useAppUsage();
 * ```
 */
export function useAppUsage() {
    return useQuery({
        queryKey: ['appUsage'],
        queryFn: async (): Promise<AppUsageEntry[]> => {
            if (isTauri()) {
                return await getAppUsage();
            }
            return MOCK_APP_USAGE;
        },
        refetchInterval: 5000,
        staleTime: 4000,
    });
}

/**
 * Get app usage in a custom date range
 * 
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param enabled - Whether the query is enabled
 * 
 * @example
 * ```tsx
 * const { data } = useAppUsageRange('2024-01-01', '2024-01-07', true);
 * ```
 */
export function useAppUsageRange(
    startDate: string,
    endDate: string,
    enabled = true
) {
    return useQuery({
        queryKey: ['appUsageRange', startDate, endDate],
        queryFn: async (): Promise<AppUsageEntry[]> => {
            if (isTauri()) {
                return await getAppUsageRange(startDate, endDate);
            }
            return MOCK_APP_USAGE;
        },
        enabled,
        refetchInterval: 5000,
    });
}
