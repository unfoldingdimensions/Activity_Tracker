/** LRU store for base64 app icons, bounded so a long session cannot grow it without limit.
 *
 * The cache used to be a plain object that nothing ever evicted. Measured on this machine: 122 distinct
 * apps all-time, ~2.6 KB each — so the whole set is ~0.4 MB inside a 6.5 MB JS heap and the cap is a
 * boundedness invariant, not a memory saving (D-044). 150 leaves headroom over the 122 measured without
 * being big enough to matter if a future build sees three times as many apps.
 *
 * A `Map` keeps insertion order, so "least recently used" is the first key: using an entry moves it to
 * the end, and eviction takes from the front.
 */
export const ICON_CACHE_LIMIT = 150;

const store = new Map<string, string>();

export function getCachedIcon(key: string): string | undefined {
    const value = store.get(key);
    if (value === undefined) return undefined;
    // Refresh recency: an icon on screen is the one most likely to be asked for again.
    store.delete(key);
    store.set(key, value);
    return value;
}

export function cacheIcon(key: string, value: string): void {
    store.delete(key);
    store.set(key, value);
    while (store.size > ICON_CACHE_LIMIT) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
    }
}

export function iconCacheSize(): number {
    return store.size;
}

export function clearIconCache(): void {
    store.clear();
}
