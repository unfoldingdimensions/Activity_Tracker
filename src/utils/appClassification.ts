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
    return isProductiveAppDefault(name) ? 'focus' : 'distraction';
}
