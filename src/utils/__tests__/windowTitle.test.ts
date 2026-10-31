import { describe, expect, it } from 'vitest';
import { displayWindowTitle } from '../windowTitle';
// The page source itself, via Vite's ?raw import: the guard below must not need Node APIs
// in a jsdom test, and it must not drift from what ships.
import timelineSource from '../../pages/Timeline.tsx?raw';

describe('displayWindowTitle', () => {
    it('shows the captured title unchanged', () => {
        expect(displayWindowTitle('chrome.exe', 'Remote Sales Pipeline - Chrome')).toBe(
            'Remote Sales Pipeline - Chrome',
        );
    });

    it('trims a title that is only whitespace instead of rendering a blank cell', () => {
        expect(displayWindowTitle('chrome.exe', '   ')).toBe('Chrome');
        expect(displayWindowTitle('chrome.exe', '\t\n')).toBe('Chrome');
    });

    // Measured on the real history: 5,927 of 6,743 titleless events are explorer.exe — the
    // desktop. Showing "Explorer" there would be wrong; showing nothing is the blank row
    // this fix exists to remove.
    it('names the desktop rather than leaving the row blank', () => {
        expect(displayWindowTitle('explorer.exe', '')).toBe('Desktop');
        expect(displayWindowTitle('explorer.exe', null)).toBe('Desktop');
    });

    it('falls back to the app name for any other titleless window', () => {
        expect(displayWindowTitle('claude.exe', '')).toBe('Claude');
        expect(displayWindowTitle('gcc.exe', null)).toBe('Gcc');
    });

    // The invariant the whole change rests on: a row can never be empty, because an empty
    // row is indistinguishable from a failed capture.
    it('never returns an empty string', () => {
        const cases: Array<[string | null | undefined, string | null | undefined]> = [
            ['explorer.exe', ''],
            ['chrome.exe', '  '],
            ['', ''],
            [null, null],
            [undefined, undefined],
            ['unknown', null],
        ];
        for (const [process, title] of cases) {
            expect(displayWindowTitle(process, title)).not.toBe('');
        }
    });

    // A third skin added later must not reintroduce the raw fallback. The rule is one
    // owner for the decision, so the page is not allowed to decide for itself.
    it('is the only place Timeline decides what a title looks like', () => {
        expect(timelineSource).toContain('displayWindowTitle(');
        expect(timelineSource).not.toMatch(/window_title\s*\|\|/);
    });
});
