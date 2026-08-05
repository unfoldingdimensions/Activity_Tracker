import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface BarProps {
    /** 0-100 fill percentage */
    value: number;
    /** css color for the fill (default focus accent) */
    color?: string;
    /** hair=2px, thin=3px (Data), thick=6-12px (progress/segment) */
    height?: 'hair' | 'thin' | 'thick';
    className?: string;
}

/**
 * Track + fill bar. Flat: square, rule-coloured track. Glass: rounded,
 * muted track. Fill colour defaults to the focus accent.
 */
export function Bar({ value, color = 'var(--accent-focus)', height = 'thin', className }: BarProps) {
    const theme = useVisualTheme();
    const heightClass =
        height === 'hair' ? 'h-0.5' : height === 'thin' ? 'h-[3px]' : theme === 'flat' ? 'h-2' : 'h-2.5';
    const trackClass = theme === 'flat' ? 'bg-[var(--border)]' : 'bg-[var(--muted)] rounded-full';
    const fillClass = theme === 'flat' ? '' : 'rounded-full';

    return (
        <div className={cn('w-full overflow-hidden', trackClass, heightClass, className)}>
            <div
                className={cn('h-full', fillClass)}
                style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
            />
        </div>
    );
}
