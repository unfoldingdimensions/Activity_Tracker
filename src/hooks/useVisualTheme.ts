import { useContext } from 'react';
import { SettingsContext, type VisualTheme } from '../context/SettingsContext';

/**
 * Resolve the active visual skin ('flat' | 'glass'). Falls back to 'flat'
 * when rendered outside SettingsProvider (isolated tests, SSR).
 */
export function useVisualTheme(): VisualTheme {
    const ctx = useContext(SettingsContext);
    return ctx?.settings.visualTheme ?? 'flat';
}
