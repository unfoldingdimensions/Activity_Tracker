import { describe, it, expect, vi } from 'vitest';
import { collectAllPages } from '../timelinePaging';

/**
 * A page source over `total` rows that records every `(limit, offset)` it was asked
 * for, so the tests can prove the walk itself, not just the assembled result.
 */
function source(total: number) {
    const rows = Array.from({ length: total }, (_, i) => i);
    const calls: [number, number][] = [];
    const fetchPage = vi.fn(async (limit: number, offset: number) => {
        calls.push([limit, offset]);
        return rows.slice(offset, offset + limit);
    });
    return { rows, calls, fetchPage };
}

describe('collectAllPages', () => {
    it('returns a short page without asking for a second one', async () => {
        const { fetchPage, calls } = source(120);

        const result = await collectAllPages(fetchPage, 200);

        expect(result.items).toHaveLength(120);
        expect(result.truncated).toBe(false);
        expect(calls).toEqual([[200, 0]]);
    });

    it('walks every page when the range holds more rows than one page', async () => {
        // The failure this pins: a single capped request returned 20000 of 20975
        // events and the leftover 975 days of a month rendered as empty.
        const { fetchPage, rows } = source(450);

        const result = await collectAllPages(fetchPage, 200);

        expect(result.items).toEqual(rows);
        expect(result.pagesFetched).toBe(3);
        expect(result.truncated).toBe(false);
    });

    it('stops after the empty page when the row count is an exact multiple', async () => {
        const { fetchPage, rows } = source(400);

        const result = await collectAllPages(fetchPage, 200);

        // Nothing dropped (the tail page is not mistaken for exhaustion) and nothing
        // duplicated (the next offset stays at the end).
        expect(result.items).toEqual(rows);
        expect(result.pagesFetched).toBe(3); // 200 + 200 + empty
    });

    it('returns an empty result for an empty range', async () => {
        const { fetchPage } = source(0);

        const result = await collectAllPages(fetchPage, 200);

        expect(result.items).toEqual([]);
        expect(result.pagesFetched).toBe(1);
        expect(result.truncated).toBe(false);
    });

    it('flags truncation instead of silently stopping at the ceiling', async () => {
        const { fetchPage } = source(1000);

        const result = await collectAllPages(fetchPage, 100, 250);

        expect(result.truncated).toBe(true);
        expect(result.items).toHaveLength(300); // three full pages, then the guard trips
        expect(result.pagesFetched).toBe(3);
    });

    it('reports truncation when a full page lands on the ceiling', async () => {
        // A full final page cannot prove the range ended there, so this is reported
        // as truncated rather than guessed complete.
        const { fetchPage } = source(200);

        const result = await collectAllPages(fetchPage, 100, 200);

        expect(result.truncated).toBe(true);
        expect(result.items).toHaveLength(200);
    });

    it('propagates a failed page instead of returning a partial range', async () => {
        const failing = vi.fn(async () => {
            throw new Error('backend unavailable');
        });

        await expect(collectAllPages(failing, 200)).rejects.toThrow('backend unavailable');
    });
});
