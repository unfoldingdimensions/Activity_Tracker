/**
 * Timeline Hooks
 * Queries for timeline, events, and activity history
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { useVisibility } from '../../context/VisibilityContext';
import {
    getTimeline,
    getRecentEvents,
    getTimelineRangePaginated,
    getTimelineRangeForApp,
    type TimelineSegment,
    type WindowEvent,
} from '../../api/tauri';
import { MOCK_TIMELINE, MOCK_EVENTS } from './mockData';
import { collectAllPages, RANGE_EVENT_CEILING } from '../../utils/timelinePaging';
import { withActiveDurations, type NormalisedWindowEvent } from '../../utils/windowEvents';

/**
 * Get activity timeline for today
 * 
 * @example
 * ```tsx
 * const { data: timeline } = useTimeline();
 * ```
 */
export function useTimeline() {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['timeline'],
        queryFn: async (): Promise<TimelineSegment[]> => {
            if (isTauri()) {
                return await getTimeline();
            }
            return MOCK_TIMELINE;
        },
        refetchInterval: visible ? 30000 : false, // 30 seconds - reduced from 10s to prevent backend overload
        staleTime: 25000,
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
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['recentEvents'],
        queryFn: async (): Promise<NormalisedWindowEvent[]> => {
            if (isTauri()) {
                return withActiveDurations(await getRecentEvents());
            }
            return withActiveDurations(MOCK_EVENTS);
        },
        refetchInterval: visible ? 30000 : false, // 30 seconds - reduced from 10s to prevent backend overload
        staleTime: 25000,
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
    const { visible } = useVisibility();
    // Only poll a range that still contains "now": a historical range cannot change,
    // and the payload is now the whole range rather than the newest page of it.
    // The clock is read inside the refetch callback (React Query's timer), never
    // during render.
    const rangeEndMs = Date.parse(endIso);
    const rangeIsLive = Number.isNaN(rangeEndMs) ? null : rangeEndMs;

    return useQuery({
        queryKey: ['timelineEventsRange', startIso, endIso],
        queryFn: async (): Promise<NormalisedWindowEvent[]> => {
            if (!isTauri()) {
                return withActiveDurations(MOCK_EVENTS);
            }

            // Collect every page. A single capped request used to return the newest
            // 5000 events of the range and drop the rest with no signal, so a 30-day
            // view rendered only its last ~9 days (finding P0-1).
            const { items, pagesFetched, truncated } = await collectAllPages<WindowEvent>(
                (limit, offset) => getTimelineRangePaginated(startIso, endIso, limit, offset)
            );

            // Loud on purpose: a partial range must never be presented as complete.
            if (truncated) {
                throw new Error(
                    `Timeline range ${startIso} → ${endIso} exceeded ${RANGE_EVENT_CEILING} ` +
                    `events after ${pagesFetched} pages; refusing to render a partial range.`
                );
            }

            return withActiveDurations(items);
        },
        enabled,
        refetchInterval: visible
            ? () => (rangeIsLive === null || rangeIsLive >= Date.now() - 3_600_000 ? 30_000 : false)
            : false,
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
        queryFn: async (): Promise<NormalisedWindowEvent[]> => {
            if (isTauri() && processName) {
                return withActiveDurations(await getTimelineRangeForApp(processName, startIso, endIso));
            }
            return [];
        },
        enabled: enabled && !!processName,
    });
}
