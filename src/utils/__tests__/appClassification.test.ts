import { describe, it, expect } from 'vitest';
import { classifyApp, isProductiveAppDefault } from '../appClassification';
import type { AppClassification } from '../../context/SettingsContext';

describe('isProductiveAppDefault', () => {
    it('classifies known productive apps', () => {
        expect(isProductiveAppDefault('Code.exe')).toBe(true);
        expect(isProductiveAppDefault('chrome')).toBe(true);
        expect(isProductiveAppDefault('Slack.exe')).toBe(true);
        expect(isProductiveAppDefault('WindowsTerminal.exe')).toBe(true);
        expect(isProductiveAppDefault('NOTION')).toBe(true);
    });

    it('classifies unknown apps as not productive', () => {
        expect(isProductiveAppDefault('Steam.exe')).toBe(false);
        expect(isProductiveAppDefault('spotify.exe')).toBe(false);
        expect(isProductiveAppDefault('youtube')).toBe(false);
    });
});

describe('classifyApp', () => {
    it('uses defaults when there are no overrides', () => {
        expect(classifyApp('Code.exe', {})).toBe('focus');
        expect(classifyApp('Steam.exe', {})).toBe('distraction');
    });

    it('applies a focus override to a default-distraction app', () => {
        const overrides: Record<string, AppClassification> = { steam: 'focus' };
        expect(classifyApp('Steam.exe', overrides)).toBe('focus');
    });

    it('applies a distraction override to a default-focus app', () => {
        const overrides: Record<string, AppClassification> = { code: 'distraction' };
        expect(classifyApp('Code.exe', overrides)).toBe('distraction');
    });

    it('applies an ignore override', () => {
        const overrides: Record<string, AppClassification> = { discord: 'ignore' };
        expect(classifyApp('Discord.exe', overrides)).toBe('ignore');
    });

    it('matches override keys case-insensitively by fragment', () => {
        const overrides: Record<string, AppClassification> = { STEAM: 'ignore' };
        expect(classifyApp('Steam.exe', overrides)).toBe('ignore');
    });

    it('does not let unrelated keys match', () => {
        const overrides: Record<string, AppClassification> = { 'chrome-beta': 'distraction' };
        expect(classifyApp('Code.exe', overrides)).toBe('focus');
    });
});
