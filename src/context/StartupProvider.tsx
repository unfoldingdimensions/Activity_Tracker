import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { LoadingScreen } from '../components/shared/LoadingScreen';

interface StartupContextType {
    isReady: boolean;
}

const StartupContext = createContext<StartupContextType | undefined>(undefined);

export const StartupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    const [status, setStatus] = useState('Initializing Services');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const initializeApp = async () => {
            const isTray = window.location.pathname.includes('/tray');

            if (isTray) {
                // Tray specific fast-track - no loading screen needed
                setIsReady(true);
                return;
            }

            // Main App - short visual boot while data loads via query hooks
            setStatus('Ready');
            setProgress(100);

            // Brief pause for visual feedback (100ms vs previous 1,300ms)
            await new Promise(resolve => setTimeout(resolve, 100));

            setIsReady(true);
        };

        initializeApp();
    }, []);

    const value = useMemo(() => ({ isReady }), [isReady]);

    return (
        <StartupContext.Provider value={value}>
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
