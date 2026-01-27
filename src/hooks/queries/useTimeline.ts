/**
 * Timeline Hooks
 * Queries for timeline, events, and activity history
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import {
    getTimeline,
    getRecentEvents,
    getTimelineRangePaginated,
    getTimelineRangeForApp,
    type TimelineSegment,
    type WindowEvent,
} from '../../api/tauri';
import { MOCK_TIMELINE, MOCK_EVENTS } from './mockData';

/**
 * Get activity timeline for today
 * 
 * @example
 * ```tsx
 * const { data: timeline } = useTimeline();
 * ```
 */
export function useTimeline() {
    return useQuery({
        queryKey: ['timeline'],
        queryFn: async (): Promise<TimelineSegment[]> => {
            if (isTauri()) {
                return await getTimeline();
            }
            return MOCK_TIMELINE;
        },
        refetchInterval: 10000,
        staleTime: 9000,
    });
}

/**
 * Get recent window events
 * 
 * @example
 * ```tsx
 * const { data: events } = useRecentEvents();
 * ```
 */
export function useRecentEvents() {
    return useQuery({
        queryKey: ['recentEvents'],
        queryFn: async (): Promise<WindowEvent[]> => {
            if (isTauri()) {
                return await getRecentEvents();
            }
            return MOCK_EVENTS;
        },
        refetchInterval: 10000,
        staleTime: 8000,
    });
}

/**
 * Get window events in a date range
 * 
 * @param startIso - Start date in ISO format
 * @param endIso - End date in ISO format
 * @param enabled - Whether the query is enabled
 */
export function useTimelineEventsRange(
    startIso: string,
    endIso: string,
    enabled = true
) {
    return useQuery({
        queryKey: ['timelineEventsRange', startIso, endIso],
        queryFn: async (): Promise<WindowEvent[]> => {
            if (isTauri()) {
                // Limit to 5000 events to prevent memory explosion
                return await getTimelineRangePaginated(startIso, endIso, 5000, 0);
            }
            return MOCK_EVENTS;
        },
        enabled,
        refetchInterval: 5000,
    });
}

/**
 * Get window events for a specific app in a date range
 * 
 * @param processName - Process name to filter by
 * @param startIso - Start date in ISO format
 * @param endIso - End date in ISO format
 * @param enabled - Whether the query is enabled
 */
export function useTimelineRangeForApp(
    processName: string | null,
    startIso: string,
    endIso: string,
    enabled = true
) {
    return useQuery({
        queryKey: ['timelineRangeForApp', processName, startIso, endIso],
        queryFn: async (): Promise<WindowEvent[]> => {
            if (isTauri() && processName) {
                return await getTimelineRangeForApp(processName, startIso, endIso);
            }
            return [];
        },
        enabled: enabled && !!processName,
    });
}
