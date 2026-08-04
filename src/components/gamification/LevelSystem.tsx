import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { useUserStats } from '../../hooks/useTrackerData';
import { getLevelInfo, getRank } from '../../utils/formatters';

export function LevelSystem() {
    const { data: stats } = useUserStats();

    if (!stats) return null;

    // Progress toward the next level, aligned with the backend XP curve
    const { level, progress } = getLevelInfo(stats.total_xp);
    const rank = getRank(level);

    return (
        <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden group" hover={true}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="relative z-10 p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Trophy size={24} />
            </div>

            <div className="flex-1 min-w-0 z-10">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-medium text-[var(--muted-foreground)]">Level {level}</span>
                    <span className="text-xs font-mono text-[var(--muted-foreground)] opacity-70">
                        {stats.total_xp} XP
                    </span>
                </div>

                {/* Progress Bar Container */}
                <div className="h-2 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--muted-foreground)]">{rank}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{progress.toFixed(0)}%</span>
                </div>
            </div>
        </GlassCard>
    );
}
