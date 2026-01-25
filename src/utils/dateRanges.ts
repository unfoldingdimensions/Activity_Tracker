import type { TimeRange } from '../components/dashboard/TimeRangeFilter';

export interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Calculates start and end dates based on a named time range
 */
export function calculateDateRange(range: TimeRange): DateRange {
    const end = new Date();
    const start = new Date();

    switch (range) {
        case 'past_hour':
            start.setHours(end.getHours() - 1);
            break;
        case 'past_6h':
            start.setHours(end.getHours() - 6);
            break;
        case 'past_12h':
            start.setHours(end.getHours() - 12);
            break;
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            start.setDate(end.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_week': {
            // Start of week (Monday)
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            break;
        }

        case 'this_month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
    }

    return { start, end };
}

/**
 * Converts a DateRange to ISO strings for API calls
 */
export function toIsoRange(range: DateRange) {
    return {
        startIso: range.start.toISOString(),
        endIso: range.end.toISOString(),
    };
}
