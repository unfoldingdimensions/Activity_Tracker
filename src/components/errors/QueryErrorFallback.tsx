/**
 * QueryErrorBoundary - Error boundary specifically for React Query errors
 * Provides retry capability and shows query-specific error messages
 */

import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { GlassCard } from '../GlassCard';

export interface QueryErrorFallbackProps {
    /** Error message to display */
    error: Error | null;
    /** Function to retry the failed query */
    onRetry?: () => void;
    /** Whether a retry is in progress */
    isRetrying?: boolean;
    /** Title for the error state */
    title?: string;
    /** Compact mode for inline use */
    compact?: boolean;
}

/**
 * Check if error is likely a network error
 */
function isNetworkError(error: Error | null): boolean {
    if (!error) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connection') ||
        message.includes('offline')
    );
}

/**
 * Fallback UI component for failed React Query queries
 */
export function QueryErrorFallback({
    error,
    onRetry,
    isRetrying = false,
    title = 'Failed to load data',
    compact = false,
}: QueryErrorFallbackProps) {
    const isNetwork = isNetworkError(error);
    const Icon = isNetwork ? WifiOff : AlertCircle;

    if (compact) {
        return (
            <div className="flex items-center gap-3 p-3 bg-[var(--accent-negative)]/10 rounded-lg border border-[var(--accent-negative)]/20">
                <Icon size={18} className="text-[var(--accent-negative)] flex-shrink-0" />
                <span className="text-sm text-[var(--foreground)] flex-1">
                    {isNetwork ? 'Connection error' : 'Loading failed'}
                </span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="text-xs px-2 py-1 bg-[var(--secondary)] hover:bg-[var(--border)] rounded transition-colors disabled:opacity-50"
                    >
                        {isRetrying ? 'Retrying...' : 'Retry'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8">
            <GlassCard className="max-w-sm p-6 text-center">
                <div className="p-3 rounded-full bg-[var(--accent-negative)]/10 inline-flex mb-4">
                    <Icon size={28} className="text-[var(--accent-negative)]" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2">
                    {title}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                    {isNetwork
                        ? 'Please check your connection and try again.'
                        : error?.message || 'An error occurred while loading data.'}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg transition-colors text-sm font-medium text-[var(--foreground)] disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                        {isRetrying ? 'Retrying...' : 'Try again'}
                    </button>
                )}
            </GlassCard>
        </div>
    );
}

/**
 * Hook-friendly wrapper for query error states
 * Use this in components that use React Query
 * 
 * @example
 * ```tsx
 * const { data, error, isLoading, refetch } = useAppUsage();
 * 
 * if (error) {
 *   return <QueryErrorFallback error={error} onRetry={refetch} />;
 * }
 * ```
 */
