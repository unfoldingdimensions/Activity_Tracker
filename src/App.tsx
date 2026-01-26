import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeProvider';
import { SettingsProvider } from './context/SettingsProvider';

import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { ActivityPage } from './pages/Activity';
import { Power } from './pages/Power';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { RefreshHandler } from './components/shared/RefreshHandler';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RefreshHandler />
        <ToastProvider>

          <SettingsProvider>
            <ThemeProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/timeline" element={<Timeline />} />
                    <Route path="/activity" element={<ActivityPage />} />
                    <Route path="/power" element={<Power />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ThemeProvider>
          </SettingsProvider>

        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
