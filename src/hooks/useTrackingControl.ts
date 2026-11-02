import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    isTracking as readTracking,
    notifyTrackingChanged,
    onTrackingChanged,
    startTracking,
    stopTracking,
} from '../api/tauri';
import { isTauri } from '../utils/isTauri';

/**
 * One owner of "is the recorder running", for every surface that can see or change it.
 *
 * Settings used to keep this in a local `useState` seeded once at mount, so a control anywhere else would have been a
 * second, silently divergent copy — pause from the rail, and Settings would still offer "Pause". The state is a query
 * (the backend is the source of truth) and every change goes through one mutation that re-reads it.
 *
 * A failed stop must **not** leave the UI saying "paused": the mutation only succeeds when the command resolves, and
 * the query is what the components read, so an error leaves the word at TRACKING and surfaces through `error`.
 */
export function useTrackingControl() {
    const queryClient = useQueryClient();
    const inTauri = isTauri();
    // Browser/demo fallback: there is no loop to stop, but the switch still has to move (Settings renders outside
    // Tauri in tests and in a plain browser tab).
    const [fallbackTracking, setFallbackTracking] = useState(true);

    const query = useQuery({
        queryKey: ['tracking-state'],
        queryFn: () => readTracking(),
        enabled: inTauri,
        staleTime: 15_000,
        // The query is a read of a live process; a window focus is a good moment to re-ask.
        refetchOnWindowFocus: true,
    });

    const mutation = useMutation({
        mutationFn: async (next: boolean) => {
            if (!inTauri) {
                setFallbackTracking(next);
                return;
            }
            if (next) await startTracking();
            else await stopTracking();
        },
        onSuccess: async () => {
            // The tray popup and the rail are separate webviews with separate caches: tell all of them, then re-read
            // locally. Without the event, a pause from one surface left the other showing the previous word.
            if (inTauri) {
                try {
                    await notifyTrackingChanged();
                } catch {
                    // No cross-window bus (tests, plain browser): the local invalidation below still applies.
                }
            }
            await queryClient.invalidateQueries({ queryKey: ['tracking-state'] });
        },
    });

    // Follow changes made in another window (the popup pausing while the rail is open, and the reverse).
    useEffect(() => {
        if (!inTauri) return;
        let cancelled = false;
        let unlisten: (() => void) | undefined;
        onTrackingChanged(() => {
            void queryClient.invalidateQueries({ queryKey: ['tracking-state'] });
        })
            .then((fn) => {
                if (cancelled) fn();
                else unlisten = fn;
            })
            .catch(() => {});
        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, [inTauri, queryClient]);

    // `undefined` while the first read is in flight, and `null` from a mock, both mean "assume recording" rather
    // than "paused" — a false negative here would tell the user their activity is not being recorded when it is.
    const isTracking = inTauri ? (query.data ?? true) : fallbackTracking;

    const setTracking = useCallback(
        async (next: boolean) => {
            await mutation.mutateAsync(next);
        },
        [mutation]
    );

    return {
        isTracking,
        isBusy: mutation.isPending,
        setTracking,
        error: mutation.error,
    };
}
