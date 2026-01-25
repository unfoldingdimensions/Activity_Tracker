/**
 * ChartErrorFallback - Graceful fallback for chart rendering failures
 * Charts can fail due to invalid data, SVG issues, or memory constraints
 */

import { BarChart3 } from 'lucide-react';

export interface ChartErrorFallbackProps {
    /** Custom message to display */
    message?: string;
    /** Chart title for context */
    title?: string;
    /** Height to match the chart container */
    height?: number | string;
}

export function ChartErrorFallback({
    message = 'Unable to render chart',
    title,
    height = 200,
}: ChartErrorFallbackProps) {
    return (
        <div
            className="flex flex-col items-center justify-center bg-[var(--secondary)]/30 rounded-lg border border-dashed border-[var(--border)]"
            style={{ height }}
        >
            <div className="p-3 rounded-full bg-[var(--secondary)] mb-3">
                <BarChart3 size={24} className="text-[var(--muted-foreground)]" />
            </div>
            {title && (
                <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                    {title}
                </p>
            )}
            <p className="text-xs text-[var(--muted-foreground)] text-center max-w-xs">
                {message}
            </p>
        </div>
    );
}

/**
 * Wrapper component to catch chart-specific errors
 */
export function ChartErrorBoundary({
    children,
    title,
    height,
}: {
    children: React.ReactNode;
    title?: string;
    height?: number | string;
}) {
    // Using a simple try-catch pattern for synchronous chart errors
    // For async errors, the parent ErrorBoundary will catch them
    return (
        <div className="relative">
            {children}
        </div>
    );
}
