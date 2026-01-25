/**
 * Mock data for browser development mode
 * Used when not running in Tauri environment
 */

import type {
    AppUsageEntry,
    DailyStats,
    ActiveWindow,
    TimelineSegment,
    WindowEvent,
    UserStats,
    InputHistoryBucket,
} from '../../api/tauri';

export const MOCK_APP_USAGE: AppUsageEntry[] = [
    { name: 'VS Code', seconds: 7200 },
    { name: 'Chrome', seconds: 5400 },
    { name: 'Slack', seconds: 2700 },
    { name: 'Terminal', seconds: 1800 },
    { name: 'Other', seconds: 900 },
];

export const MOCK_DAILY_STATS: DailyStats = {
    total_active_seconds: 24120,
    total_idle_seconds: 3600,
    total_keystrokes: 12493,
    total_mouse_clicks: 2847,
    total_mouse_distance: 45000,
};

export const MOCK_ACTIVE_WINDOW: ActiveWindow = {
    process_name: 'Code.exe',
    window_title: 'Dashboard.tsx - Activity Tracker',
};

export const MOCK_TIMELINE: TimelineSegment[] = Array.from({ length: 12 }, (_, i) => ({
    time: `${i + 9}:00`,
    active_seconds: Math.random() * 3000,
    idle_seconds: Math.random() * 600,
}));

export const MOCK_EVENTS: WindowEvent[] = [
    { timestamp: new Date().toISOString(), process_name: 'Code.exe', window_title: 'Dashboard.tsx', duration_seconds: 300 },
    { timestamp: new Date(Date.now() - 300000).toISOString(), process_name: 'Chrome.exe', window_title: 'Google Search', duration_seconds: 120 },
];

export const MOCK_USER_STATS: UserStats = {
    total_xp: 450,
    current_level: 2,
    current_streak: 3,
    last_activity_date: new Date().toISOString().split('T')[0],
};

export const MOCK_ACHIEVEMENTS: string[] = ['early_bird'];

export const MOCK_INPUT_HISTORY: InputHistoryBucket[] = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    keystrokes: Math.floor(Math.random() * 500),
    mouse_clicks: Math.floor(Math.random() * 100),
}));
