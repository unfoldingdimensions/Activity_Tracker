import { useEffect, useState, useMemo, useContext } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './ThemeContext';
import { SettingsContext, type FontPair } from './SettingsContext';

type Theme = 'light' | 'dark';

// Typography pairs selectable in Settings. CSS variables are set inline on
// the root so every consumer (including self-hosted @fontsource families)
// picks them up without touching component styles.
const FONT_PAIRS: Record<FontPair, { display: string; body: string; mono: string; serif: string }> = {
    swiss: {
        display: '"Plus Jakarta Sans Variable"',
        body: '"Plus Jakarta Sans Variable"',
        mono: '"JetBrains Mono Variable"',
        serif: '"Instrument Serif"',
    },
    geist: {
        display: '"Geist Variable"',
        body: '"Geist Variable"',
        mono: '"Geist Mono Variable"',
        serif: '"Newsreader Variable"',
    },
    grotesk: {
        display: '"Space Grotesk Variable"',
        body: '"Space Grotesk Variable"',
        mono: '"IBM Plex Mono"',
        serif: '"Source Serif 4 Variable"',
    },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check localStorage first, default to dark
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('theme') as Theme | null;
            return stored || 'dark';
        }
        return 'dark';
    });

    // Visual skin + font pair come from settings. Falls back to defaults
    // when rendered outside SettingsProvider (e.g. isolated tests).
    const settingsCtx = useContext(SettingsContext);
    const visualTheme = settingsCtx?.settings.visualTheme ?? 'flat';
    const fontPair = settingsCtx?.settings.fontPair ?? 'swiss';

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.visual = visualTheme;
    }, [visualTheme]);

    useEffect(() => {
        const root = document.documentElement;
        const pair = FONT_PAIRS[fontPair];
        root.style.setProperty('--font-display', pair.display);
        root.style.setProperty('--font-body', pair.body);
        root.style.setProperty('--font-mono', pair.mono);
        root.style.setProperty('--font-serif', pair.serif);
    }, [fontPair]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
