/**
 * Centralized type definitions for Activity Tracker
 * Import all shared types from this file
 */

// Re-export types from API layer (single source of truth)
export type {
    ActiveWindow,
    AppUsageEntry,
    DailyStats,
    TimelineSegment,
    WindowEvent,
    InputHistoryBucket,
    UserStats,
} from '../api/tauri';

// ============ Chart Types ============

export interface ChartDataPoint {
    name: string;
    value: number;
    color?: string;
}

export interface TimelineChartData {
    time: string;
    focus: number;
    distraction: number;
}

// ============ Component Props Types ============

export interface StatCardData {
    label: string;
    value: string;
    numericValue: number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    change: string;
    positive: boolean;
    clickable: boolean;
}

// ============ State Types ============

export interface IdleStatus {
    isIdle: boolean;
    idleSeconds: number;
}

// ============ Gamification Types ============

export interface Achievement {
    code: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt?: string;
}

// ============ Wellbeing Types ============

export interface BreakReminder {
    type: 'eye' | 'stretch' | 'walk';
    interval: number; // minutes
    lastReminder?: Date;
}

// ============ Settings Types ============

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    trackingEnabled: boolean;
    idleThreshold: number; // seconds
    blacklistedApps: string[];
}
