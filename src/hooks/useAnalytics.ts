
import { useMemo } from 'react';
import { useInputHistory, useRecentEvents } from './useTrackerData';

export interface FlowStateColors {
    score: number;
    label: string;
    color: string;
}

export interface AnalyticsMetrics {
    flowScore: number;
    contextSwitchingRate: number;
    longestStreak: number;
    isFlowing: boolean;
}

/**
 * Hook to derive analytics metrics from raw tracker data
 */
export function useAnalytics() {
    // Get last 60 minutes of input history (buckets are usually 1 min or 5 min)
    const { data: inputHistory } = useInputHistory(1, true);
    const { data: recentEvents } = useRecentEvents();

    const metrics: AnalyticsMetrics = useMemo(() => {
        if (!inputHistory || !recentEvents) {
            return {
                flowScore: 0,
                contextSwitchingRate: 0,
                longestStreak: 0,
                isFlowing: false
            };
        }

        // --- 1. Calculate Context Switching Rate (Switches per Hour) ---
        // Filter events in the last hour
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

        const recentSwitches = recentEvents.filter(e => {
            const eventTime = new Date(e.timestamp);
            return eventTime > oneHourAgo && e.window_title !== 'Activity Tracker';
        });

        // Count unique app switches (consecutive duplicates are already filtered by backend usually, but good to be safe)
        // For simplicity, we just use raw count of window events in the last hour as a proxy for "switches"
        // A "switch" is defined as a change in process_name or window_title
        const contextSwitchingRate = recentSwitches.length;


        // --- 2. Calculate Flow Score ---
        // Formula: (Intensity Score + Focus Score) / 2
        // Intensity: Based on keystrokes/mouse clicks
        // Focus: Inverse of context switching

        let totalInputs = 0;
        let activeMinutes = 0;

        // Analyze last 15 minutes for "Current Flow"
        const recentHistory = inputHistory.slice(-15);

        recentHistory.forEach(bucket => {
            const inputs = (bucket.keystrokes || 0) + (bucket.mouse_clicks || 0);
            totalInputs += inputs;
            if (inputs > 0) activeMinutes++;
        });

        const avgInputsPerMin = activeMinutes > 0 ? totalInputs / activeMinutes : 0;

        // Normalize Inputs: >60 inputs/min = 100% intensity
        const intensityScore = Math.min(100, (avgInputsPerMin / 60) * 100);

        // Normalize Switching: <6 switches/hour = 100% focus, >60 switches = 0%
        const switchingPenalty = Math.min(100, Math.max(0, (contextSwitchingRate - 5) * 2));
        const focusScore = 100 - switchingPenalty;

        const flowScore = Math.round((intensityScore * 0.6) + (focusScore * 0.4)); // Weight intensity slightly more


        // --- 3. Longest Flow Streak (Daily) ---
        // This calculates the longest contiguous block of "Flow" state today
        // A "Flow Block" is defined as a bucket with > 30 inputs

        let maxStreak = 0;
        let currentStreak = 0;

        inputHistory.forEach(bucket => {
            const inputs = (bucket.keystrokes || 0) + (bucket.mouse_clicks || 0);
            if (inputs > 30) {
                currentStreak++;
            } else {
                maxStreak = Math.max(maxStreak, currentStreak);
                currentStreak = 0;
            }
        });
        maxStreak = Math.max(maxStreak, currentStreak);


        return {
            flowScore,
            contextSwitchingRate,
            longestStreak: maxStreak, // In minutes (assuming 1 min buckets)
            isFlowing: flowScore > 75
        };

    }, [inputHistory, recentEvents]);

    return metrics;
}

// Re-export getFlowColor from centralized colors for backwards compatibility
export { getFlowColor } from '../constants/colors';
