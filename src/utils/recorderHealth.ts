/**
 * How the UI says "the recorder is actually writing".
 *
 * A status flag is a claim about intent: it is true the moment the loop is started, and stays true while the loop is
 * stuck, blocked on a lock, or failing to write. The age of the newest snapshot is a claim about evidence, so it is the
 * one the rail shows (D-065).
 */

/**
 * Above this, a running recorder is not keeping up with its own one-second tick and the reading turns into a warning.
 *
 * The loop writes once a second; the window allows for a slow tick, a paused query, or a lock held by an export, and
 * still catches a loop that has genuinely stopped.
 */
export const STALE_AFTER_SECONDS = 10;

export interface SampleAge {
    /** Short caption for the rail, e.g. `4s` or `just now`. */
    label: string;
    /** True when the age means "this is not currently writing", including "nothing recorded yet". */
    stale: boolean;
}

export function describeSampleAge(seconds: number | null | undefined): SampleAge {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
        // Unknown is not fine: no history and an unreadable timestamp both mean there is no evidence.
        return { label: 'no samples yet', stale: true };
    }

    const age = Math.max(0, Math.round(seconds));
    return {
        label: age < 2 ? 'just now' : `${age}s`,
        stale: age > STALE_AFTER_SECONDS,
    };
}
