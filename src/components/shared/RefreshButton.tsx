import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';

export function RefreshButton() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Invalidate all queries to trigger refetch
        await queryClient.invalidateQueries();
        // Artificial delay for visual feedback if it's too fast
        setTimeout(() => setIsRefreshing(false), 600);
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="flex items-center justify-center p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-[var(--foreground)]"
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
