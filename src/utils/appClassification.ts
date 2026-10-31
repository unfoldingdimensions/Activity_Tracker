import type { AppClassification } from '../context/SettingsContext';

/**
 * Default productive-app patterns (substring match, case-insensitive).
 * User overrides (settings.appClassification) take precedence over these.
 */
export const DEFAULT_PRODUCTIVE_PATTERNS: string[] = [
    // IDEs & Editors
    'code', 'studio', 'intellij', 'vim', 'sublime', 'xcrun',
    // Terminal
    'terminal', 'iterm', 'powershell', 'cmd.exe', 'bash',
    // Communication
    'slack', 'teams', 'zoom', 'discord', 'outlook', 'thunderbird',
    // Browsers (Development/Research)
    'chrome', 'firefox', 'edge', 'safari', 'arc', 'brave',
    // Productivity Tools
    'notion', 'figma', 'linear', 'jira', 'trello', 'word', 'excel', 'powerpoint', 'obsidian',
    // The App itself
    'activity_tracker', 'activity tracker',
];

/** Whether the process name matches the default productive patterns */
export function isProductiveAppDefault(name: string): boolean {
    const n = name.toLowerCase();
    return DEFAULT_PRODUCTIVE_PATTERNS.some((pattern) => n.includes(pattern));
}

/**
 * Classification for a process whose executable could not be resolved at the Win32
 * boundary. Historically these rows were recorded as `"Unknown"` (elevated and
 * packaged windows, before D-020 fixed name resolution).
 */
export const UNATTRIBUTED_PROCESS_NAME = 'Unknown';

/**
 * Classify a process name, honoring user overrides first.
 * Override keys match by case-insensitive substring, same as the defaults
 * (e.g. "chrome" matches "Chrome.exe"). 'ignore' excludes the app from
 * focus computations entirely.
 */
export function classifyApp(
    name: string,
    overrides: Record<string, AppClassification> | null | undefined
): AppClassification {
    const n = name.toLowerCase();
    if (overrides) {
        for (const [key, cls] of Object.entries(overrides)) {
            if (key && n.includes(key.toLowerCase())) {
                return cls;
            }
        }
    }
    // Unattributable time cannot be judged focus or distraction. Scoring it as
    // distraction punished the user for a resolver failure — 45 hours of history
    // is already in that bucket — so it is excluded from the ratio instead (D-020).
    // Exact match: a real app called "UnknownGame.exe" is still classified normally.
    if (n === UNATTRIBUTED_PROCESS_NAME.toLowerCase()) {
        return 'ignore';
    }
    return isProductiveAppDefault(name) ? 'focus' : 'distraction';
}
