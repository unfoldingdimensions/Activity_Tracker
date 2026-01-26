import { useState, useEffect, type ReactNode } from 'react';
import { SettingsContext, type UserSettings } from './SettingsContext';

const DEFAULT_SETTINGS: UserSettings = {
    dashboardDefaultRange: 'past_hour',
    trackWindowTitles: true,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<UserSettings>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user_settings');
            if (stored) {
                try {
                    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
                } catch (e) {
                    console.error('Failed to parse settings:', e);
                }
            }
        }
        return DEFAULT_SETTINGS;
    });

    useEffect(() => {
        localStorage.setItem('user_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (newSettings: Partial<UserSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}
