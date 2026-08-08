import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { useWellbeing } from '../hooks/useWellbeing';
import { useAppUsage } from '../hooks/useTrackerData';
import { SegTabs } from '../components/ui/SegTabs';
import { Bar } from '../components/ui/Bar';
import { cn } from '../utils/cn';
import { formatDuration, formatAppName } from '../utils/formatters';
import { buildToolsInsights } from '../utils/editorialInsights';
import { BreathingWidget } from '../components/wellbeing/BreathingWidget';
import { useSettings } from '../hooks/useSettings';
import { isTauri } from '../utils/isTauri';
import { EditorialIntro } from '../components/shared/EditorialIntro';

/* ------------------------------------------------------------------ */
/* Focus timer state (extended: Work/Break/Long + streak ledger)        */
/* ------------------------------------------------------------------ */

const MODES = { Work: 25 * 60, Break: 5 * 60, Long: 15 * 60 } as const;
type Mode = keyof typeof MODES;

interface TimerState {
    timeLeft: number;
    isActive: boolean;
    mode: Mode;
    workSessions: number;
    breaks: number;
    streak: number;
    bestStreak: number;
}

type TimerAction =
    | { type: 'TICK' }
    | { type: 'TOGGLE' }
    | { type: 'RESET' }
    | { type: 'SET_MODE'; mode: Mode }
    | { type: 'SKIP' };

function timerReducer(state: TimerState, action: TimerAction): TimerState {
    switch (action.type) {
        case 'TOGGLE':
            return { ...state, isActive: !state.isActive };
        case 'RESET':
            return { ...state, timeLeft: MODES[state.mode], isActive: false };
        case 'SET_MODE':
            return { ...state, mode: action.mode, timeLeft: MODES[action.mode], isActive: false };
        case 'SKIP': {
            const nextMode: Mode = state.mode === 'Work' ? 'Break' : 'Work';
            return { ...state, mode: nextMode, timeLeft: MODES[nextMode], isActive: false };
        }
        case 'TICK': {
            if (!state.isActive) return state;
            const next = state.timeLeft - 1;
            if (next > 0) return { ...state, timeLeft: next };

            // Phase completed
            if (state.mode === 'Work') {
                const streak = state.streak + 1;
                return {
                    ...state,
                    timeLeft: MODES.Break,
                    mode: 'Break',
                    isActive: false,
                    workSessions: state.workSessions + 1,
                    streak,
                    bestStreak: Math.max(state.bestStreak, streak),
                };
            }
            return {
                ...state,
                timeLeft: MODES.Work,
                mode: 'Work',
                isActive: false,
                breaks: state.breaks + 1,
                streak: 0,
            };
        }
    }
}

interface DailyGoal {
    id: string;
    appName: string;
    targetMinutes: number;
}

const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function Tools() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    const { settings } = useSettings();
    const { data: appUsage } = useAppUsage();
    const { eyeStrainProgress, sedentaryMinutes, typingFatigue, needsBreak } = useWellbeing();
    const [showBreathing, setShowBreathing] = useState(false);
    const [breathingSessions, setBreathingSessions] = useState(0);
    // Tracks whether *this* widget session requested fullscreen, so closing
    // only exits fullscreen when we were the ones who entered it.
    const breathingFullscreenRef = useRef(false);

    /** Enter OS/webview fullscreen (Tauri setFullscreen, browser Fullscreen API). */
    const enterBreathingFullscreen = async () => {
        try {
            if (isTauri()) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().setFullscreen(true);
            } else if (document.fullscreenEnabled && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
            breathingFullscreenRef.current = true;
        } catch (error) {
            // Fullscreen denied (rare) — fall back to the plain overlay.
            console.error('Failed to enter fullscreen:', error);
        }
    };

    const exitBreathingFullscreen = async () => {
        if (!breathingFullscreenRef.current) return;
        breathingFullscreenRef.current = false;
        try {
            if (isTauri()) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().setFullscreen(false);
            } else if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error('Failed to exit fullscreen:', error);
        }
    };

    const [timer, dispatch] = useReducer(timerReducer, {
        timeLeft: MODES.Work,
        isActive: false,
        mode: 'Work',
        workSessions: 0,
        breaks: 0,
        streak: 0,
        bestStreak: 0,
    });

    useEffect(() => {
        if (!timer.isActive) return;
        const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
        return () => clearInterval(interval);
    }, [timer.isActive]);

    /* --- Daily targets (moved from GoalSetter, same localStorage) --- */
    const [goals, setGoals] = useState<DailyGoal[]>(() => {
        const saved = localStorage.getItem('activity_tracker_goals');
        if (saved) {
            try {
                return JSON.parse(saved) as DailyGoal[];
            } catch {
                /* ignore */
            }
        }
        return [];
    });
    const [newGoalApp, setNewGoalApp] = useState('');
    const [newGoalDuration, setNewGoalDuration] = useState('60');

    useEffect(() => {
        localStorage.setItem('activity_tracker_goals', JSON.stringify(goals));
    }, [goals]);

    const addGoal = () => {
        if (!newGoalApp.trim() || !newGoalDuration) return;
        setGoals([
            ...goals,
            { id: Date.now().toString(), appName: newGoalApp.trim(), targetMinutes: parseInt(newGoalDuration) },
        ]);
        setNewGoalApp('');
        setNewGoalDuration('60');
    };

    const removeGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id));

    const goalUsage = (appName: string): number => {
        const entry = (appUsage ?? []).find((a) => a.name.toLowerCase().includes(appName.toLowerCase()));
        return entry ? Math.round(entry.seconds / 60) : 0;
    };

    const goalsMet = goals.filter((g) => goalUsage(g.appName) >= g.targetMinutes).length;

    /* --- Derived status line --- */
    const breakDue = needsBreak ? 'NOW' : `${Math.max(0, 60 - sedentaryMinutes)}m`;
    const statusLine = `${timer.workSessions} POMODOROS TODAY | ${goalsMet} OF ${goals.length} TARGETS MET | BREAK DUE IN ${breakDue}`;

    const insights = useMemo(
        () => buildToolsInsights(timer.workSessions, goalsMet, goals.length, {
            needsBreak,
            sedentaryMinutes,
        }),
        [timer.workSessions, goalsMet, goals.length, needsBreak, sedentaryMinutes]
    );

    const timerProgress =
        ((MODES[timer.mode] - timer.timeLeft) / MODES[timer.mode]) * 100;

    const focusSeconds = timer.workSessions * 25 * 60;

    /* --- Breathing pattern: 4-7-8 drawn to scale --- */
    const pattern = [
        { label: 'INHALE', value: 4 },
        { label: 'HOLD', value: 7 },
        { label: 'EXHALE', value: 8 },
    ];
    const maxPattern = 8;

    const closeBreathing = () => {
        setBreathingSessions((s) => s + 1);
        setShowBreathing(false);
        void exitBreathingFullscreen();
    };

    /* One structure for both skins; glass gets glass containers. */
    const band = isFlat
        ? 'widget px-6 py-5'
        : 'rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 backdrop-blur-md p-6';

    const timerBtn = (solid: boolean) =>
        cn(
            'font-mono uppercase tracking-[0.08em] transition-colors px-3 py-1.5',
            isFlat
                ? cn(
                      'border text-[10px]',
                      solid
                          ? 'border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--surface)]'
                          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]'
                  )
                : cn(
                      'text-sm font-medium rounded-lg',
                      solid
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  )
        );

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader title="Tools" meta={statusLine} />
            <EditorialIntro
                sentence={`You closed ${timer.workSessions} ${timer.workSessions === 1 ? 'pomodoro' : 'pomodoros'} and ${breathingSessions} ${breathingSessions === 1 ? 'breathing session' : 'breathing sessions'} today — the timer is the only thing here that isn't a record.`}
                note={breakDue === 'NOW' ? undefined : `BREAK DUE IN ${breakDue}`}
                insights={insights}
            />
            <BreathingWidget isOpen={showBreathing} onClose={closeBreathing} />

            <div className={cn(isFlat ? 'w-full px-8 pt-2 pb-10' : 'p-8 pt-6 space-y-6 flex-1 w-full')}>
                {/* ===== Focus timer + Daily targets ===== */}
                <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]', isFlat && 'py-6 border-b border-[var(--border)]')}>
                    {/* Focus timer */}
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Focus timer</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                {timer.mode} · session {timer.workSessions + 1}
                            </span>
                        </div>

                        <SegTabs
                            className="mt-5"
                            options={[
                                { value: 'Work', label: 'Work 25' },
                                { value: 'Break', label: 'Break 5' },
                                { value: 'Long', label: 'Long 15' },
                            ]}
                            value={timer.mode}
                            onChange={(m) => dispatch({ type: 'SET_MODE', mode: m })}
                        />

                        <div className="mt-6 flex items-end gap-6">
                            <div
                                className="font-display font-semibold tabular-nums leading-none text-[var(--foreground)]"
                                style={{ fontSize: isFlat ? 118 : 64, letterSpacing: '-0.06em' }}
                            >
                                {formatClock(timer.timeLeft)}
                            </div>
                            <div className="flex gap-2 pb-2">
                                <button
                                    onClick={() => dispatch({ type: 'TOGGLE' })}
                                    className={timerBtn(true)}
                                >
                                    {timer.isActive ? 'Pause' : 'Start'}
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'RESET' })}
                                    className={timerBtn(false)}
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'SKIP' })}
                                    className={timerBtn(false)}
                                >
                                    Skip
                                </button>
                            </div>
                        </div>

                        {/* Elapsed track */}
                        <div className="mt-5">
                            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                <span>{formatClock(MODES[timer.mode])}</span>
                                <span>elapsed {formatClock(MODES[timer.mode] - timer.timeLeft)}</span>
                                <span>00:00</span>
                            </div>
                            <div className="mt-1.5 h-[3px] bg-[var(--border)]">
                                <div
                                    className="h-full bg-[var(--accent-support)] transition-all duration-1000"
                                    style={{ width: `${timerProgress}%` }}
                                />
                            </div>
                        </div>

                        {/* Ledger */}
                        <div className="grid grid-cols-4 mt-6 border-t border-[var(--border)]">
                            {[
                                { label: 'Done today', value: String(timer.workSessions) },
                                { label: 'Focused', value: formatDuration(focusSeconds) },
                                { label: 'Breaks taken', value: String(timer.breaks) },
                                { label: 'Best streak', value: String(timer.bestStreak) },
                            ].map((item, i) => (
                                <div key={item.label} className={cn('pt-3', i > 0 && 'pl-5 border-l border-[var(--border)]')}>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                                        {item.label}
                                    </div>
                                    <div className="sub-metric mt-1.5 text-[var(--foreground)]">{item.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Today vs target segments */}
                        <div className="mt-5 flex items-center gap-2">
                            {Array.from({ length: 8 }, (_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'w-[26px] h-2',
                                        i < Math.min(timer.workSessions, 8) ? 'bg-[var(--accent-support)]' : 'bg-[var(--border)]'
                                    )}
                                />
                            ))}
                            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                                {timer.workSessions} of 8 today
                            </span>
                        </div>
                    </div>

                    {/* Daily targets */}
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Daily targets</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                {goalsMet} of {goals.length} met
                            </span>
                        </div>

                        <div className="mt-5 space-y-4">
                            {goals.length === 0 && (
                                <p className="text-[12px] text-[var(--muted-foreground)]/60">
                                    No targets yet — add one below.
                                </p>
                            )}
                            {goals.map((goal) => {
                                const used = goalUsage(goal.appName);
                                const limit = Object.entries(settings.appLimits).find(([n]) =>
                                    goal.appName.toLowerCase().includes(n.toLowerCase())
                                );
                                const isOverLimit = limit ? used >= Math.round(limit[1] / 60) : false;
                                return (
                                    <div key={goal.id} className="group">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                                                {formatAppName(goal.appName)}
                                            </span>
                                            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                                                {used} / {goal.targetMinutes} min
                                            </span>
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <div className="flex-1">
                                                <Bar
                                                    value={(used / Math.max(1, goal.targetMinutes)) * 100}
                                                    color={isOverLimit ? 'var(--accent-warning)' : 'var(--accent-focus)'}
                                                    height="thin"
                                                />
                                            </div>
                                            {limit && (
                                                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent-warning)]">
                                                    LIMIT
                                                </span>
                                            )}
                                            <button
                                                onClick={() => removeGoal(goal.id)}
                                                aria-label={`Remove target for ${goal.appName}`}
                                                className="font-mono text-[10px] text-[var(--muted-foreground)] hover:text-[var(--accent-negative)] transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add row */}
                        <div className="mt-5 flex gap-2 items-center">
                            <input
                                value={newGoalApp}
                                onChange={(e) => setNewGoalApp(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addGoal();
                                }}
                                placeholder="App name"
                                aria-label="Target app name"
                                className="flex-1 bg-transparent border-b border-dashed border-[var(--border)] focus:border-[var(--foreground)] outline-none font-mono text-[12px] text-[var(--foreground)] py-1.5 placeholder:text-[var(--muted-foreground)]/60"
                            />
                            <input
                                type="number"
                                value={newGoalDuration}
                                onChange={(e) => setNewGoalDuration(e.target.value)}
                                aria-label="Target minutes"
                                className="w-14 bg-transparent border-b border-dashed border-[var(--border)] focus:border-[var(--foreground)] outline-none font-mono text-[12px] text-[var(--foreground)] py-1.5"
                            />
                            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">min</span>
                            <button
                                onClick={addGoal}
                                className="px-3 py-1.5 border border-dashed border-[var(--border)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            >
                                Add
                            </button>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]/70 mt-4 leading-relaxed">
                            Targets are local. Limits also notify once a day and amber the tray icon.
                        </p>
                    </div>
                </div>

                {/* ===== Wellbeing ===== */}
                <div className={cn(isFlat && 'py-6 border-b border-[var(--border)]')}>
                    <div className={band}>
                        <h3 className="section-title text-[var(--foreground)]">Wellbeing</h3>
                        <div className="grid grid-cols-3 gap-10 mt-5">
                            <div>
                                <div className="flex items-baseline justify-between">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Eye strain</span>
                                    <span className="font-mono text-[12px] font-bold text-[var(--foreground)]">{Math.round(eyeStrainProgress)}%</span>
                                </div>
                                <div className="mt-2">
                                    <Bar value={eyeStrainProgress} height="thin" />
                                </div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-2">
                                    Next look-away in {Math.max(0, Math.round(20 * (1 - eyeStrainProgress / 100)))} min
                                </p>
                            </div>
                            <div>
                                <div className="flex items-baseline justify-between">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Sedentary</span>
                                    <span className={cn('font-mono text-[12px] font-bold', sedentaryMinutes > 45 ? 'text-[var(--accent-warning)]' : 'text-[var(--foreground)]')}>
                                        {sedentaryMinutes} min
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <Bar value={(sedentaryMinutes / 60) * 100} color={sedentaryMinutes > 45 ? 'var(--accent-warning)' : 'var(--accent-focus)'} height="thin" />
                                </div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-2">
                                    Stand up before 60 min
                                </p>
                            </div>
                            <div>
                                <div className="flex items-baseline justify-between">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Typing fatigue</span>
                                    <span className="font-mono text-[12px] font-bold text-[var(--foreground)]">{Math.round(typingFatigue)}%</span>
                                </div>
                                <div className="mt-2">
                                    <Bar value={typingFatigue} height="thin" />
                                </div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-2">
                                    {Math.round(typingFatigue)}% load
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== Breathing ===== */}
                <div className={cn(isFlat && 'py-6 border-b border-[var(--border)]')}>
                    <div className={band}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="section-title text-[var(--foreground)]">Breathing</h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                                4-7-8 · {breathingSessions} sessions today
                            </span>
                        </div>
                        <div className="flex items-end gap-8 mt-5">
                            <div className="font-display font-semibold tabular-nums leading-none text-[var(--foreground)]" style={{ fontSize: isFlat ? 56 : 44, letterSpacing: '-0.04em' }}>
                                1:16
                            </div>
                            <div className="flex-1">
                                <div className="flex items-end gap-1.5 h-16">
                                    {[...pattern, ...pattern].map((p, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'flex-1 transition-colors',
                                                i < 3 ? 'bg-[var(--accent-support)]' : 'bg-[var(--border)]'
                                            )}
                                            style={{ height: `${(p.value / maxPattern) * 100}%` }}
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-2">
                                    <span>Inhale 4</span>
                                    <span>Hold 7</span>
                                    <span>Exhale 8</span>
                                    <span className="opacity-50">Inhale 4</span>
                                    <span className="opacity-50">Hold 7</span>
                                    <span className="opacity-50">Exhale 8</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowBreathing(true)}
                                    className={timerBtn(true)}
                                >
                                    Start
                                </button>
                                <button
                                    onClick={() => {
                                        void enterBreathingFullscreen();
                                        setShowBreathing(true);
                                    }}
                                    className={timerBtn(false)}
                                >
                                    Full screen
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]/70 mt-4">
                            Runs as an overlay; auto-fires when sedentary time crosses 60 minutes.
                        </p>
                    </div>
                </div>

                {/* ===== Week strip footer ===== */}
                <div className="py-4 flex items-center gap-5">
                    <div className="flex gap-1.5">
                        {Array.from({ length: 7 }, (_, i) => (
                            <div
                                key={i}
                                className={cn('w-10 h-2', i < Math.min(timer.workSessions, 7) ? 'bg-[var(--accent-support)]' : 'bg-[var(--border)]')}
                            />
                        ))}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                        {timer.workSessions} pomodoros · {breathingSessions} breathing sessions
                    </span>
                </div>
            </div>
        </div>
    );
}
