/**
 * Timeline Hooks
 * Queries for timeline, events, and activity history
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { useVisibility } from '../../context/VisibilityContext';
import {
    getTimeline,
    getRecentEvents,
    getTimelineRangePaginated,
    getTimelineRangeForAppPaginated,
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
 * One page of window events for a specific app in a date range
 *
 * The drill-down is server-paged: `limit` is how much of the range the screen currently shows, and
 * the response carries `total` so the screen can say "newest N of M" rather than presenting a page
 * as the whole range (D-039).
 *
 * @param processName - Process name to filter by
 * @param startIso - Start date in ISO format
 * @param endIso - End date in ISO format
 * @param limit - Rows to fetch from the newest end of the range
 * @param enabled - Whether the query is enabled
 */
export function useTimelineRangeForApp(
    processName: string | null,
    startIso: string,
    endIso: string,
    limit: number,
    enabled = true
) {
    return useQuery({
        queryKey: ['timelineRangeForApp', processName, startIso, endIso, limit],
        queryFn: async (): Promise<{ events: NormalisedWindowEvent[]; total: number }> => {
            if (!isTauri() || !processName) {
                return { events: [], total: 0 };
            }
            const page = await getTimelineRangeForAppPaginated(processName, startIso, endIso, limit, 0);
            return { events: withActiveDurations(page.events), total: page.total };
        },
        enabled: enabled && !!processName,
        // Growing the limit refetches; keep the rows already on screen instead of blanking them.
        placeholderData: keepPreviousData,
    });
}
