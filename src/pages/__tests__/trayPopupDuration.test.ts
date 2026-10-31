import { describe, expect, it } from 'vitest';
// Vite `?raw` import: the assertion is about the source, not about rendering, and the two theme
// branches are exactly the kind of duplication a component test would happily pass while wrong.
import traySource from '../TrayPopup.tsx?raw';

/**
 * `appUsage[].value` is seconds at every producer (database `total_seconds` → query hooks) and
 * `formatDuration` takes seconds — `AppUsageSide` renders the same data as `formatDuration(app.value)`.
 *
 * The popup once treated the value as minutes and rendered `formatDuration(topApp.value * 60)`, so
 * the Top Application pill read "26h 30m" for 26 minutes of use. Fails if: anyone reintroduces the
 * ×60 conversion on this value, in either theme branch.
 */
describe('TrayPopup — top application duration', () => {
    const durationArgs = [...traySource.matchAll(/formatDuration\(\s*([^)]*?)\s*\)/g)].map((m) => m[1]);

    it('never converts an appUsage value before formatting it', () => {
        const scaled = durationArgs.filter((arg) => /\*\s*\d+/.test(arg) && /\.value\b/.test(arg));
        expect(scaled, `formatDuration received a scaled appUsage value: ${scaled.join(', ')}`).toEqual([]);
    });

    it('formats the pill identically in both theme branches', () => {
        // Flat and glass keep separate copies of this markup; the bug existed in both. Adding a third
        // theme (or dropping the pill) should fail here so the branches are kept in step on purpose.
        const pills = traySource.match(/formatDuration\(topApp\.value\)/g) ?? [];
        expect(pills.length).toBe(2);
    });
});
