import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../ui/Toast';

export function RefreshButton() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { showToast } = useToast();

    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            console.log('[RefreshButton] Manual refresh triggered...');

            // Force refetch of all active queries immediately
            await queryClient.refetchQueries({
                type: 'active'
            });

            // Mark everything as stale to ensure backgrounds are updated too
            await queryClient.invalidateQueries();

            // Visual feedback delay
            await new Promise(resolve => setTimeout(resolve, 800));

            showToast('success', 'Data refreshed successfully');
        } catch (error) {
            console.error('[RefreshButton] Refresh failed:', error);
            showToast('error', 'Failed to refresh data');
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className={`flex items-center justify-center p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-[var(--foreground)] ${isRefreshing ? 'opacity-70 cursor-not-allowed' : ''}`}
            title="Refresh Data"
            disabled={isRefreshing}
        >
            <RefreshCw
                size={18}
                className={`${isRefreshing ? 'animate-spin' : ''} transition-all`}
            />
        </motion.button>
    );
}
