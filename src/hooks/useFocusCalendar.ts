import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../utils/isTauri';
import { useVisibility } from '../context/VisibilityContext';
import { useSettings } from './useSettings';
import { useAppClassifier } from './useAppClassifier';
import { getAppUsageAll } from '../api/tauri';

export interface FocusDay {
    /** YYYY-MM-DD */
    date: string;
    focusSeconds: number;
    totalSeconds: number;
}

/** Deterministic pseudo-random mock so the heatmap is visible in browser dev */
function generateMockFocusDays(): FocusDay[] {
    const days: FocusDay[] = [];
    const now = new Date();
    for (let i = 0; i < 180; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const seed = Math.floor(d.getTime() / 86400000);
        // Deterministic per-day values in [0, 8.5h]
        const hours = ((seed * 2654435761) % 1000) / 1000 * 8.5;
        const date = d.toISOString().slice(0, 10);
        days.push({
            date,
            focusSeconds: Math.round(hours * 3600),
            totalSeconds: Math.round(hours * 3600 * 1.15),
        });
    }
    return days;
}

/**
 * Per-day focus totals for the last ~year, classified with the user's
 * per-app overrides. Re-fetches when the classification changes.
 */
export function useFocusCalendar() {
    const { visible } = useVisibility();
    const { settings } = useSettings();
    const classify = useAppClassifier();

    return useQuery({
        queryKey: ['focusCalendar', JSON.stringify(settings.appClassification)],
        queryFn: async (): Promise<FocusDay[]> => {
            if (!isTauri()) {
                return generateMockFocusDays();
            }
            const rows = await getAppUsageAll();
            const byDate = new Map<string, { focus: number; total: number }>();
            rows.forEach(([date, name, seconds]) => {
                const entry = byDate.get(date) ?? { focus: 0, total: 0 };
                entry.total += seconds;
                if (classify(name) === 'focus') entry.focus += seconds;
                byDate.set(date, entry);
            });
            return [...byDate.entries()].map(([date, v]) => ({
                date,
                focusSeconds: v.focus,
                totalSeconds: v.total,
            }));
        },
        staleTime: 5 * 60_000,
        refetchInterval: visible ? 60_000 : false,
    });
}
