
import React, { useEffect, useReducer } from 'react';
import { GlassCard } from '../GlassCard';
import { Play, Pause, RefreshCw } from 'lucide-react';

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

interface TimerState {
    timeLeft: number;
    isActive: boolean;
    mode: 'Work' | 'Break';
    sessions: number;
}

type TimerAction =
    | { type: 'TICK' }
    | { type: 'TOGGLE' }
    | { type: 'RESET' };

function timerReducer(state: TimerState, action: TimerAction): TimerState {
    switch (action.type) {
        case 'TOGGLE':
            return { ...state, isActive: !state.isActive };
        case 'RESET':
            return { ...state, timeLeft: WORK_SECONDS, isActive: false, mode: 'Work' };
        case 'TICK': {
            if (!state.isActive) return state;
            const next = state.timeLeft - 1;
            if (next > 0) return { ...state, timeLeft: next };

            // Timer finished: switch mode and count the completed session.
            // Pure transition inside the reducer (no setState inside effects).
            const nextMode = state.mode === 'Work' ? 'Break' : 'Work';
            return {
                timeLeft: nextMode === 'Work' ? WORK_SECONDS : BREAK_SECONDS,
                isActive: false,
                mode: nextMode,
                sessions: state.sessions + 1,
            };
        }
    }
}

export const PomodoroTimer: React.FC = () => {
    const [state, dispatch] = useReducer(timerReducer, {
        timeLeft: WORK_SECONDS,
        isActive: false,
        mode: 'Work',
        sessions: 0,
    });
    const { timeLeft, isActive, mode, sessions } = state;

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
        return () => clearInterval(interval);
    }, [isActive]);

    const toggleTimer = () => dispatch({ type: 'TOGGLE' });

    const resetTimer = () => dispatch({ type: 'RESET' });

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = mode === 'Work'
        ? ((WORK_SECONDS - timeLeft) / WORK_SECONDS) * 100
        : ((BREAK_SECONDS - timeLeft) / BREAK_SECONDS) * 100;

    return (
        <GlassCard className="relative overflow-hidden p-4 h-full flex flex-col" spotlight>
            {/* Background Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-(--muted) w-full">
                <div
                    className={`h-full transition-all duration-1000 ${mode === 'Work' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-medium text-(--muted-foreground)">Focus Timer</h3>
                    <p className="text-xs text-(--muted-foreground)">{sessions} sessions done</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${mode === 'Work' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {mode}
                </div>
            </div>

            <div className="flex flex-col items-center">
                <div className="text-3xl font-mono font-bold font-display text-(--foreground) mb-4 tabular-nums tracking-wider">
                    {formatTime(timeLeft)}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTimer}
                        className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-(--muted) text-(--foreground) hover:bg-(--secondary)'
                            }`}
                    >
                        {isActive ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>

                    <button
                        onClick={resetTimer}
                        className="p-2 rounded-full bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--secondary) transition-all hover:scale-110 active:scale-95"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>
        </GlassCard >
    );
};
