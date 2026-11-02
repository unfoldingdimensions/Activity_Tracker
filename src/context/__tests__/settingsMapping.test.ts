import { describe, it, expect } from 'vitest';
import { settingsToBackend } from '../settingsMapping';
import type { UserSettings } from '../SettingsContext';

const SETTINGS: UserSettings = {
    dashboardDefaultRange: 'past_hour',
    trackWindowTitles: true,
    idleThreshold: 60,
    blacklistedApps: ['steam.exe'],
    retentionDays: 90,
    launchOnStartup: false,
    startMinimized: true,
    redactedKeywords: [],
    appLimits: {},
    appClassification: {},
    readingMode: 'data',
    writeSummarySentence: true,
    visualTheme: 'flat',
    fontPair: 'swiss',
    baselineDays: 7,
};

// The backend rejects unknown keys outright (D-052), so anything that leaks into this object fails the whole save —
// silently, from the user's point of view, because the app keeps working with unsaved settings.
describe('settingsToBackend', () => {
    it('maps every setting to its snake_case backend key', () => {
        const mapped = settingsToBackend(SETTINGS);

        expect(Object.keys(mapped)).toHaveLength(15);
        expect(mapped.visual_theme).toBe('flat');
        expect(mapped.retention_days).toBe(90);
        expect(mapped.idle_threshold).toBe(60);
        expect(mapped).not.toHaveProperty('visualTheme');
    });

    it('drops keys left over from an older stored payload', () => {
        const stale = { ...SETTINGS, focusGoalHours: 4, legacyTheme: 'glass' } as unknown as UserSettings;

        const mapped = settingsToBackend(stale);

        expect(Object.keys(mapped)).toHaveLength(15);
        expect(mapped).not.toHaveProperty('focusGoalHours');
        expect(mapped).not.toHaveProperty('legacyTheme');
    });

    it('sends an empty value only for keys that are genuinely unset', () => {
        // A missing key would leave the stored value in place while the UI shows the default.
        const mapped = settingsToBackend(SETTINGS);
        for (const key of Object.keys(mapped)) {
            expect(mapped[key]).not.toBeUndefined();
        }
    });
});
