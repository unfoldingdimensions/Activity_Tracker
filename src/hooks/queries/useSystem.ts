/**
 * System Hooks
 * Queries for active window, idle status, and input history
 */

import { useQuery } from '@tanstack/react-query';
import { isTauri } from '../../utils/isTauri';
import { useVisibility } from '../../context/VisibilityContext';
import { useSettings } from '../useSettings';
import {
    getActiveWindow,
    getIdleSeconds,
    getInputHistory,
    getInputHistoryRange,
    type ActiveWindow,
    type InputHistoryBucket,
} from '../../api/tauri';
import { MOCK_ACTIVE_WINDOW, MOCK_INPUT_HISTORY } from './mockData';

/**
 * Idle status result type
 */
export interface IdleStatus {
    idleSeconds: number;
    isIdle: boolean;
}

/**
 * Get current active window with auto-refresh
 * 
 * @example
 * ```tsx
 * const { data: activeWindow } = useActiveWindow();
 * console.log(activeWindow?.process_name);
 * ```
 */
export function useActiveWindow() {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['activeWindow'],
        queryFn: async (): Promise<ActiveWindow | null> => {
            if (isTauri()) {
                return await getActiveWindow();
            }
            return MOCK_ACTIVE_WINDOW;
        },
        refetchInterval: visible ? 5000 : false,
        staleTime: 4000,
    });
}

/**
 * Get idle status with auto-refresh
 * 
 * @example
 * ```tsx
 * const { data: idleStatus } = useIdleStatus();
 * if (idleStatus?.isIdle) console.log('User is idle');
 * ```
 */
export function useIdleStatus() {
    const { visible } = useVisibility();
    // Idle threshold is user-configurable; keyed so the query refreshes on change
    const { settings } = useSettings();
    const idleThreshold = settings.idleThreshold;

    return useQuery({
        queryKey: ['idleStatus', idleThreshold],
        queryFn: async (): Promise<IdleStatus> => {
            if (isTauri()) {
                const seconds = await getIdleSeconds();
                return {
                    idleSeconds: seconds,
                    isIdle: seconds > idleThreshold,
                };
            }
            return {
                idleSeconds: 0,
                isIdle: false,
            };
        },
        refetchInterval: visible ? 5000 : false,
        staleTime: 4000,
    });
}

/**
 * Get input history (keystrokes/clicks per interval)
 * 
 * @param interval - Bucket interval in minutes
 * @param enabled - Whether the query is enabled
 * 
 * @example
 * ```tsx
 * const { data: history } = useInputHistory(1, true);
 * ```
 */
export function useInputHistory(interval: number, enabled = true) {
    const { visible } = useVisibility();
    return useQuery({
        queryKey: ['inputHistory', interval],
        queryFn: async (): Promise<InputHistoryBucket[]> => {
            if (isTauri()) {
                return await getInputHistory(interval);
            }
            return MOCK_INPUT_HISTORY;
        },
        enabled,
        refetchInterval: visible ? 10000 : false,
    });
}

/**
 * Get input history in range
 */
export function useInputHistoryRange(startIso: string, endIso: string, interval: number, enabled = true) {
    return useQuery({
        queryKey: ['inputHistoryRange', startIso, endIso, interval],
        queryFn: async (): Promise<InputHistoryBucket[]> => {
            if (isTauri()) {
                return await getInputHistoryRange(startIso, endIso, interval);
            }
            return MOCK_INPUT_HISTORY;
        },
        enabled: enabled && !!startIso && !!endIso,
    });
}
