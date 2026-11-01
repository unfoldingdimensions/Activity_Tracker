import type { UserSettings } from './SettingsContext';

/**
 * The frontend settings model mapped onto the backend's snake_case keys.
 *
 * This list and `src-tauri/src/settings_keys.rs` are the same contract seen from both sides: the backend rejects any key
 * it does not recognise (D-052), so a key renamed here and not there shows up as a failed save rather than a setting
 * that quietly stops persisting.
 */
export const BACKEND_KEYS: Record<keyof UserSettings, string> = {
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
    readingMode: 'reading_mode',
    writeSummarySentence: 'write_summary_sentence',
    visualTheme: 'visual_theme',
    fontPair: 'font_pair',
};

/**
 * Map the settings model onto the backend's keys.
 *
 * Iterates the *known* keys rather than the object's own properties: `settings` can also carry keys merged in from an
 * older localStorage payload, and the backend rejects anything it does not recognise — so passing a stale key through
 * would fail the whole save rather than being ignored.
 */
export function settingsToBackend(settings: UserSettings): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const [key, keyName] of Object.entries(BACKEND_KEYS)) {
        map[keyName] = settings[key as keyof UserSettings];
    }
    return map;
}

/** Keep only the fields the backend actually stores, so a key it never wrote cannot look like a user choice. */
export function backendToSettings(map: Record<string, unknown> | null | undefined): Partial<UserSettings> {
    const partial: Record<string, unknown> = {};
    if (!map) return partial;
    for (const [key, keyName] of Object.entries(BACKEND_KEYS)) {
        const raw = map[keyName];
        if (raw === undefined) continue;
        partial[key] = raw;
    }
    return partial as Partial<UserSettings>;
}
