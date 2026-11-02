import { displayWindowTitle } from './windowTitle';
import { formatAppName } from './formatters';

/**
 * Row-level rules for the Timeline log.
 *
 * Both exist because a 250-row list repeats itself: the category was printed on every row (all of them identical in a
 * normal hour), and the title cell printed the app name whenever Windows had no better title to offer. One fact, said
 * twice, at the density where the eye has the least patience for it.
 */

/**
 * Show the category badge only where the category changes — the first row of a group, and every boundary after it.
 *
 * A badge per row is the "pill on every field" pattern in AGENTS.md §4: the value varies per app, not per row, so
 * twenty identical tags say one thing twenty times. Where it changes, it is the most useful mark on the row.
 */
export function shouldShowCategory(previous: string | null | undefined, current: string): boolean {
    return previous === null || previous === undefined || previous !== current;
}

/**
 * The text the title cell should show, or `null` when the cell would only repeat the app name.
 *
 * `displayWindowTitle` keeps its job: an empty title still becomes "Desktop" for a shell process, so a missing title
 * never reads as a capture failure (D-028). What changes is the degenerate case — a fallback that resolves to the app
 * name — which is dropped rather than printed beside the very thing it repeats.
 */
export function windowTitleCell(
    processName: string | null | undefined,
    windowTitle: string | null | undefined
): string | null {
    const title = displayWindowTitle(processName, windowTitle).trim();
    const app = formatAppName((processName ?? '').trim().toLowerCase()).trim();
    if (app && title.toLowerCase() === app.toLowerCase()) return null;
    return title || null;
}
