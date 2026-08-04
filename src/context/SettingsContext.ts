import { createContext } from 'react';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';

export type AppClassification = 'focus' | 'distraction' | 'ignore';

export interface UserSettings {
    dashboardDefaultRange: TimeRange;
    trackWindowTitles: boolean;
    /** Seconds without input before the user counts as idle */
    idleThreshold: number;
    /** Process names excluded from tracking entirely (privacy / noise) */
    blacklistedApps: string[];
    /** Days of history kept by the background cleanup (90 default) */
    retentionDays: number;
    /** Launch the app automatically when the user signs in */
    launchOnStartup: boolean;
    /** Per-app daily usage limits in seconds (distraction guard, Phase 5) */
    appLimits: Record<string, number>;
    /** Per-app Focus/Distraction/Ignore overrides (Phase 3) */
    appClassification: Record<string, AppClassification>;
}

export interface SettingsContextType {
    settings: UserSettings;
    updateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
