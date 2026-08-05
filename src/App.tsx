import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeProvider';
import { SettingsProvider } from './context/SettingsProvider';
import { VisibilityProvider } from './context/VisibilityProvider';

import { Layout } from './components/Layout';
import { StartupProvider } from './context/StartupProvider';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { RefreshHandler } from './components/shared/RefreshHandler';
import { useLimitAlerts, useAchievementAlerts } from './hooks/useLimitAlerts';

// Route-level code splitting: each page (and its chart/gamification deps)
// is loaded on demand, keeping the initial bundle small.
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Timeline = lazy(() => import('./pages/Timeline').then(m => ({ default: m.Timeline })));
const ActivityPage = lazy(() => import('./pages/Activity').then(m => ({ default: m.ActivityPage })));
const Power = lazy(() => import('./pages/Power').then(m => ({ default: m.Power })));
const Tools = lazy(() => import('./pages/Tools').then(m => ({ default: m.Tools })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const TrayPopup = lazy(() => import('./pages/TrayPopup').then(m => ({ default: m.TrayPopup })));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // Disable global focus refresh
      refetchIntervalInBackground: false, // Pause intervals when the document is hidden
      staleTime: 30000, // 30 seconds default
      gcTime: 300_000, // 5 minutes garbage collection
    },
  },
});

/** Shown while a lazily-loaded route chunk is being fetched */
function RouteFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

/**
 * Surfaces backend distraction-guard alerts (limit-reached) as toasts.
 * Rendered inside ToastProvider so useToast is available.
 */
function LimitAlerts() {
    useLimitAlerts();
    useAchievementAlerts();
    return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StartupProvider>
          <RefreshHandler />
          <ToastProvider>
            <LimitAlerts />
            <SettingsProvider>
              <ThemeProvider>
                <VisibilityProvider>
                  <BrowserRouter>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/timeline" element={<Timeline />} />
                          <Route path="/activity" element={<ActivityPage />} />
                          <Route path="/power" element={<Power />} />
                          <Route path="/tools" element={<Tools />} />
                          <Route path="/settings" element={<Settings />} />
                        </Route>
                        {/* Standalone Tray Route */}
                        <Route path="/tray" element={<TrayPopup />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
                </VisibilityProvider>
              </ThemeProvider>
            </SettingsProvider>
          </ToastProvider>
        </StartupProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
