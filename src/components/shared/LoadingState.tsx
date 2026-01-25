/**
 * LoadingState - Consistent loading placeholder component
 */

import { Skeleton } from '../ui/Skeleton';

export interface LoadingStateProps {
    /** Type of loading state layout */
    variant?: 'card' | 'chart' | 'list' | 'inline';
    /** Custom message to display */
    message?: string;
    /** Number of skeleton items to show for list variant */
    count?: number;
    /** Additional CSS classes */
    className?: string;
}

export function LoadingState({
    variant = 'chart',
    message,
    count = 3,
    className = '',
}: LoadingStateProps) {
    if (variant === 'inline') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton variant="text" className="h-4 w-20" />
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`p-5 ${className}`}>
                <Skeleton variant="text" className="h-4 w-24 mb-2" />
                <Skeleton variant="text" className="h-8 w-32" />
            </div>
        );
    }

    if (variant === 'list') {
        return (
            <div className={`space-y-3 ${className}`}>
                {Array.from({ length: count }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    // Default: chart
    return (
        <div className={`h-full flex items-center justify-center ${className}`}>
            <div className="flex flex-col items-center gap-2">
                <Skeleton className="w-48 h-48 rounded-full opacity-20" />
                {message && (
                    <p className="text-[var(--muted-foreground)]">{message}</p>
                )}
            </div>
        </div>
    );
}
