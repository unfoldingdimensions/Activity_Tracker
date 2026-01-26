import { createContext } from 'react';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';

export interface UserSettings {
    dashboardDefaultRange: TimeRange;
    trackWindowTitles: boolean;
}

export interface SettingsContextType {
    settings: UserSettings;
    updateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
