/**
 * EmptyState - Consistent empty data placeholder component
 */

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
    /** Custom icon to display */
    icon?: LucideIcon;
    /** Title/heading text */
    title?: string;
    /** Description text */
    message?: string;
    /** Additional CSS classes */
    className?: string;
}

export function EmptyState({
    icon: Icon = Inbox,
    title,
    message = 'No data available',
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
            <div className="p-4 rounded-full bg-[var(--secondary)] mb-4">
                <Icon size={32} className="text-[var(--muted-foreground)]" />
            </div>
            {title && (
                <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2">
                    {title}
                </h3>
            )}
            <p className="text-[var(--muted-foreground)] max-w-sm">{message}</p>
        </div>
    );
}
