import { useQuery } from '@tanstack/react-query';
import { secondsSinceLastSnapshot } from '../api/tauri';
import { isTauri } from '../utils/isTauri';

/**
 * The age of the newest snapshot, polled while a surface is on screen.
 *
 * Cheap by construction: `idx_activity_timestamp` turns `MAX(timestamp)` into an index walk, and the answer is one
 * integer every five seconds. Disabled while the recorder is paused — a frozen age there is expected, not a fault.
 */
export function useRecorderHealth(enabled: boolean) {
    const query = useQuery({
        queryKey: ['recorder-health'],
        queryFn: () => secondsSinceLastSnapshot(),
        enabled: enabled && isTauri(),
        refetchInterval: 5_000,
        staleTime: 0,
        retry: 0,
    });

    return { secondsAgo: query.data ?? null, isLoading: query.isLoading };
}
