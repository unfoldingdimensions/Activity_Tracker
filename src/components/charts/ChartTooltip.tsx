import { GlassCard } from '../GlassCard';

export function ChartTooltip(props: any) {
    const { active, payload, label, formatter } = props;

    if (active && payload && payload.length) {
        return (
            <GlassCard className="p-3 !bg-[var(--card)]/95 !backdrop-blur-xl border border-[var(--border)] shadow-xl rounded-xl z-50">
                <p className="font-display font-semibold text-[var(--foreground)] mb-2 text-sm">
                    {label}
                </p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                            <div
                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-[var(--muted-foreground)] capitalize">
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
