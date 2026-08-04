import { useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { VisibilityContext } from './VisibilityContext';
import { isTauri } from '../utils/isTauri';

const POLL_INTERVAL_MS = 2000;

/**
 * Tracks whether the current Tauri window is visible, so polling queries can
 * pause while a hidden window (e.g. the tray popup or a minimized dashboard)
 * is not on screen. Falls back to always-visible in the browser.
 */
export function VisibilityProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!isTauri()) return;

        let mounted = true;
        const checkVisibility = () => {
            getCurrentWindow()
                .isVisible()
                .then((v) => {
                    if (mounted) setVisible((prev) => (prev === v ? prev : v));
                })
                .catch(() => {});
        };

        checkVisibility();
        const id = window.setInterval(checkVisibility, POLL_INTERVAL_MS);
        return () => {
            mounted = false;
            window.clearInterval(id);
        };
    }, []);

    const value = useMemo(() => ({ visible }), [visible]);

    return (
        <VisibilityContext.Provider value={value}>
            {children}
        </VisibilityContext.Provider>
    );
}
