import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { SettingsContext, type UserSettings } from './SettingsContext';
import { isTauri } from '../utils/isTauri';
import { getSettings as fetchBackendSettings, setSettings as persistBackendSettings } from '../api/tauri';
import { backendToSettings, settingsToBackend } from './settingsMapping';

const DEFAULT_SETTINGS: UserSettings = {
    dashboardDefaultRange: 'past_hour',
    trackWindowTitles: true,
    idleThreshold: 60,
    blacklistedApps: [],
    retentionDays: 90,
    launchOnStartup: false,
    startMinimized: false,
    redactedKeywords: [],
    appLimits: {},
    appClassification: {},
    readingMode: 'data',
    writeSummarySentence: true,
    visualTheme: 'flat',
    fontPair: 'swiss',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<UserSettings>(() => {
        const saved = localStorage.getItem('user_settings');
        try {
            return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    // Load persisted settings from the backend once (source of truth in Tauri).
    // Local values win over defaults; backend values win over both.
    useEffect(() => {
        if (!isTauri()) return;
        let cancelled = false;
        // Promise.resolve guards against invoke() throwing synchronously
        // when the Tauri runtime is absent (e.g. jsdom integration tests)
        Promise.resolve(fetchBackendSettings())
            .then((backend) => {
                if (cancelled) return;
                setSettings((prev) => ({
                    ...DEFAULT_SETTINGS,
                    ...prev,
                    ...backendToSettings(backend),
                }));
            })
            .catch((err) => console.error('Failed to load settings:', err));
        return () => {
            cancelled = true;
        };
    }, []);

    // Persist: localStorage always (browser fallback), backend when in Tauri
    useEffect(() => {
        localStorage.setItem('user_settings', JSON.stringify(settings));
        if (!isTauri()) return;
        Promise.resolve(persistBackendSettings(settingsToBackend(settings)))
            .catch((err) => console.error('Failed to persist settings:', err));
    }, [settings]);

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
