import { describe, it, expect } from 'vitest';
import { shouldShowCategory, windowTitleCell } from '../timelineRows';

describe('shouldShowCategory', () => {
    it('marks the first row of a group', () => {
        expect(shouldShowCategory(null, 'distraction')).toBe(true);
        expect(shouldShowCategory(undefined, 'focus')).toBe(true);
    });

    it('stays quiet while the category repeats', () => {
        expect(shouldShowCategory('distraction', 'distraction')).toBe(false);
        expect(shouldShowCategory('focus', 'focus')).toBe(false);
    });

    it('marks the row where the category changes', () => {
        expect(shouldShowCategory('distraction', 'focus')).toBe(true);
        expect(shouldShowCategory('focus', 'ignore')).toBe(true);
    });
});

describe('windowTitleCell', () => {
    it('keeps a title that says something the app name does not', () => {
        expect(windowTitleCell('opera.exe', 'History / X - Opera')).toBe('History / X - Opera');
    });

    it('drops a title that only repeats the app name', () => {
        // 25 of 49 rows in the measured view did this.
        expect(windowTitleCell('activity-tracker-v2.exe', 'Activity Tracker v2')).toBeNull();
        expect(windowTitleCell('chrome.exe', 'Chrome')).toBeNull();
    });

    it('is case- and space-insensitive about the repetition', () => {
        expect(windowTitleCell('zcode.exe', '  ZCode ')).toBeNull();
    });

    it('still names the desktop, which is not the app name', () => {
        expect(windowTitleCell('explorer.exe', '')).toBe('Desktop');
    });

    it('drops an empty-title fallback that resolves to the app name', () => {
        // Previously `displayWindowTitle` returned the app name here, and the row printed it twice.
        expect(windowTitleCell('deepseek harness.exe', '')).toBeNull();
    });
});
