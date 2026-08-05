import { useMemo } from 'react';
import { GlassCard } from '../GlassCard';
import { CalendarDays } from 'lucide-react';
import { useFocusCalendar } from '../../hooks/useFocusCalendar';
import { formatDuration } from '../../utils/formatters';
import { useVisualTheme } from '../../hooks/useVisualTheme';

const WEEKS = 52;
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/** 0-4 intensity bucket for a day's focus seconds */
function intensity(focusSeconds: number): number {
    if (focusSeconds <= 0) return 0;
    if (focusSeconds < 60 * 60) return 1; // < 1h
    if (focusSeconds < 4 * 60 * 60) return 2; // < 4h
    if (focusSeconds < 8 * 60 * 60) return 3; // < 8h
    return 4; // >= 8h
}

const CELL_COLORS = [
    'bg-[var(--muted)]/40',
    'bg-[var(--accent-focus)]/25',
    'bg-[var(--accent-focus)]/45',
    'bg-[var(--accent-focus)]/70',
    'bg-[var(--accent-focus)]',
];

const FLAT_CELL_COLORS = [
    'bg-[var(--border)]',
    'bg-[var(--accent-focus)]/30',
    'bg-[var(--accent-focus)]/50',
    'bg-[var(--accent-focus)]/75',
    'bg-[var(--accent-focus)]',
];

/**
 * GitHub-style focus calendar: one cell per day for the last 52 weeks,
 * colored by how much focused time was logged that day.
 */
export function FocusCalendar() {
    const { data: days, isLoading } = useFocusCalendar();
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    const byDate = useMemo(() => {
        const map = new Map<string, number>();
        (days ?? []).forEach((day) => map.set(day.date, day.focusSeconds));
        return map;
    }, [days]);

    // Build the week grid ending on the current week's Sunday
    const grid = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(today.getDate() + (6 - today.getDay())); // Sunday of this week

        const start = new Date(end);
        start.setDate(end.getDate() - (WEEKS * 7 - 1));

        const weeks: { day: Date; focusSeconds: number }[][] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            const week: { day: Date; focusSeconds: number }[] = [];
            for (let d = 0; d < 7; d++) {
                const key = cursor.toISOString().slice(0, 10);
                week.push({ day: new Date(cursor), focusSeconds: byDate.get(key) ?? 0 });
                cursor.setDate(cursor.getDate() + 1);
            }
            weeks.push(week);
        }
        return weeks;
    }, [byDate]);

    // Month label at the first week where the month changes
    const monthLabels = useMemo(() => {
        return grid.map((week, index) => {
            const day = week[0].day;
            const isMonthStart =
                index === 0 ||
                day.getMonth() !== grid[index - 1][0].day.getMonth();
            return isMonthStart
                ? day.toLocaleDateString([], { month: 'short' })
                : '';
        });
    }, [grid]);

    const totalFocus = useMemo(
        () => (days ?? []).reduce((sum, day) => sum + day.focusSeconds, 0),
        [days]
    );

    if (isFlat) {
        return (
            <div className="widget px-6 py-5">
                <div className="flex items-baseline justify-between">
                    <h3 className="section-title text-[var(--foreground)]">Focus calendar</h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                        {isLoading ? 'Loading…' : `${formatDuration(totalFocus)} focused · last year`}
                    </span>
                </div>

                <div className="overflow-x-auto pb-1 mt-5">
                    <div className="inline-flex">
                        {/* Weekday labels */}
                        <div className="flex flex-col justify-between mr-2 py-[3px]">
                            {WEEKDAYS.map((label, i) => (
                                <span key={i} className="text-[10px] text-[var(--muted-foreground)] h-[15px] leading-[15px]">
                                    {label}
                                </span>
                            ))}
                        </div>

                        {/* Week columns */}
                        <div className="flex gap-[3px]">
                            {grid.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-[3px]">
                                    {week.map((cell) => (
                                        <div
                                            key={cell.day.toISOString()}
                                            title={`${cell.day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} — ${formatDuration(cell.focusSeconds)} focused`}
                                            className={`w-[15px] h-[15px] ${FLAT_CELL_COLORS[intensity(cell.focusSeconds)]} transition-transform hover:scale-125`}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Month labels */}
                    <div className="flex gap-[3px] mt-2 pl-[26px]">
                        {monthLabels.map((label, i) => (
                            <span key={i} className="w-[15px] text-[10px] text-[var(--muted-foreground)]">
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-[var(--accent-focus)]/10">
                    <CalendarDays size={20} className="text-[var(--accent-focus)]" />
                </div>
                <div className="flex-1">
                    <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                        Focus Calendar
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)]">
                        {isLoading ? 'Loading…' : `${formatDuration(totalFocus)} focused in the last year`}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto pb-1">
                <div className="inline-flex">
                    {/* Weekday labels */}
                    <div className="flex flex-col justify-between mr-2 py-[3px]">
                        {WEEKDAYS.map((label, i) => (
                            <span key={i} className="text-[9px] text-[var(--muted-foreground)] h-[15px] leading-[15px]">
                                {label}
                            </span>
                        ))}
                    </div>

                    {/* Week columns */}
                    <div className="flex gap-[3px]">
                        {grid.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-[3px]">
                                {week.map((cell) => (
                                    <div
                                        key={cell.day.toISOString()}
                                        title={`${cell.day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} — ${formatDuration(cell.focusSeconds)} focused`}
                                        className={`w-[15px] h-[15px] rounded-[3px] ${CELL_COLORS[intensity(cell.focusSeconds)]} transition-transform hover:scale-125`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Month labels */}
                <div className="flex gap-[3px] mt-2 pl-[26px]">
                    {monthLabels.map((label, i) => (
                        <span key={i} className="w-[15px] text-[9px] text-[var(--muted-foreground)]">
                            {label}
                        </span>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
}
