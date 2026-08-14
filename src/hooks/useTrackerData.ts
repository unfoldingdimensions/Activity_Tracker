/**
 * React Query hooks for tracker data
 * 
 * @deprecated Import from './queries' instead for domain-specific hooks.
 * This file re-exports all hooks for backwards compatibility.
 * 
 * @example
 * ```tsx
 * // New way (preferred):
 * import { useAppUsage, useDailyStats } from '../hooks/queries';
 * 
 * // Old way (still works):
 * import { useAppUsage, useDailyStats } from '../hooks/useTrackerData';
 * ```
 */

import { formatDuration } from '../utils/formatters';
import type { DailyStats } from '../api/tauri';

// Re-export all hooks from new locations
export {
    useAppUsage,
    useAppUsageRange,
} from './queries/useAppUsage';

export { useDailyStats } from './queries/useDailyStats';

export {
    useTimeline,
    useRecentEvents,
    useTimelineEventsRange,
    useTimelineRangeForApp,
} from './queries/useTimeline';

export {
    useUserStats,
    useUnlockedAchievements,
} from './queries/useGamification';

export {
    useActiveWindow,
    useIdleStatus,
    useInputHistory,
} from './queries/useSystem';

export type { IdleStatus } from './queries/useSystem';

// ============ Derived Data Helpers ============
// These formatters remain here as they're data transformation, not queries

/**
 * Format stats for Dashboard cards
 */
export function formatStatsForCards(stats: DailyStats | null | undefined) {
    if (!stats) {
        return {
            screenTime: '0m',
            mouseActivity: '0',
            keystrokes: '0',
            focusScore: 0,
        };
    }

    const active = stats.total_active_seconds || 0;
    const idle = stats.total_idle_seconds || 0;
    const clicks = stats.total_mouse_clicks || 0;
    const keys = stats.total_keystrokes || 0;

    const total = active + idle;
    const focusScore = total > 0
        ? Math.round((active / total) * 100)
        : 0;

    return {
        screenTime: formatDuration(active),
        mouseActivity: clicks.toLocaleString(),
        keystrokes: keys.toLocaleString(),
        focusScore,
    };
}
