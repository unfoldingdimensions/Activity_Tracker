import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeProvider';
import { SettingsProvider } from './context/SettingsProvider';
import { VisibilityProvider } from './context/VisibilityProvider';

import { Layout } from './components/Layout';
import { StartupProvider } from './context/StartupProvider';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { ActivityPage } from './pages/Activity';
import { Power } from './pages/Power';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { RefreshHandler } from './components/shared/RefreshHandler';
import { TrayPopup } from './pages/TrayPopup';


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

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StartupProvider>
          <RefreshHandler />
          <ToastProvider>
            <SettingsProvider>
              <ThemeProvider>
                <VisibilityProvider>
                  <BrowserRouter>
                    <Routes>
                      <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/timeline" element={<Timeline />} />
                        <Route path="/activity" element={<ActivityPage />} />
                        <Route path="/power" element={<Power />} />
                        <Route path="/settings" element={<Settings />} />
                      </Route>
                      {/* Standalone Tray Route */}
                      <Route path="/tray" element={<TrayPopup />} />
                    </Routes>
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
