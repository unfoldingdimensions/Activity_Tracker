import { GlassCard } from '../GlassCard';
import { Flame, AlertTriangle } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';
import type { FocusSession } from '../../utils/focusSessions';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface DeepWorkSessionsProps {
    sessions: FocusSession[];
    isLoading?: boolean;
}

function formatTime(epochMs: number): string {
    return new Date(epochMs).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Lists contiguous deep-work blocks (>= 25 focused minutes) detected in the
 * selected range: time span, duration, dominant app and interruptions.
 */
export function DeepWorkSessions({ sessions, isLoading }: DeepWorkSessionsProps) {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    if (isFlat) {
        return (
            <div>
                <div className="flex items-baseline justify-between">
                    <h3 className="section-title text-[var(--foreground)]">Deep work sessions</h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                        ≥ 25 MIN · {sessions.length} CLOSED · {formatDuration(sessions.reduce((s, x) => s + x.durationSeconds, 0))} TOTAL
                    </span>
                </div>

                {isLoading && sessions.length === 0 ? (
                    <div className="mt-5 text-[12px] text-[var(--muted-foreground)]">Loading…</div>
                ) : sessions.length === 0 ? (
                    <p className="mt-5 text-[12px] text-[var(--muted-foreground)]/60">
                        No deep work sessions in this range yet — blocks of 25+ focused minutes will show here.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 mt-5">
                        {sessions.slice(0, 3).map((session, index) => (
                            <div key={`${session.startTime}-${index}`} className={cn('py-1', index > 0 && 'pl-6 border-l border-[var(--border)]')}>
                                <div className="flex items-baseline gap-2">
                                    <span className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                                        {formatDuration(session.durationSeconds)}
                                    </span>
                                    <span className="text-[13px] text-[var(--muted-foreground)]">{session.appName}</span>
                                </div>
                                <div className="mt-2 h-[3px] bg-[var(--border)]">
                                    <div
                                        className="h-full bg-[var(--accent-focus)]"
                                        style={{ width: `${Math.min(100, (session.durationSeconds / (60 * 60)) * 100)}%` }}
                                    />
                                </div>
                                <div className="font-mono text-[10px] text-[var(--muted-foreground)] mt-2">
                                    {formatTime(session.startTime)} → {formatTime(session.endTime)} ·{' '}
                                    {session.interruptions === 0
                                        ? 'CLEAN'
                                        : `${session.interruptions} ${session.interruptions === 1 ? 'INTERRUPTION' : 'INTERRUPTIONS'}`}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-500/10">
                    <Flame size={20} className="text-orange-500" />
                </div>
                <div>
                    <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                        Deep Work Sessions
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)]">
                        Contiguous focus blocks of 25+ minutes
                    </p>
                </div>
            </div>

            {isLoading && sessions.length === 0 ? (
                <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 rounded-lg bg-[var(--secondary)]/60 animate-pulse" />
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <div className="p-6 rounded-xl bg-[var(--secondary)]/40 border border-dashed border-[var(--border)] text-center">
                    <p className="text-sm text-[var(--muted-foreground)]">
                        No deep work sessions in this range yet.
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]/60 mt-1">
                        Blocks of 25+ focused minutes will show up here.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((session, index) => (
                        <div
                            key={`${session.startTime}-${index}`}
                            className="flex items-center justify-between p-3 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 rounded-lg bg-[var(--muted)] flex-shrink-0">
                                    <Flame size={16} className="text-orange-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--foreground)]">
                                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                                    </p>
                                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                                        {session.appName}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 flex-shrink-0">
                                <span className="font-mono text-sm font-bold text-[var(--foreground)]">
                                    {formatDuration(session.durationSeconds)}
                                </span>
                                <span
                                    className={`inline-flex items-center gap-1 text-xs ${
                                        session.interruptions > 0
                                            ? 'text-amber-500'
                                            : 'text-[var(--muted-foreground)]'
                                    }`}
                                >
                                    <AlertTriangle size={12} />
                                    {session.interruptions === 0
                                        ? 'Clean'
                                        : `${session.interruptions} ${session.interruptions === 1 ? 'interruption' : 'interruptions'}`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
}
