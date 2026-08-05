import { GlassCard } from '../GlassCard';
import { Timer, Layers, Clock, Crown, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';
import type { DailyDigest as Digest } from '../../utils/focusSessions';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface DailyDigestProps {
    digest: Digest;
    isLoading?: boolean;
}

/**
 * Compact "today at a glance" strip: focus time, deep-work sessions,
 * peak hour, top app and the delta vs the previous period.
 */
export function DailyDigest({ digest, isLoading }: DailyDigestProps) {
    const theme = useVisualTheme();

    if (isLoading) {
        return (
            <GlassCard className="p-6" hover={false}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 rounded-lg bg-[var(--secondary)]/60 animate-pulse" />
                    ))}
                </div>
            </GlassCard>
        );
    }

    const delta = digest.deltaVsPrevious;
    const deltaLabel =
        delta === null ? '—' : `${delta >= 0 ? '+' : '−'}${formatDuration(Math.abs(delta))}`;

    const items = [
        { icon: Timer, label: 'Focus time', value: formatDuration(digest.focusSeconds) },
        { icon: Layers, label: 'Deep sessions', value: `${digest.sessionCount}` },
        { icon: Clock, label: 'Peak hour', value: digest.peakHour ?? '—' },
        { icon: Crown, label: 'Top app', value: digest.topAppName ?? '—' },
        {
            icon: delta !== null && delta >= 0 ? TrendingUp : TrendingDown,
            label: 'vs yesterday',
            value: deltaLabel,
            accent: delta !== null && delta > 0 ? 'text-emerald-500' : delta !== null && delta < 0 ? 'text-rose-500' : undefined,
        },
    ];

    if (theme === 'flat') {
        return (
            <div className="grid grid-cols-5 border-b border-[var(--border)]">
                {items.map(({ label, value, accent }, i) => (
                    <div key={label} className={cn('py-[13px]', i > 0 ? 'px-7 border-l border-[var(--border)]' : 'px-8')}>
                        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{label}</div>
                        <div className={cn('font-mono text-[13px] font-bold mt-1', accent ?? 'text-[var(--foreground)]')}>{value}</div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {items.map(({ icon: Icon, label, value, accent }) => (
                    <div key={label} className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-[var(--secondary)]/60 flex-shrink-0">
                            <Icon size={16} className="text-[var(--muted-foreground)]" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                                {label}
                            </p>
                            <p className={`font-display font-semibold text-sm truncate ${accent ?? 'text-[var(--foreground)]'}`}>
                                {value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
