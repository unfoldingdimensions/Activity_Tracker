
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeProvider';
import { SettingsProvider } from '../context/SettingsProvider';
import { ToastProvider } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/errors/ErrorBoundary';

// Create a custom render function that includes providers
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false, // Turn off retries for testing
            gcTime: 0 // Turn off garbage collection
        },
    },
});

export function renderWithClient(ui: ReactElement) {
    const testQueryClient = createTestQueryClient();
    const { rerender, ...result } = render(
        <QueryClientProvider client={testQueryClient}>
            <ErrorBoundary>
                <SettingsProvider>
                    <ThemeProvider>
                        <ToastProvider>
                            {ui}
                        </ToastProvider>
                    </ThemeProvider>
                </SettingsProvider>
            </ErrorBoundary>
        </QueryClientProvider>
    );
    return {
        ...result,
        rerender: (rerenderUi: ReactElement) =>
            rerender(
                <QueryClientProvider client={testQueryClient}>
                    <SettingsProvider>
                        <ThemeProvider>
                            <ToastProvider>
                                {rerenderUi}
                            </ToastProvider>
                        </ThemeProvider>
                    </SettingsProvider>
                </QueryClientProvider>
            ),
    };
}

export function createWrapper() {
    const testQueryClient = createTestQueryClient();
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={testQueryClient}>
            <SettingsProvider>
                <ThemeProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </ThemeProvider>
            </SettingsProvider>
        </QueryClientProvider>
    );
}

// Re-export everything
export * from '@testing-library/react';
