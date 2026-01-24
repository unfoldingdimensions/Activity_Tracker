/**
 * React Query hooks for tracker data with Tauri/browser fallback
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../utils/isTauri';
import {
    getAppUsage,
    getDailyStats,
    getActiveWindow,
    getIdleSeconds,
    getTimeline,
    getRecentEvents,
    type AppUsageEntry,
    type DailyStats,
    type ActiveWindow,
    type TimelineSegment,
    type WindowEvent,
    formatDuration,
} from '../api/tauri';

// ============ Mock Data for Browser Mode ============

const MOCK_APP_USAGE: AppUsageEntry[] = [
    { name: 'VS Code', seconds: 7200 },
    { name: 'Chrome', seconds: 5400 },
    { name: 'Slack', seconds: 2700 },
    { name: 'Terminal', seconds: 1800 },
    { name: 'Other', seconds: 900 },
];

const MOCK_DAILY_STATS: DailyStats = {
    total_active_seconds: 24120,
    total_idle_seconds: 3600,
    total_keystrokes: 12493,
    total_mouse_clicks: 2847,
    total_mouse_distance: 45000,
};

const MOCK_ACTIVE_WINDOW: ActiveWindow = {
    process_name: 'Code.exe',
    window_title: 'Dashboard.tsx - Activity Tracker',
};

const MOCK_TIMELINE: TimelineSegment[] = Array.from({ length: 12 }, (_, i) => ({
    time: `${i + 9}:00`,
    active_seconds: Math.random() * 3000,
    idle_seconds: Math.random() * 600,
}));

const MOCK_EVENTS: WindowEvent[] = [
    { timestamp: new Date().toISOString(), process_name: 'Code.exe', window_title: 'Dashboard.tsx', duration_seconds: 300 },
    { timestamp: new Date(Date.now() - 300000).toISOString(), process_name: 'Chrome.exe', window_title: 'Google Search', duration_seconds: 120 },
];

// ============ Hooks ============

/**
 * Get app usage data with auto-refresh
 */
export function useAppUsage() {
    return useQuery({
        queryKey: ['appUsage'],
        queryFn: async () => {
            if (isTauri()) {
                const data = await getAppUsage();
                return data;
            }
            return MOCK_APP_USAGE;
        },
        refetchInterval: 5000,
        staleTime: 4000,
    });
}

/**
 * Get daily stats with auto-refresh
 */
export function useDailyStats() {
    return useQuery({
        queryKey: ['dailyStats'],
        queryFn: async () => {
            if (isTauri()) {
                const data = await getDailyStats();
                return data;
            }
            return MOCK_DAILY_STATS;
        },
        refetchInterval: 5000,
        staleTime: 4000,
    });
}

/**
 * Get activity timeline
 */
export function useTimeline() {
    return useQuery({
        queryKey: ['timeline'],
        queryFn: async () => {
            if (isTauri()) {
                const data = await getTimeline();
                return data;
            }
            return MOCK_TIMELINE;
        },
        refetchInterval: 10000,
        staleTime: 9000,
    });
}

/**
 * Get recent window events
 */
export function useRecentEvents() {
    return useQuery({
        queryKey: ['recentEvents'],
        queryFn: async () => {
            if (isTauri()) {
                const data = await getRecentEvents();
                return data;
            }
            return MOCK_EVENTS;
        },
        refetchInterval: 2000,
        staleTime: 1000,
    });
}

/**
 * Get current active window with auto-refresh
 */
export function useActiveWindow() {
    return useQuery({
        queryKey: ['activeWindow'],
        queryFn: async () => {
            if (isTauri()) {
                const data = await getActiveWindow();
                return data;
            }
            return MOCK_ACTIVE_WINDOW;
        },
        refetchInterval: 1000,
        staleTime: 500,
    });
}

/**
 * Get idle status with auto-refresh
 */
export function useIdleStatus() {
    return useQuery({
        queryKey: ['idleStatus'],
        queryFn: async () => {
            if (isTauri()) {
                const seconds = await getIdleSeconds();
                return {
                    idleSeconds: seconds,
                    isIdle: seconds > 60,
                };
            }
            return {
                idleSeconds: 0,
                isIdle: false,
            };
        },
        refetchInterval: 1000,
        staleTime: 500,
    });
}

// ============ Derived Data Helpers ============

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

    const total = stats.total_active_seconds + stats.total_idle_seconds;
    const focusScore = total > 0
        ? Math.round((stats.total_active_seconds / total) * 100)
        : 0;

    return {
        screenTime: formatDuration(stats.total_active_seconds),
        mouseActivity: stats.total_mouse_clicks.toLocaleString(),
        keystrokes: stats.total_keystrokes.toLocaleString(),
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

    const colors = ['#1c1917', '#a16207', '#0f766e', '#7c3aed', '#78716c', '#be185d'];

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
