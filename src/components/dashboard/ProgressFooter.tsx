import { useVisualTheme } from '../../hooks/useVisualTheme';
import { useUserStats, useUnlockedAchievements } from '../../hooks/useTrackerData';
import { ACHIEVEMENTS_DATA } from '../../constants/achievements';
import { getRank } from '../../utils/formatters';
import { cn } from '../../utils/cn';

/**
 * Pulse progress footer: level + rank, XP bar with 'X / Y XP · Z TO LEVEL N',
 * the six achievement squares (unlocked = solid rule, locked = dashed),
 * and keyboard hints.
 */
export function ProgressFooter() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    const { data: stats } = useUserStats();
    const { data: unlocked } = useUnlockedAchievements();

    const level = stats?.current_level ?? 1;
    const xp = stats?.total_xp ?? 0;
    const rank = getRank(level);

    // Level N spans 100*(N-1)^2 -> 100*N^2 XP
    const levelStart = 100 * (level - 1) * (level - 1);
    const levelEnd = 100 * level * level;
    const progress = Math.min(100, ((xp - levelStart) / Math.max(1, levelEnd - levelStart)) * 100);
    const toNext = Math.max(0, levelEnd - xp);

    if (isFlat) {
        return (
            <div className="flex items-center gap-8 py-[22px] px-8">
                <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Level</span>
                    <span className="font-display text-[22px] font-bold tracking-[-0.035em] text-[var(--foreground)]">{level}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">{rank}</span>
                </div>

                <div className="flex-1 max-w-[300px]">
                    <div className="h-[3px] bg-[var(--border)]">
                        <div className="h-full bg-[var(--foreground)]" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="font-mono text-[8.5px] text-[var(--muted-foreground)] mt-2">
                        {xp.toLocaleString()} / {levelEnd.toLocaleString()} XP · {toNext.toLocaleString()} TO LEVEL {level + 1}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mr-1">
                        {(unlocked ?? []).length} of {ACHIEVEMENTS_DATA.length}
                    </span>
                    {ACHIEVEMENTS_DATA.map((a) => {
                        const isUnlocked = (unlocked ?? []).includes(a.code);
                        return (
                            <span
                                key={a.code}
                                title={a.title}
                                className={cn(
                                    'w-6 h-6 flex items-center justify-center font-mono text-[9px]',
                                    isUnlocked
                                        ? 'border border-[var(--foreground)] text-[var(--foreground)]'
                                        : 'border border-dashed border-[var(--border)] text-[var(--muted-foreground)]'
                                )}
                            >
                                {a.short}
                            </span>
                        );
                    })}
                </div>

                <div className="ml-auto flex gap-4 font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
                    <span>R refresh</span>
                    <span>1–6 range</span>
                    <span>T tools</span>
                </div>
            </div>
        );
    }

    return (
        <div className="card p-4 flex items-center gap-4">
            <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-[var(--foreground)]">{level}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{rank}</span>
            </div>
            <div className="flex-1">
                <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                    {xp.toLocaleString()} / {levelEnd.toLocaleString()} XP · {toNext.toLocaleString()} to level {level + 1}
                </p>
            </div>
            <div className="flex items-center gap-1.5">
                {(unlocked ?? []).length} of {ACHIEVEMENTS_DATA.length}
            </div>
        </div>
    );
}
