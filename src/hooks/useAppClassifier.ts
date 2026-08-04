import { useMemo } from 'react';
import { useSettings } from './useSettings';
import { classifyApp } from '../utils/appClassification';

/**
 * Returns a stable classifier function backed by the user's per-app
 * classification overrides. Re-created only when overrides change, so
 * memoized consumers recompute exactly when the classification changes.
 */
export function useAppClassifier() {
    const { settings } = useSettings();
    return useMemo(
        () => (processName: string) => classifyApp(processName, settings.appClassification),
        [settings.appClassification]
    );
}
