/**
 * Tauri API bindings for Activity Tracker backend
 */

import { invoke } from '@tauri-apps/api/core';

// Types matching Rust structs

export interface ActiveWindow {
    process_name: string;
    window_title: string;
}

export interface AppUsageEntry {
    name: string;
    seconds: number;
}

export interface DailyStats {
    total_active_seconds: number;
    total_idle_seconds: number;
    total_keystrokes: number;
    total_mouse_clicks: number;
    total_mouse_distance: number;
}

export interface TimelineSegment {
    time: string; // HH:MM
    active_seconds: number;
    idle_seconds: number;
}

export interface WindowEvent {
    timestamp: string;
    process_name: string;
    window_title: string | null;
    duration_seconds: number;
}

export interface InputHistoryBucket {
    time: string;
    keystrokes: number;
    mouse_clicks: number;
}

export interface UserStats {
    total_xp: number;
    current_level: number;
    current_streak: number;
    last_activity_date: string | null;
}

// API Functions

/**
 * Get the currently active window
 */
export async function getActiveWindow(): Promise<ActiveWindow | null> {
    return invoke<ActiveWindow | null>('get_active_window');
}

/**
 * Get app usage for today
 */
export async function getAppUsage(): Promise<AppUsageEntry[]> {
    return invoke<AppUsageEntry[]>('get_app_usage');
}

/**
 * Get daily stats
 */
export async function getDailyStats(): Promise<DailyStats | null> {
    return invoke<DailyStats | null>('get_daily_stats');
}

/**
 * Get stats for custom range
 */
export async function getStatsRange(startIso: string, endIso: string): Promise<DailyStats> {
    return invoke<DailyStats>('get_stats_range', { startIso, endIso });
}

/**
 * Get activity timeline for today
 */
export async function getTimeline(): Promise<TimelineSegment[]> {
    return invoke<TimelineSegment[]>('get_activity_timeline');
}

/**
 * Get recent window events
 */
export async function getRecentEvents(): Promise<WindowEvent[]> {
    return invoke<WindowEvent[]>('get_recent_events');
}

/**
 * Get window events in range
 */
export async function getTimelineRange(startIso: string, endIso: string): Promise<WindowEvent[]> {
    return invoke<WindowEvent[]>('get_timeline_range', { startIso, endIso });
}

/**
 * Get window events for specific app in range
 */
export async function getTimelineRangeForApp(processName: string, startIso: string, endIso: string): Promise<WindowEvent[]> {
    return invoke<WindowEvent[]>('get_timeline_range_for_app', { processName, startIso, endIso });
}

/**
 * Get app usage aggregated in range
 */
export async function getAppUsageRange(startDate: string, endDate: string): Promise<AppUsageEntry[]> {
    return invoke<AppUsageEntry[]>('get_app_usage_range', { startDate, endDate });
}

/**
 * Get input history for last 24h
 * @param intervalMinutes Bucket size in minutes
 */
export async function getInputHistory(intervalMinutes: number): Promise<InputHistoryBucket[]> {
    return invoke<InputHistoryBucket[]>('get_input_history', { intervalMinutes });
}

/**
 * Get input history in range
 */
export async function getInputHistoryRange(startIso: string, endIso: string, intervalMinutes: number): Promise<InputHistoryBucket[]> {
    return invoke<InputHistoryBucket[]>('get_input_history_range', { startIso, endIso, intervalMinutes });
}

/**
 * Check if the system is idle
 */
export async function isIdle(): Promise<boolean> {
    return invoke<boolean>('is_idle');
}

/**
 * Get idle time in seconds
 */
export async function getIdleSeconds(): Promise<number> {
    return invoke<number>('get_idle_seconds');
}

/**
 * Start the tracking loop
 */
export async function startTracking(): Promise<void> {
    return invoke<void>('start_tracking');
}

/**
 * Stop the tracking loop
 */
export async function stopTracking(): Promise<void> {
    return invoke<void>('stop_tracking');
}

/**
 * Clear all tracking data
 */
export async function clearData(): Promise<void> {
    return invoke<void>('clear_data');
}

/**
 * Get user stats (gamification)
 */
export async function getUserStats(): Promise<UserStats | null> {
    return invoke<UserStats | null>('get_user_stats');
}

/**
 * Get unlocked achievements
 */
export async function getUnlockedAchievements(): Promise<string[]> {
    return invoke<string[]>('get_unlocked_achievements');
}

/**
 * Unlock achievement (manual/debug)
 */
export async function unlockAchievement(code: string): Promise<boolean> {
    return invoke<boolean>('unlock_achievement', { code });
}

// Utility functions

/**
 * Format seconds as human-readable time
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${Math.floor(seconds)}s`;
}

/**
 * Calculate focus score (0-100) based on daily stats
 */
export function calculateFocusScore(stats: DailyStats | null): number {
    if (!stats) return 0;

    const totalSeconds = stats.total_active_seconds + stats.total_idle_seconds;
    if (totalSeconds === 0) return 0;

    const activeRatio = stats.total_active_seconds / totalSeconds;
    return Math.round(activeRatio * 100);
}
