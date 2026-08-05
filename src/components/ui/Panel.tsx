import type { ReactNode } from 'react';
import { GlassCard } from '../GlassCard';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface PanelProps {
    children: ReactNode;
    className?: string;
    /** flat: apply vertical band padding; glass: card padding */
    padded?: boolean;
    onClick?: () => void;
}

/**
 * Theme-aware container. Flat: a plain block separated by a 1px top rule
 * (no card). Glass: the legacy GlassCard with rounded corners + shadow.
 */
export function Panel({ children, className, padded = true, onClick }: PanelProps) {
    const theme = useVisualTheme();

    if (theme === 'glass') {
        return (
            <GlassCard className={cn('p-5', className)} hover={false} onClick={onClick}>
                {children}
            </GlassCard>
        );
    }

    return (
        <div
            onClick={onClick}
            className={cn('border-t border-[var(--border)]', padded && 'py-4', className)}
        >
            {children}
        </div>
    );
}
