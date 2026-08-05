import type { ReactNode } from 'react';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface ChipProps {
    children: ReactNode;
    onRemove?: () => void;
    className?: string;
}

/**
 * Small token/chip. Flat: bordered mono tag with a square remove. Glass:
 * rounded pill on a secondary fill.
 */
export function Chip({ children, onRemove, className }: ChipProps) {
    const theme = useVisualTheme();

    if (theme === 'flat') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-2 px-2 py-1 border border-[var(--border)] font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--foreground)]',
                    className
                )}
            >
                {children}
                {onRemove && (
                    <button
                        onClick={onRemove}
                        aria-label="Remove"
                        className="text-[var(--muted-foreground)] hover:text-[var(--accent-negative)]"
                    >
                        ×
                    </button>
                )}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--secondary)] text-xs text-[var(--foreground)]',
                className
            )}
        >
            {children}
            {onRemove && (
                <button
                    onClick={onRemove}
                    aria-label="Remove"
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                    ×
                </button>
            )}
        </span>
    );
}
