import { cn } from '../../utils/cn';

interface StatusDotProps {
    /** css color, default focus accent */
    color?: string;
    pulsing?: boolean;
    className?: string;
}

/** 6px status dot — the only round thing in the flat system. */
export function StatusDot({ color = 'var(--accent-focus)', pulsing = false, className }: StatusDotProps) {
    return (
        <span
            className={cn(
                'inline-block w-[6px] h-[6px] rounded-full flex-none',
                pulsing && 'status-dot-pulse',
                className
            )}
            style={{ backgroundColor: color }}
        />
    );
}
