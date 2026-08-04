import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { SettingsContext, type UserSettings } from './SettingsContext';
import { isTauri } from '../utils/isTauri';
import { setTrackWindowTitles } from '../api/tauri';

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

    // Sync the "track window titles" privacy setting to the backend tracker
    useEffect(() => {
        if (!isTauri()) return;
        Promise.resolve(setTrackWindowTitles(settings.trackWindowTitles))
            .catch((err) => console.error('Failed to sync track window titles setting:', err));
    }, [settings.trackWindowTitles]);

    const updateSettings = (newSettings: Partial<UserSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const value = useMemo(() => ({ settings, updateSettings }), [settings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}
