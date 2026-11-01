import { describe, it, expect, beforeEach } from 'vitest';
import {
    ICON_CACHE_LIMIT,
    cacheIcon,
    clearIconCache,
    getCachedIcon,
    iconCacheSize,
} from '../iconCache';

// The failure these pin is silent: an unbounded icon cache grows with every app ever rendered, and an
// eviction that takes the wrong end drops the icon the user is looking at right now.
describe('iconCache', () => {
    beforeEach(() => clearIconCache());

    it('never grows past the limit', () => {
        for (let i = 0; i < ICON_CACHE_LIMIT + 25; i++) cacheIcon(`app${i}.exe`, `data:${i}`);
        expect(iconCacheSize()).toBe(ICON_CACHE_LIMIT);
    });

    it('evicts the least recently used entry, not the newest', () => {
        for (let i = 0; i < ICON_CACHE_LIMIT; i++) cacheIcon(`app${i}.exe`, `data:${i}`);
        cacheIcon('overflow.exe', 'data:overflow');

        expect(getCachedIcon('app0.exe')).toBeUndefined();
        expect(getCachedIcon('overflow.exe')).toBe('data:overflow');
        expect(getCachedIcon(`app${ICON_CACHE_LIMIT - 1}.exe`)).toBe(`data:${ICON_CACHE_LIMIT - 1}`);
    });

    it('counts a read as use, so a visible icon survives eviction', () => {
        for (let i = 0; i < ICON_CACHE_LIMIT; i++) cacheIcon(`app${i}.exe`, `data:${i}`);
        // app0 is the oldest, but it is on screen right now.
        expect(getCachedIcon('app0.exe')).toBe('data:0');
        cacheIcon('overflow.exe', 'data:overflow');

        expect(getCachedIcon('app0.exe')).toBe('data:0');
        expect(getCachedIcon('app1.exe')).toBeUndefined();
    });

    it('does not grow when the same app is stored twice', () => {
        for (let i = 0; i < ICON_CACHE_LIMIT; i++) cacheIcon(`app${i}.exe`, `data:${i}`);
        cacheIcon('app0.exe', 'data:refreshed');

        expect(iconCacheSize()).toBe(ICON_CACHE_LIMIT);
        expect(getCachedIcon('app0.exe')).toBe('data:refreshed');
    });
});
