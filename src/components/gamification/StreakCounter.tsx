import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUserStats } from '../../hooks/useTrackerData';
import { useVisualTheme } from '../../hooks/useVisualTheme';

export function StreakCounter() {
    const { data: stats } = useUserStats();
    const theme = useVisualTheme();

    if (!stats) return null;

    if (theme === 'flat') {
        return (
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--accent-warning)]">
                {stats.current_streak} DAY STREAK
            </span>
        );
    }

    return (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: 'reverse',
                }}
            >
                <Flame size={16} fill="currentColor" className="opacity-80" />
            </motion.div>
            <span className="text-xs font-bold font-mono">{stats.current_streak}</span>
            <span className="text-[11px] uppercase font-bold tracking-wider opacity-70">Day Streak</span>
        </div>
    );
}
