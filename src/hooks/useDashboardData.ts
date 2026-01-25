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
import { formatStatsForCards, formatAppUsageForChart } from './useTrackerData';

/**
 * Helper to ensure timestamp is treated as UTC if naive
 */
function parseValues(timestamp: string): number {
    return new Date(timestamp).getTime();
}

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
    // 1. Calculate Date Range
    const { start, end, isToday, isSubDay, bucketSizeMs } = useMemo(() => {
        const now = new Date();
        const end = new Date(now);
        let start = new Date(now);
        let isToday = false;
        let isSubDay = false; // Less than 24h, requiring client-side app usage calc

        let bucketSizeMs = 1000 * 60 * 30; // Default

        switch (timeRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                isToday = true;
                isSubDay = false; // We use daily stats for today
                bucketSizeMs = 1000 * 60 * 120; // 2h
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                isSubDay = false; // Whole day
                bucketSizeMs = 1000 * 60 * 120; // 2h
                break;
            case 'past_1h':
                start.setTime(now.getTime() - (60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 5; // 5 min
                break;
            case 'past_6h':
                start.setTime(now.getTime() - (6 * 60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 60; // 1h
                break;
            case 'past_12h':
                start.setTime(now.getTime() - (12 * 60 * 60 * 1000));
                isSubDay = true;
                bucketSizeMs = 1000 * 60 * 60; // 1h
                break;
            case 'week':
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0); // Start of day 7 days ago
                isSubDay = false;
                bucketSizeMs = 1000 * 60 * 60 * 24; // 1 day
                break;
            case 'month':
                start.setDate(now.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                isSubDay = false;
                bucketSizeMs = 1000 * 60 * 60 * 24 * 7; // 1 week
                break;
        }

        return { start, end, isToday, isSubDay, bucketSizeMs };
    }, [timeRange]);

    // 2. Fetch Data

    // Case A: Today (Live) - Optimized hooks
    const dailyStatsQuery = useDailyStats();
    const appUsageQuery = useAppUsage();
    const timelineQuery = useTimeline();

    // Case B: Range (Historical / Sub-day)
    // Always fetch events for range to calculate focus flow and sub-day stats
    // ENABLED FOR TODAY as well to ensure consistent chart bucketing
    const rangeEventsQuery = useTimelineEventsRange(
        start.toISOString(),
        end.toISOString(),
        true // Always enabled
    );

    // Stats for range (Keystrokes, Clicks)
    const rangeStatsQuery = useStatsRange(
        start.toISOString(),
        end.toISOString(),
        !isToday // Enable only for non-today
    );

    // Fetch App Usage:
    // For >= 1 day ranges (Yesterday, Week, Month), use the range endpoint.
    // For < 1 day ranges (Past 1h, 6h), calculate from events (client-side) to avoid getting full-day data.
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    const rangeAppUsageQuery = useAppUsageRange(
        startDateStr,
        endDateStr,
        !isSubDay // Enable only for long ranges
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
            const eTime = parseValues(e.timestamp);
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


    // -- Timeline / Focus Flow --
    const unifiedTimeline = useMemo(() => {
        // Source data
        const startTime = start.getTime();
        const endTime = end.getTime();

        // Helper to determine focus score for a bucket
        const processEvents = (events: WindowEvent[]) => {
            // Init buckets
            const buckets = new Map<string, { active: number, total: number }>();
            const timestamps: number[] = [];

            // Normalize start time
            for (let t = startTime; t < endTime; t += bucketSizeMs) {
                timestamps.push(t);
            }

            // Fill buckets
            events.forEach(e => {
                const eTime = parseValues(e.timestamp);
                const duration = e.duration_seconds;

                // Iterate buckets and add overlap
                timestamps.forEach(bucketStart => {
                    const bucketEnd = bucketStart + bucketSizeMs;
                    const overlap = calculateOverlap(eTime, duration, bucketStart, bucketEnd);

                    if (overlap > 0) {
                        const key = bucketStart.toString();
                        const current = buckets.get(key) || { active: 0, total: bucketSizeMs / 1000 };
                        current.active += overlap;
                        buckets.set(key, current);
                    }
                });
            });

            return timestamps.map(ts => {
                const key = ts.toString();
                const data = buckets.get(key) || { active: 0, total: bucketSizeMs / 1000 };

                // Format label
                const date = new Date(ts);
                let label = '';

                // Dynamic label based on range
                if (timeRange === 'past_1h' || timeRange === 'past_6h') {
                    label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (timeRange === 'week' || timeRange === 'month') {
                    label = date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
                } else {
                    label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                const active = Math.min(data.active, data.total);
                const focus = data.total > 0 ? Math.round((active / data.total) * 100) : 0;

                return {
                    time: label,
                    focus,
                    distraction: 100 - focus
                };
            });
        };

        // Always prioritize range events for consistent charting if available
        if (rangeEventsQuery.data && rangeEventsQuery.data.length > 0) {
            return processEvents(rangeEventsQuery.data);
        }

        // Fallback for Today if range events empty (e.g. fresh start) but timelineQuery has data
        if (isToday && timelineQuery.data) {
            return [];
        }

        return [];

    }, [timeRange, start, end, bucketSizeMs, isToday, rangeEventsQuery.data, timelineQuery.data]);


    // 4. Return data
    const isLoading =
        (isToday ? (dailyStatsQuery.isLoading || appUsageQuery.isLoading) : rangeStatsQuery.isLoading) ||
        // We only block on timeline loading if we have NO data yet
        (rangeEventsQuery.isLoading && !rangeEventsQuery.data);

    return {
        stats: formatStatsForCards(unifiedStats),
        rawStats: unifiedStats,
        appUsage: formatAppUsageForChart(unifiedAppUsage),
        timelineData: unifiedTimeline,
        isLoading
    };
}
