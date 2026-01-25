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
import { CHART_COLORS } from '../constants/colors';
import type { DailyStats, AppUsageEntry, TimelineSegment } from '../api/tauri';

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

/**
 * Format app usage for pie chart
 */
export function formatAppUsageForChart(usage: AppUsageEntry[] | undefined) {
    if (!usage || usage.length === 0) {
        return [];
    }

    const colors = CHART_COLORS;

    return usage.slice(0, 6).map((entry, i) => ({
        name: entry.name.replace('.exe', ''),
        value: Math.round(entry.seconds / 60), // Convert to minutes
        color: colors[i % colors.length],
    }));
}

/**
 * Format timeline for bar charts
 */
export function formatTimelineForChart(timeline: TimelineSegment[] | undefined) {
    if (!timeline || timeline.length === 0) return [];

    return timeline.map(segment => ({
        time: segment.time,
        active: Math.round(segment.active_seconds / 60), // Minutes
        idle: Math.round(segment.idle_seconds / 60),
        // Simulate other metrics for now until backend supports them
        keystrokes: Math.round(segment.active_seconds * 1.5),
        clicks: Math.round(segment.active_seconds * 0.5),
    }));
}
