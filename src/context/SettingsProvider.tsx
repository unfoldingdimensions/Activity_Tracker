import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { SettingsContext, type UserSettings } from './SettingsContext';
import { isTauri } from '../utils/isTauri';
import { getSettings as fetchBackendSettings, setSettings as persistBackendSettings } from '../api/tauri';

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
};

// Backend setting keys (snake_case, shared with the Rust tracker)
const BACKEND_KEYS: Record<keyof UserSettings, string> = {
    dashboardDefaultRange: 'dashboard_default_range',
    trackWindowTitles: 'track_window_titles',
    idleThreshold: 'idle_threshold',
    blacklistedApps: 'blacklisted_apps',
    retentionDays: 'retention_days',
    launchOnStartup: 'launch_on_startup',
    startMinimized: 'start_minimized',
    redactedKeywords: 'redacted_keywords',
    appLimits: 'app_limits',
    appClassification: 'app_classification',
};

function settingsToBackend(settings: UserSettings): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings) as [keyof UserSettings, unknown][]) {
        map[BACKEND_KEYS[key]] = value;
    }
    return map;
}

function backendToSettings(map: Record<string, unknown> | null | undefined): Partial<UserSettings> {
    const partial: Record<string, unknown> = {};
    if (!map) return partial;
    for (const [key, keyName] of Object.entries(BACKEND_KEYS)) {
        const raw = map[keyName];
        if (raw === undefined) continue;
        partial[key] = raw;
    }
    return partial as Partial<UserSettings>;
}

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
