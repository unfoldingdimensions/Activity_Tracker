import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTimelineRangePaginated, type WindowEvent } from '../api/tauri';
import { collectAllPages } from '../utils/timelinePaging';
import { hourlyFocusShare, medianByHour, type HourMap } from '../utils/focusBaseline';
import { useAppClassifier } from './useAppClassifier';
import { useSettings } from './useSettings';

/**
 * The "usual" focus share per hour-of-day, from the last `days` complete days.
 *
 * Deliberately built from window events classified the same way the chart classifies them — the same owner, a different
 * window — so the baseline and the line it sits behind cannot drift apart. `days <= 0` or a non-hourly range disables
 * the query entirely: an unused reference frame is not worth a read of seven days of events.
 *
 * Failure is quiet and honest: no data means no line, never an invented one.
 */
export function useFocusBaseline(days: number, enabled: boolean) {
    const classify = useAppClassifier();
    const { settings } = useSettings();

    const { start, end } = useMemo(() => {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - Math.max(1, days));
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        return { start: from, end: to };
    }, [days]);

    const query = useQuery({
        // The overrides are part of the key: changing how an app is classified changes the baseline.
        queryKey: ['focus-baseline', days, settings.appClassification],
        enabled: enabled && days > 0,
        staleTime: 60 * 60 * 1000,
        retry: 0,
        queryFn: async (): Promise<HourMap | null> => {
            const { items } = await collectAllPages<WindowEvent>((limit, offset) =>
                getTimelineRangePaginated(start.toISOString(), end.toISOString(), limit, offset)
            );
            if (items.length === 0) return null;

            // Group events by the local day they start in; an event that crosses midnight belongs to the day it began,
            // which is how the chart's own bucketing walks its range.
            const byDay = new Map<number, WindowEvent[]>();
            for (const event of items) {
                const at = Date.parse(event.timestamp);
                if (!Number.isFinite(at)) continue;
                const day = new Date(at);
                day.setHours(0, 0, 0, 0);
                const key = day.getTime();
                const list = byDay.get(key);
                if (list) list.push(event);
                else byDay.set(key, [event]);
            }

            const dayShares = [...byDay.entries()].map(([dayStart, events]) =>
                hourlyFocusShare(events, dayStart, classify)
            );
            const medians = medianByHour(dayShares);
            return medians.size > 0 ? medians : null;
        },
    });

    return { byHour: enabled ? (query.data ?? null) : null, isLoading: query.isLoading };
}
