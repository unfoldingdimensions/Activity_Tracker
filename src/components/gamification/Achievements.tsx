import { Lock } from 'lucide-react';
import { useUnlockedAchievements } from '../../hooks/useTrackerData';
import { ACHIEVEMENTS_DATA } from '../../constants/achievements';

export function Achievements() {
    const { data: unlockedCodes } = useUnlockedAchievements();

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ACHIEVEMENTS_DATA.map((achievement) => {
                const isUnlocked = unlockedCodes?.includes(achievement.code);
                const Icon = achievement.icon;
                return (
                    <div
                        key={achievement.code}
                        className={`p-4 rounded-xl border transition-all duration-300 ${
                            isUnlocked
                                ? 'bg-[var(--secondary)]/50 border-[var(--border)]'
                                : 'bg-transparent border-dashed border-[var(--border)] opacity-70'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div
                                className={`p-2 rounded-lg ${
                                    isUnlocked ? 'bg-[var(--primary)]/10' : 'bg-[var(--muted)]'
                                }`}
                            >
                                <Icon
                                    size={18}
                                    className={isUnlocked ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}
                                />
                            </div>
                            {isUnlocked ? (
                                <span className="text-[10px] font-bold text-emerald-500">UNLOCKED</span>
                            ) : (
                                <Lock size={12} className="text-[var(--muted-foreground)]" />
                            )}
                        </div>
                        <p className={`text-sm font-semibold ${isUnlocked ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                            {achievement.title}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{achievement.description}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]/70 mt-2 font-mono">
                            +{achievement.xpReward} XP
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
