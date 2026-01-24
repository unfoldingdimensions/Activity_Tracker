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
    return `${minutes}m`;
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
