/**
 * Tauri API bindings for Activity Tracker backend
 */

import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

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
    /** Wall-clock span of the event, first tick -> last tick. Includes idle time. */
    duration_seconds: number;
    /**
     * Seconds inside that span where the machine was not idle. Absent on rows
     * recorded before the column existed (see `withActiveDuration`).
     */
    active_seconds?: number | null;
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

export async function getTimelineRangePaginated(
    startIso: string,
    endIso: string,
    limit: number,
    offset: number
): Promise<WindowEvent[]> {
    return invoke<WindowEvent[]>('get_timeline_range_paginated', { startIso, endIso, limit, offset });
}

/**
 * Get window events for specific app in range
 *
 * @deprecated unbounded: the worst app returns 11,466 rows today and grows with history. Use
 * `getTimelineRangeForAppPaginated`, which returns one page plus the total (D-039).
 */
export async function getTimelineRangeForApp(processName: string, startIso: string, endIso: string): Promise<WindowEvent[]> {
    return invoke<WindowEvent[]>('get_timeline_range_for_app', { processName, startIso, endIso });
}

/** One page of an app's events plus the total the page was drawn from. */
export interface AppEventsPage {
    events: WindowEvent[];
    total: number;
}

/**
 * One page of window events for a specific app in range, newest first.
 *
 * The total is what lets a screen say "newest N of M" instead of showing a page as if it were the
 * whole range (AGENTS.md §1.4).
 */
export async function getTimelineRangeForAppPaginated(
    processName: string,
    startIso: string,
    endIso: string,
    limit: number,
    offset: number
): Promise<AppEventsPage> {
    return invoke<AppEventsPage>('get_timeline_range_for_app_paginated', {
        processName,
        startIso,
        endIso,
        limit,
        offset,
    });
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
 * Check whether tracking is currently active
 */
export async function isTracking(): Promise<boolean> {
    return invoke<boolean>('is_tracking');
}

/**
 * Event name every webview listens on for "the recorder changed state".
 *
 * The rail and the tray popup are separate webviews with separate React Query caches, so a pause in one left the other
 * showing the old word until it happened to refetch. One name, exported, emitted by the mutation and listened to by
 * every hook instance.
 */
export const TRACKING_CHANGED_EVENT = 'tracking-changed';

/** Announce a tracking change to every window this app owns. */
export async function notifyTrackingChanged(): Promise<void> {
    await emit(TRACKING_CHANGED_EVENT);
}

/** Subscribe to tracking changes; resolves to the unlisten function. */
export async function onTrackingChanged(handler: () => void): Promise<UnlistenFn> {
    return listen(TRACKING_CHANGED_EVENT, () => handler());
}

/**
 * Get all stored settings (JSON key-value map; defaults applied client-side)
 */
export async function getSettings(): Promise<Record<string, unknown>> {
    return invoke<Record<string, unknown>>('get_settings');
}

/**
 * Persist settings to the backend (database + runtime tracker)
 */
export async function setSettings(settings: Record<string, unknown>): Promise<void> {
    return invoke<void>('set_settings', { settings });
}

/**
 * Export all tracking data to a file ('csv' | 'json')
 */
export async function exportData(path: string, format: 'csv' | 'json'): Promise<void> {
    return invoke<void>('export_data', { path, format });
}

/**
 * All app-usage rows across all dates ([date, process_name, seconds][])
 */
export async function getAppUsageAll(): Promise<[string, string, number][]> {
    return invoke<[string, string, number][]>('get_all_app_usage');
}

/**
 * Top-CPU processes sampled by the backend ([name, cpuPercent][])
 */
export async function getCpuSnapshot(): Promise<[string, number][]> {
    return invoke<[string, number][]>('get_cpu_snapshot');
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
 * Show the main window, optionally navigating it to a route first.
 *
 * The backend emits a `navigate` event carrying the path before showing the window, so it arrives on the requested
 * page rather than flashing whichever one it was last on.
 */
export async function showMainWindow(path?: string): Promise<void> {
    return invoke<void>('show_main_window', { path: path ?? null });
}

/**
 * Hide the tray popup. The backend owns the window, so closing the popup is a command, not a UI state change.
 */
export async function hideTrayWindow(): Promise<void> {
    return invoke<void>('hide_tray_window');
}

/**
 * Icon for a process, as a `data:image/png;base64,…` URL, or `null` when this machine has no icon for it.
 *
 * `null` is a normal answer — the caller draws a letter tile — so it is not an error.
 */
export async function getAppIcon(processName: string): Promise<string | null> {
    return invoke<string | null>('get_app_icon', { processName });
}
