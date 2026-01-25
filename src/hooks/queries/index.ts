/**
 * Barrel export for query hooks
 * Import hooks from this file for cleaner imports
 * 
 * @example
 * ```tsx
 * import { useAppUsage, useDailyStats, useTimeline } from '../hooks/queries';
 * ```
 */

// App Usage
export { useAppUsage, useAppUsageRange } from './useAppUsage';

// Daily Stats
export { useDailyStats, useStatsRange } from './useDailyStats';

// Timeline & Events
export {
    useTimeline,
    useRecentEvents,
    useTimelineEventsRange,
    useTimelineRangeForApp,
} from './useTimeline';

// Gamification
export { useUserStats, useUnlockedAchievements } from './useGamification';

// System
export { useActiveWindow, useIdleStatus, useInputHistory } from './useSystem';
export type { IdleStatus } from './useSystem';
