import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from '../components/shared/LoadingScreen';

interface StartupContextType {
    isReady: boolean;
}

const StartupContext = createContext<StartupContextType | undefined>(undefined);

export const StartupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    const [status, setStatus] = useState('Initializing Services');
    const [progress, setProgress] = useState(0);
    const queryClient = useQueryClient();

    useEffect(() => {
        const initializeApp = async () => {
            const isTray = window.location.pathname.includes('/tray');

            try {
                if (isTray) {
                    // Tray specific fast-track - no loading screen needed
                    await Promise.all([
                        queryClient.prefetchQuery({ queryKey: ['daily-stats'] }),
                        queryClient.prefetchQuery({ queryKey: ['app-usage', 'today'] }),
                    ]);
                    setIsReady(true);
                    return;
                }

                // Main App - fast startup with data prefetch
                setStatus('Loading Data');
                setProgress(30);

                // Prefetch critical data
                await Promise.all([
                    queryClient.prefetchQuery({ queryKey: ['daily-stats'] }),
                    queryClient.prefetchQuery({ queryKey: ['app-usage', 'today'] }),
                    queryClient.prefetchQuery({ queryKey: ['user-stats'] }),
                ]);

                setProgress(100);
                setStatus('Ready');

                // Brief pause for visual feedback (100ms vs previous 1,300ms)
                await new Promise(resolve => setTimeout(resolve, 100));

                setIsReady(true);
            } catch (error) {
                console.error('Failed to initialize app:', error);
                setIsReady(true);
            }
        };

        initializeApp();
    }, [queryClient]);

    return (
        <StartupContext.Provider value={{ isReady }}>
            <LoadingScreen isLoading={!isReady} status={status} progress={progress} />
            <div className={!isReady ? 'hidden' : 'block animate-fade-in'}>
                {children}
            </div>
        </StartupContext.Provider>
    );
};

export const useStartup = () => {
    const context = useContext(StartupContext);
    if (context === undefined) {
        throw new Error('useStartup must be used within a StartupProvider');
    }
    return context;
};
