/**
 * Gamification Hooks
 * Queries for XP, levels, achievements, and streaks
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { useVisibility } from '../../context/VisibilityContext';
import { getUserStats, getUnlockedAchievements, type UserStats } from '../../api/tauri';
import { MOCK_USER_STATS, MOCK_ACHIEVEMENTS } from './mockData';

/**
 * Get user stats (XP, level, streak) with auto-refresh
 * 
 * @example
 * ```tsx
 * const { data: stats } = useUserStats();
 * console.log(stats?.current_level, stats?.total_xp);
 * ```
 */
export function useUserStats() {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['userStats'],
        queryFn: async (): Promise<UserStats | null> => {
            if (isTauri()) {
                return await getUserStats();
            }
            return MOCK_USER_STATS;
        },
        refetchInterval: visible ? 10000 : false,
        staleTime: 5000,
    });
}

/**
 * Get unlocked achievements
 * 
 * @example
 * ```tsx
 * const { data: achievements } = useUnlockedAchievements();
 * const hasEarlyBird = achievements?.includes('early_bird');
 * ```
 */
export function useUnlockedAchievements() {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['unlockedAchievements'],
        queryFn: async (): Promise<string[]> => {
            if (isTauri()) {
                return await getUnlockedAchievements();
            }
            return MOCK_ACHIEVEMENTS;
        },
        refetchInterval: visible ? 30000 : false,
        staleTime: 10000,
    });
}
