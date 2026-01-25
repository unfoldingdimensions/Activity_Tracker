/**
 * Global ErrorBoundary component
 * Catches React errors and displays a user-friendly fallback UI
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from '../GlassCard';

interface ErrorBoundaryProps {
    /** Child components to wrap */
    children: ReactNode;
    /** Custom fallback component */
    fallback?: ReactNode;
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Whether to show the reset button */
    showReset?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex items-center justify-center min-h-[200px] p-8">
                    <GlassCard className="max-w-md p-6 text-center">
                        <div className="p-4 rounded-full bg-red-500/10 inline-flex mb-4">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2">
                            Something went wrong
                        </h3>
                        <p className="text-[var(--muted-foreground)] text-sm mb-4">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                        {this.props.showReset !== false && (
                            <button
                                onClick={this.handleReset}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg transition-colors text-sm font-medium text-[var(--foreground)]"
                            >
                                <RefreshCw size={16} />
                                Try again
                            </button>
                        )}
                        {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                            <details className="mt-4 text-left">
                                <summary className="cursor-pointer text-xs text-[var(--muted-foreground)]">
                                    Error details
                                </summary>
                                <pre className="mt-2 p-2 bg-[var(--secondary)] rounded text-xs overflow-auto max-h-32">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}
                    </GlassCard>
                </div>
            );
        }

        return this.props.children;
    }
}
