import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * RefreshHandler - Automatically refreshes app data when the window gains focus.
 * Especially useful for Tauri apps where the standard browser focus event might be inconsistent
 * or where we want an immediate, aggressive refresh of all active queries.
 */
export function RefreshHandler() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Standard focus listener
        const handleFocus = () => {
            console.log('[RefreshHandler] Window focused, invalidating critical queries only...');
            // Only invalidate time-sensitive queries
            queryClient.invalidateQueries({ queryKey: ['activeWindow'] });
            queryClient.invalidateQueries({ queryKey: ['idleStatus'] });
            // Don't invalidate heavy queries like timeline, appUsage
        };

        window.addEventListener('focus', handleFocus);

        // If we want to be even more specific for Tauri, we could use their API here.
        // But window 'focus' usually works fine in the webview.

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [queryClient]);

    return null;
}
