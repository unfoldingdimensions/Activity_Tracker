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

// Top-CPU processes for the Power page in browser dev mode
export const MOCK_CPU_SNAPSHOT: [string, number][] = [
    ['Code.exe', 14.2],
    ['chrome.exe', 11.8],
    ['slack.exe', 4.6],
    ['WindowsTerminal.exe', 2.1],
    ['Spotify.exe', 1.3],
];

export const MOCK_TIMELINE: TimelineSegment[] = Array.from({ length: 12 }, (_, i) => ({
    time: `${i + 9}:00`,
    active_seconds: Math.random() * 3000,
    idle_seconds: Math.random() * 600,
}));

export const MOCK_EVENTS: WindowEvent[] = [
    { timestamp: new Date(Date.now() - 300000).toISOString(), process_name: 'Chrome.exe', window_title: 'Google Search', duration_seconds: 120 },
    { timestamp: new Date(Date.now() - 1500000).toISOString(), process_name: 'Code.exe', window_title: 'Dashboard.tsx', duration_seconds: 540 },
    { timestamp: new Date(Date.now() - 900000).toISOString(), process_name: 'Code.exe', window_title: 'Dashboard.tsx', duration_seconds: 540 },
    { timestamp: new Date(Date.now() - 300000).toISOString(), process_name: 'Code.exe', window_title: 'Dashboard.tsx', duration_seconds: 300 },
];

export const MOCK_USER_STATS: UserStats = {
    total_xp: 450,
    // Must match the level curve (floor(sqrt(450/100)) + 1 = 3)
    current_level: 3,
    current_streak: 3,
    last_activity_date: new Date().toISOString().split('T')[0],
};

export const MOCK_ACHIEVEMENTS: string[] = ['early_bird'];

// ISO-8601 timestamps (what the backend returns); kept parseable so charts
// in browser-dev mode don't render "Invalid Date"
export const MOCK_INPUT_HISTORY: InputHistoryBucket[] = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.now() - i * 3600_000).toISOString(),
    keystrokes: Math.floor(Math.random() * 500),
    mouse_clicks: Math.floor(Math.random() * 100),
}));
