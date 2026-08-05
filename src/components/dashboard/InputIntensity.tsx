import { useState } from 'react';
import type { InputHistoryBucket } from '../../api/tauri';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface InputIntensityProps {
    /** hourly buckets (chronological); the last 24 are drawn */
    buckets: InputHistoryBucket[];
    isLoading?: boolean;
}

/**
 * 24 square cells, opacity encodes input volume. Hovered cell gets a 1px
 * outline with a 2px offset; its value appears in the footer caption.
 */
export function InputIntensity({ buckets, isLoading = false }: InputIntensityProps) {
    const theme = useVisualTheme();
    const [hovered, setHovered] = useState<number | null>(null);

    const cells = buckets.slice(-24);
    const max = Math.max(...cells.map((b) => (b.keystrokes || 0) + (b.mouse_clicks || 0)), 1);

    const hoveredBucket = hovered !== null ? cells[hovered] : undefined;
    const hoveredTotal = hoveredBucket ? (hoveredBucket.keystrokes || 0) + (hoveredBucket.mouse_clicks || 0) : 0;
    const hoveredTime = hoveredBucket?.time ? new Date(hoveredBucket.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

    const cell = (bucket: InputHistoryBucket, i: number) => {
        const total = (bucket.keystrokes || 0) + (bucket.mouse_clicks || 0);
        const opacity = total === 0 ? 0 : Math.max(0.2, total / max);

        if (theme === 'flat') {
            return (
                <div
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                        'h-[44px] transition-colors cursor-default',
                        hovered === i && 'outline outline-1 outline-[var(--foreground)] outline-offset-2'
                    )}
                    style={total === 0 ? { backgroundColor: 'var(--border)' } : { backgroundColor: 'var(--accent-focus)', opacity }}
                />
            );
        }
        return (
            <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={cn('h-8 rounded-sm transition-all cursor-default', total === 0 ? 'bg-[var(--muted)]' : 'bg-[var(--accent-focus)]')}
                style={total > 0 ? { opacity } : undefined}
            />
        );
    };

    return (
        <div>
            <div className="flex items-baseline justify-between">
                <h3 className="section-title text-[var(--foreground)]">Input intensity</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">LAST 24 HOURS</span>
            </div>
            <div className={cn('grid grid-cols-12 gap-[3px] mt-4 min-w-0', theme === 'flat' ? '' : 'gap-1')}>
                {isLoading ? (
                    Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className={cn(theme === 'flat' ? 'h-[44px]' : 'h-8', 'bg-[var(--border)]')} />
                    ))
                ) : (
                    cells.map(cell)
                )}
            </div>
            <div className="flex justify-between font-mono text-[9.5px] text-[var(--muted-foreground)] mt-2">
                <span>00:00</span>
                <span>{hovered !== null ? `${hoveredTime} · ${hoveredTotal.toLocaleString()} inputs` : `${cells.length} hours`}</span>
                <span>Now</span>
            </div>
        </div>
    );
}
