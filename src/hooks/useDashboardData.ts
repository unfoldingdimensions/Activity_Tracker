import { useMemo } from 'react';
import {
    useAppUsage,
    useAppUsageRange,
    useDailyStats,
    useTimeline,
    useTimelineEventsRange,
    useStatsRange
} from './queries';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';
import type { AppUsageEntry, WindowEvent } from '../api/tauri';
import { formatStatsForCards } from './useTrackerData';
import { parseTimestamp, toLocalDateString } from '../utils/formatters';
import { useAppClassifier } from './useAppClassifier';
import { computeFocusSessions, buildDigest } from '../utils/focusSessions';

/** Re-exported for callers that only need the built-in default behavior */
export { isProductiveAppDefault as isProductiveApp } from '../utils/appClassification';

/**
 * Calculate overlap duration between an event and a time window
 */
function calculateOverlap(
    eventStart: number,
    eventDurationSecs: number,
    windowStart: number,
    windowEnd: number
): number {
    const eventEnd = eventStart + (eventDurationSecs * 1000);

    const overlapStart = Math.max(eventStart, windowStart);
    const overlapEnd = Math.min(eventEnd, windowEnd);

    if (overlapEnd <= overlapStart) return 0;

    return (overlapEnd - overlapStart) / 1000;
}

export function useDashboardData(timeRange: TimeRange) {
    // User-customizable per-app classifier (defaults + overrides)
    const classify = useAppClassifier();
    // 1. Calculate Date Range
    const { start, chartStart, end, isToday, isSubDay, bucketSizeMs } = useMemo(() => {
        const now = new Date();
        const end = new Date(now);
        const start = new Date(now);
        let isToday = false;
        let isSubDay = false; // Less than 24h, requiring client-side app usage calc

        let bucketSizeMs = 1000 * 60 * 30; // Default

        switch (timeRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                isToday = true;
                isSubDay = false; // We use daily stats for today
                bucketSizeMs = 1000 * 60 * 60; // 1h buckets for today
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                isSubDay = false; // Whole day
                bucketSizeMs = 1000 * 60 * 60; // 1h buckets
                break;
            case 'past_hour':
                start.setTime(now.getTime() - (60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 10; // Change to 10 min buckets as requested
                break;
            case 'past_6h':
                start.setTime(now.getTime() - (6 * 60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 30; // 30 min
                break;
            case 'past_12h':
                start.setTime(now.getTime() - (12 * 60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 60; // 1h
                break;
            case 'this_week':
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                isSubDay = false;
                bucketSizeMs = 1000 * 60 * 60 * 24; // 1 day
                break;
            case 'this_month':
                start.setDate(now.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                isSubDay = false;
                bucketSizeMs = 1000 * 60 * 60 * 24 * 7; // 1 week
                break;
        }

        // Align start time only for visualization (chartStart)
        const chartStart = new Date(start);
        if (timeRange !== 'today' && timeRange !== 'yesterday' && timeRange !== 'this_week' && timeRange !== 'this_month') {
            const alignedTime = Math.floor(chartStart.getTime() / bucketSizeMs) * bucketSizeMs;
            chartStart.setTime(alignedTime);
        }

        return { start, chartStart, end, isToday, isSubDay, bucketSizeMs };
    }, [timeRange]);

    // 2. Fetch Data

    // Case A: Today (Live) - Optimized hooks
    const dailyStatsQuery = useDailyStats();
    const appUsageQuery = useAppUsage();
    const timelineQuery = useTimeline();

    // Case B: Range (Historical / Sub-day)
    // Always fetch events for range to calculate focus flow and sub-day stats
    // We use chartStart here for the timeline so the first bucket is full
    const rangeEventsQuery = useTimelineEventsRange(
        chartStart.toISOString(),
        end.toISOString(),
        true // Always enabled
    );

    // Stats for range (Screen Time, Keystrokes, Clicks)
    // CRITICAL: Use the EXACT 'start' here, NOT the aligned 'chartStart'
    // to prevent showing "1h 5m" in a "Past Hour" range.
    const rangeStatsQuery = useStatsRange(
        start.toISOString(),
        end.toISOString(),
        !isToday // Enable only for non-today rolling ranges or historical days
    );

    // Fetch App Usage:
    // For >= 1 day ranges (Yesterday, Week, Month), use the range endpoint.
    // For < 1 day ranges (Past 1h, 6h), calculate from events (client-side) to avoid getting full-day data.
    const startDateStr = toLocalDateString(start);
    const endDateStr = toLocalDateString(end);
    const rangeAppUsageQuery = useAppUsageRange(
        startDateStr,
        endDateStr,
        !isSubDay && !isToday // Enable only for long ranges; "today" uses the live endpoint
    );

    // 3. Data Processing

    // -- Stats (Screen Time, Keystrokes, Clicks) --
    const unifiedStats = useMemo(() => {
        // Priority 1: Today from daily stats endpoint
        if (isToday && dailyStatsQuery.data) {
            return dailyStatsQuery.data;
        }

        // Priority 2: Range stats from range stats endpoint (keystrokes, clicks, active time)
        if (rangeStatsQuery.data) {
            // If it's a long range (Month/Week), we might prefer App Usage for Screen Time 
            // if rangeStats (from snapshots) is too heavy? No, rangeStats is fine.
            // Actually, rangeAppUsage is good for long ranges to see which apps were used.
            // But for the total screen time, rangeStats.total_active_seconds is technically better.

            // Special case for Month/Week: if we have app usage but no snapshots (purged?), 
            // we might want fallback. But for now, use rangeStats result.
            return rangeStatsQuery.data;
        }

        return null;

    }, [isToday, dailyStatsQuery.data, rangeStatsQuery.data]);


    // -- App Usage --
    const unifiedAppUsage = useMemo(() => {
        if (isToday) return appUsageQuery.data;

        if (!isSubDay) {
            // Use server-provided range data
            return rangeAppUsageQuery.data;
        }

        // Calculate client-side for sub-day (Past 1h, etc)
        if (!rangeEventsQuery.data) return [];

        const startTime = start.getTime();
        const endTime = end.getTime();
        const usageMap = new Map<string, number>();

        rangeEventsQuery.data.forEach(e => {
            const eTime = parseTimestamp(e.timestamp);
            const duration = calculateOverlap(eTime, e.duration_seconds, startTime, endTime);

            if (duration > 0) {
                const key = e.process_name;
                const current = usageMap.get(key) || 0;
                usageMap.set(key, current + duration);
            }
        });

        const sortedUsage: AppUsageEntry[] = Array.from(usageMap.entries())
            .map(([name, seconds]) => ({ name, seconds: Math.round(seconds) })) // Round for display
            .sort((a, b) => b.seconds - a.seconds);

        return sortedUsage;

    }, [isToday, isSubDay, appUsageQuery.data, rangeAppUsageQuery.data, rangeEventsQuery.data, start, end]);


    const unifiedTimeline = useMemo(() => {
        // Source data - Use chartStart for consistent bucket boundaries
        const startTime = chartStart.getTime();
        const endTime = end.getTime();

        // Helper to determine focus score for a bucket
        const processEvents = (events: WindowEvent[]) => {
            // Init buckets
            const buckets = new Map<string, { focus: number, distraction: number, total: number }>();
            const timestamps: number[] = [];

            // Normalize start time
            for (let t = startTime; t < endTime; t += bucketSizeMs) {
                timestamps.push(t);
            }

            // Fill buckets
            events.forEach(e => {
                const eTime = parseTimestamp(e.timestamp);
                const duration = e.duration_seconds;
                const cls = classify(e.process_name);
                // 'ignore' removes the app from focus analytics entirely
                if (cls === 'ignore') return;
                const productive = cls === 'focus';

                // Iterate buckets and add overlap
                timestamps.forEach(bucketStart => {
                    const bucketEnd = bucketStart + bucketSizeMs;
                    const overlap = calculateOverlap(eTime, duration, bucketStart, bucketEnd);

                    if (overlap > 0) {
                        const key = bucketStart.toString();
                        const current = buckets.get(key) || { focus: 0, distraction: 0, total: bucketSizeMs / 1000 };
                        if (productive) {
                            current.focus += overlap;
                        } else {
                            current.distraction += overlap;
                        }
                        buckets.set(key, current);
                    }
                });
            });

            return timestamps.map(ts => {
                const key = ts.toString();
                const data = buckets.get(key) || { focus: 0, distraction: 0, total: bucketSizeMs / 1000 };

                // Format label
                const date = new Date(ts);
                let label = '';

                // Dynamic label based on range
                if (timeRange === 'past_hour' || timeRange === 'past_6h' || timeRange === 'past_12h' || timeRange === 'today' || timeRange === 'yesterday') {
                    label = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                } else if (timeRange === 'this_week' || timeRange === 'this_month') {
                    label = date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
                } else {
                    label = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                }


                // User requested the sum to always be 100%. 
                // To achieve this while still showing activity intensity, we:
                // 1. Calculate focus/distraction as ratios of the ACTUAL active time.
                // 2. Add an 'idle' component to fill the rest of the 100% bucket.
                const bucketSeconds = bucketSizeMs / 1000;

                // Focus/Distraction as % of Bucket
                const focusPct = bucketSeconds > 0 ? Math.round((data.focus / bucketSeconds) * 100) : 0;
                const distractionPct = bucketSeconds > 0 ? Math.round((data.distraction / bucketSeconds) * 100) : 0;

                // Total activity capped at 100
                const actualFocus = Math.min(100, focusPct);
                const actualDistraction = Math.min(100 - actualFocus, distractionPct);
                const idle = 100 - actualFocus - actualDistraction;

                return {
                    time: label,
                    focus: actualFocus,
                    distraction: actualDistraction,
                    idle: Math.max(0, idle)
                };
            });
        };


        // Always prioritize range events for consistent charting if available
        if (rangeEventsQuery.data && rangeEventsQuery.data.length > 0) {
            return processEvents(rangeEventsQuery.data);
        }

        // Fallback for Today: Use pre-aggregated segments and ensure all 24 hours are present
        if (isToday && timelineQuery.data) {
            const hourMap = new Map(timelineQuery.data.map(s => [s.time, s]));
            const fullDay: { time: string, focus: number, distraction: number, idle: number }[] = [];

            for (let h = 0; h < 24; h++) {
                const hourStr = `${h.toString().padStart(2, '0')}:00`;
                const segment = hourMap.get(hourStr);

                const active = segment?.active_seconds || 0;
                const idle = segment?.idle_seconds || 0;
                const total = active + idle;
                const focus = total > 0 ? Math.round((active / total) * 100) : 0;

                fullDay.push({
                    time: hourStr, // Will be formatted by Chart XAxis tickFormatter
                    focus: focus,
                    distraction: 0,
                    idle: 100 - focus
                });
            }
            return fullDay;
        }

        return [];


    }, [timeRange, chartStart, end, bucketSizeMs, isToday, rangeEventsQuery.data, timelineQuery.data, classify]);


    // 4. Calculate Unified Focus Score for the Stat Card
    // We want the card to show (Focus / Active) ratio to reflect "Quality"
    const reconciledFocusScore = useMemo(() => {
        if (!unifiedAppUsage || unifiedAppUsage.length === 0) return 0;

        let totalActive = 0;
        let totalFocus = 0;

        unifiedAppUsage.forEach(app => {
            const cls = classify(app.name);
            // 'ignore' removes the app from the focus equation entirely
            if (cls === 'ignore') return;
            totalActive += app.seconds;
            if (cls === 'focus') {
                totalFocus += app.seconds;
            }
        });

        return totalActive > 0 ? Math.round((totalFocus / totalActive) * 100) : 0;
    }, [unifiedAppUsage, classify]);

    // 5. Return data
    const isLoading =
        (isToday ? (dailyStatsQuery.isLoading || appUsageQuery.isLoading) : rangeStatsQuery.isLoading) ||
        // We only block on timeline loading if we have NO data yet
        (rangeEventsQuery.isLoading && !rangeEventsQuery.data);

    const stats = formatStatsForCards(unifiedStats);

    // Override the focus score with our multi-source reconciled score
    if (stats) {
        stats.focusScore = reconciledFocusScore;
    }

    // 6. Focus sessions (contiguous deep-work blocks) + daily digest
    const focusSessions = useMemo(() => {
        const events = rangeEventsQuery.data ?? [];
        if (events.length === 0) return [];
        return computeFocusSessions(events, classify);
    }, [rangeEventsQuery.data, classify]);

    // Previous-day app usage, only fetched when viewing "today" (for the delta)
    const yesterdayWindow = useMemo(() => {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        // app_usage is keyed by LOCAL date (YYYY-MM-DD); a full ISO timestamp
        // compares greater than every stored date string and returns an empty set.
        return { start: toLocalDateString(start), end: toLocalDateString(end) };
    }, []);
    const yesterdayUsageQuery = useAppUsageRange(yesterdayWindow.start, yesterdayWindow.end, isToday);

    const digest = useMemo(() => {
        let focusSeconds = 0;
        (unifiedAppUsage ?? []).forEach((app) => {
            if (classify(app.name) === 'focus') focusSeconds += app.seconds;
        });

        let yesterdayFocusSeconds: number | null = null;
        if (yesterdayUsageQuery.data) {
            let seconds = 0;
            yesterdayUsageQuery.data.forEach((app) => {
                if (classify(app.name) === 'focus') seconds += app.seconds;
            });
            yesterdayFocusSeconds = seconds;
        }

        return buildDigest({
            focusSeconds,
            sessions: focusSessions,
            timeline: unifiedTimeline.map((b) => ({ time: b.time, focus: b.focus })),
            appUsage: unifiedAppUsage ?? [],
            previousFocusSeconds: yesterdayFocusSeconds,
        });
    }, [unifiedAppUsage, unifiedTimeline, focusSessions, classify, yesterdayUsageQuery.data]);

    return {
        stats,
        rawStats: unifiedStats,
        // Pass raw SECONDS to the sidebar. The chart-only formatter
        // (formatAppUsageForChart) converts to minutes and must NOT be used here.
        appUsage: (unifiedAppUsage ?? []).map(({ name, seconds }) => ({ name, value: seconds })),
        timelineData: unifiedTimeline,
        focusSessions,
        digest,
        bucketMinutes: bucketSizeMs / 60000,
        isLoading
    };
}
