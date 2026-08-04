import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useToast } from '../components/ui/Toast';
import { isTauri } from '../utils/isTauri';
import { formatDuration } from '../utils/formatters';

interface LimitPayload {
    app: string;
    limit_seconds: number;
    usage_seconds: number;
}

/**
 * Subscribes to backend "limit-reached" events (distraction guard) and
 * surfaces them as in-app toasts. Safe no-op in browser mode.
 */
export function useLimitAlerts() {
    const { showToast } = useToast();

    // Latest-ref so the effect never re-subscribes on toast identity changes
    const showToastRef = useRef(showToast);
    useEffect(() => {
        showToastRef.current = showToast;
    }, [showToast]);

    useEffect(() => {
        if (!isTauri()) return;
        let active = true;
        let unlisten: (() => void) | undefined;

        listen<LimitPayload>('limit-reached', (event) => {
            if (!active) return;
            const { app, usage_seconds, limit_seconds } = event.payload;
            showToastRef.current(
                'warning',
                `${app}: daily limit reached (${formatDuration(usage_seconds)} of ${formatDuration(limit_seconds)}).`
            );
        })
            .then((fn) => {
                if (active) unlisten = fn;
                else fn();
            })
            .catch((err) => console.error('Failed to listen for limit alerts:', err));

        return () => {
            active = false;
            unlisten?.();
        };
    }, []);
}
