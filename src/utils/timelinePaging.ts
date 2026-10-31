/**
 * Range-event pagination.
 *
 * The backend returns window events one page at a time, newest first
 * (`ORDER BY timestamp DESC`). A single capped call silently dropped every event
 * older than the cap — a 30-day range held ~21k events, so the dashboard rendered
 * the newest ~9.5 days as if they were "this month". Collect every page instead.
 *
 * The ceiling below is a runaway guard, not a product limit: it sits far above any
 * range the UI asks for (a 30-day month is ~21k events, the whole 78-day history is
 * ~62k). When it trips, the result says so and the caller surfaces it — a partial
 * range must never look complete.
 */

/** Rows requested per round trip. */
export const RANGE_PAGE_SIZE = 2000;

/** Hard guard against pathological loops. Never a display limit. */
export const RANGE_EVENT_CEILING = 200_000;

export interface PageCollection<T> {
    items: T[];
    pagesFetched: number;
    /** True when collection stopped at the ceiling instead of at the last page. */
    truncated: boolean;
}

/**
 * Fetch every page until the source runs out.
 *
 * @param fetchPage Returns rows for `(limit, offset)`; an empty array means exhausted.
 * @param pageSize  Rows per request.
 * @param ceiling   Stop here instead of looping forever; sets `truncated`.
 */
export async function collectAllPages<T>(
    fetchPage: (limit: number, offset: number) => Promise<T[]>,
    pageSize: number = RANGE_PAGE_SIZE,
    ceiling: number = RANGE_EVENT_CEILING
): Promise<PageCollection<T>> {
    if (pageSize <= 0) throw new Error('collectAllPages: pageSize must be positive');
    if (ceiling <= 0) throw new Error('collectAllPages: ceiling must be positive');

    const items: T[] = [];
    let offset = 0;
    let pagesFetched = 0;

    for (;;) {
        const page = await fetchPage(pageSize, offset);
        pagesFetched += 1;

        // Empty page: the range is exhausted.
        if (page.length === 0) break;

        items.push(...page);
        offset += page.length;

        // Short page: nothing left to ask for.
        if (page.length < pageSize) break;

        // A full page at the ceiling cannot prove it was the last one, so report
        // truncation rather than assuming the range ended here.
        if (items.length >= ceiling) {
            return { items, pagesFetched, truncated: true };
        }
    }

    return { items, pagesFetched, truncated: false };
}
