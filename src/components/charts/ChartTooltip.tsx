import type { ReactNode } from 'react';
import { GlassCard } from '../GlassCard';

/** One entry recharts passes to a custom tooltip payload */
interface TooltipEntry {
    name?: string | number;
    value?: number | string;
    color?: string;
}

/** Props recharts injects into custom tooltip content (all optional at runtime) */
interface ChartTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: ReactNode;
    formatter?: (value: number | string | undefined, name: string | number | undefined, item: TooltipEntry, index: number, payload: TooltipEntry[]) => ReactNode;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
    if (active && payload && payload.length) {
        return (
            <GlassCard className="p-3 !bg-[var(--card)]/95 !backdrop-blur-xl border border-[var(--border)] shadow-xl rounded-xl z-50">
                <p className="font-display font-semibold text-[var(--foreground)] mb-2 text-sm">
                    {label}
                </p>
                <div className="space-y-1.5">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                            <div
                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-[var(--muted-foreground)] font-display font-medium">
                                {entry.name}:
                            </span>

                            <span className="font-mono font-medium text-[var(--foreground)]">
                                {formatter ? formatter(entry.value, entry.name, entry, index, payload) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </GlassCard>
        );
    }

    return null;
}
