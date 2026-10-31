import type { WindowEvent } from '../api/tauri';

/**
 * A window event with its duration normalised to **active** seconds.
 *
 * `duration_seconds` in the database is the wall-clock span between an event's
 * first and last tick, so it includes any idle time inside that span (an app left
 * focused while the machine idled absorbed the idle, producing 4-hour "sessions").
 * `active_seconds` counts only the seconds the machine was not idle — that is what
 * "time in app" means everywhere in the UI (D-018).
 *
 * Rows recorded before the column existed have no `active_seconds`; they fall back
 * to the wall-clock span until the startup backfill fills them in.
 */
export interface NormalisedWindowEvent extends WindowEvent {
    /** The original wall-clock span, kept so callers can explain the difference. */
    wall_clock_seconds: number;
}

/**
 * Normalise one event at the read boundary, so no consumer has to remember the rule.
 *
 * `active_seconds === 0` is a real value (the window held focus for a tick but the
 * machine was idle throughout) and must not be treated as missing — hence an
 * explicit null check rather than a falsy fallback.
 */
export function withActiveDuration(event: WindowEvent): NormalisedWindowEvent {
    const active = event.active_seconds;
    const hasActive = typeof active === 'number' && Number.isFinite(active);

    return {
        ...event,
        duration_seconds: hasActive ? active : event.duration_seconds,
        wall_clock_seconds: event.duration_seconds,
    };
}

/** Normalise a whole page of events, preserving order. */
export function withActiveDurations(events: WindowEvent[]): NormalisedWindowEvent[] {
    return events.map(withActiveDuration);
}
