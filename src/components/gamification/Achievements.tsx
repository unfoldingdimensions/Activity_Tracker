import { Lock, Zap, Sun, Moon, Clock } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { useUnlockedAchievements } from '../../hooks/useTrackerData';
import { cn } from '../../utils/cn';

interface Achievement {
    code: string;
    title: string;
    description: string;
    icon: React.ElementType;
    xpReward: number;
}

const ACHIEVEMENTS_DATA: Achievement[] = [
    {
        code: 'early_bird',
        title: 'Early Bird',
        description: 'Start activity before 7 AM',
        icon: Sun,
        xpReward: 50
    },
    {
        code: 'night_owl',
        title: 'Night Owl',
        description: 'Record activity after 10 PM',
        icon: Moon,
        xpReward: 50
    },
    {
        code: 'deep_diver',
        title: 'Deep Diver',
        description: '4 hours of contiguous focus',
        icon: Zap,
        xpReward: 100
    },
    {
        code: 'consistency_king',
        title: 'Consistency King',
        description: 'Maintain a 7-day streak',
        icon: Clock,
        xpReward: 200
    }
];

export function Achievements() {
    const { data: unlockedCodes } = useUnlockedAchievements();

    return (
        <div className="grid grid-cols-2 gap-4">
            {ACHIEVEMENTS_DATA.map((achievement) => {
                const isUnlocked = unlockedCodes?.includes(achievement.code);
                const Icon = achievement.icon;

                return (
                    <GlassCard
                        key={achievement.code}
                        className={cn(
                            "p-3 relative flex items-center gap-3 transition-all duration-300",
                            isUnlocked
                                ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                                : "opacity-60 grayscale hover:opacity-80 hover:grayscale-0"
                        )}
                        hover={true}
                    >
                        <div className={cn(
                            "p-2 rounded-lg flex-shrink-0",
                            isUnlocked ? "bg-amber-500/20 text-amber-500" : "bg-[var(--surface)] text-[var(--muted-foreground)]"
                        )}>
                            {isUnlocked ? <Icon size={18} /> : <Lock size={18} />}
                        </div>

                        <div className="min-w-0">
                            <h4 className={cn(
                                "text-xs font-bold leading-tight",
                                isUnlocked ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                            )}>
                                {achievement.title}
                            </h4>
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate mt-0.5">
                                {achievement.description}
                            </p>
                        </div>

                        {/* XP Badge */}
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] font-mono font-bold text-amber-500/70">
                            <span>+{achievement.xpReward}</span>
                            <span className="text-[7px]">XP</span>
                        </div>
                    </GlassCard>
                );
            })}
        </div>
    );
}
