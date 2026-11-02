/**
 * The one word the app uses for "is it recording".
 *
 * Tracking, idle and paused are three different facts and the status area used to collapse two of them: a stopped
 * loop still rendered `IDLE · <last window>` because the footer only asked the idle query. Pause made that a lie you
 * could see every time you used it, so the decision lives here, in one place, and is tested.
 */

export type TrackingStatus = 'PAUSED' | 'IDLE' | 'TRACKING';

/** Paused outranks idle: if nothing is recording, "idle" is a description of a stale window, not of the app. */
export function statusLabel(tracking: boolean, idle: boolean): TrackingStatus {
    if (!tracking) return 'PAUSED';
    return idle ? 'IDLE' : 'TRACKING';
}

/**
 * Colour for the 6px dot. Paused and idle both take the muted lead — DESIGN.md forbids a third accent for inactive
 * states — so the word, not the colour, carries the difference.
 */
export function statusDotColor(tracking: boolean): string {
    return tracking ? 'var(--accent-focus)' : 'var(--muted-foreground)';
}

/** Only a live loop pulses; nothing else in the rail may look alive. */
export function statusPulses(tracking: boolean, idle: boolean): boolean {
    return tracking && !idle;
}
