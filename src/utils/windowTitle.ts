import { formatAppName } from './formatters';

/** The desktop and taskbar: a window with no title to give. */
const SHELL_PROCESSES = new Set(['explorer.exe']);

const UNATTRIBUTED = 'Unattributed';

/**
 * The text a row shows for a captured window title.
 *
 * 10.8 % of captured events carry no title, and 88 % of those are `explorer.exe` — the
 * desktop genuinely has none. A blank cell reads as a capture failure, so the desktop gets
 * a name and every other empty title falls back to its app (D-028).
 *
 * This is presentation only: `window_events.window_title` keeps whatever Windows reported,
 * because "" is a fact about the window and the raw value is what an export should carry.
 */
export function displayWindowTitle(
    processName: string | null | undefined,
    windowTitle: string | null | undefined,
): string {
    const title = (windowTitle ?? '').trim();
    if (title) return title;

    const process = (processName ?? '').trim().toLowerCase();
    if (SHELL_PROCESSES.has(process)) return 'Desktop';

    return formatAppName(process) || UNATTRIBUTED;
}
