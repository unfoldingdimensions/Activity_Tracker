import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '../ui/Toast';
import { useVisualTheme } from '../../hooks/useVisualTheme';

export function RefreshButton() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showToast } = useToast();
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            console.log('[RefreshButton] Manual refresh triggered...');

            // Force refetch of all active queries immediately
            await queryClient.refetchQueries({ type: 'active' });

            // Mark everything as stale to ensure backgrounds are updated too
            await queryClient.invalidateQueries();

            // Visual feedback delay
            await new Promise((resolve) => setTimeout(resolve, 800));

            showToast('success', 'Data refreshed successfully');
        } catch (error) {
            console.error('[RefreshButton] Refresh failed:', error);
            showToast('error', 'Failed to refresh data');
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isFlat) {
        return (
            <button
                onClick={handleRefresh}
                title="Refresh Data"
                disabled={isRefreshing}
                className="w-[26px] h-[26px] rounded-full border border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-60"
            >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
        );
    }

    return (
        <button
            onClick={handleRefresh}
            className={`flex items-center justify-center p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-[var(--foreground)] ${isRefreshing ? 'opacity-70 cursor-not-allowed' : ''}`}
            title="Refresh Data"
            disabled={isRefreshing}
        >
            <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} transition-all`} />
        </button>
    );
}
