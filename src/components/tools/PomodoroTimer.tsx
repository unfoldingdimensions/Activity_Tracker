
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../GlassCard';
import { Play, Pause, RefreshCw } from 'lucide-react';

export const PomodoroTimer: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'Work' | 'Break'>('Work');
    const [sessionsCompleted, setSessionsCompleted] = useState(0);

    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            if (mode === 'Work') {
                setSessionsCompleted(s => s + 1);
                // Auto switch to break? Or wait for user? 
                // Let's wait for user, but switch mode
                setMode('Break');
                setTimeLeft(5 * 60);
            } else {
                setMode('Work');
                setTimeLeft(25 * 60);
            }
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => {
        setIsActive(!isActive);
    };

    const resetTimer = () => {
        setIsActive(false);
        setMode('Work');
        setTimeLeft(25 * 60);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = mode === 'Work'
        ? ((25 * 60 - timeLeft) / (25 * 60)) * 100
        : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

    return (
        <GlassCard className="relative overflow-hidden p-4" spotlight>
            {/* Background Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-[var(--muted)] w-full">
                <div
                    className={`h-full transition-all duration-1000 ${mode === 'Work' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Focus Timer</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">{sessionsCompleted} sessions done</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${mode === 'Work' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {mode}
                </div>
            </div>

            <div className="flex flex-col items-center">
                <div className="text-3xl font-mono font-bold font-display text-[var(--foreground)] mb-4 tabular-nums tracking-wider">
                    {formatTime(timeLeft)}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTimer}
                        className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--secondary)]'
                            }`}
                    >
                        {isActive ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>

                    <button
                        onClick={resetTimer}
                        className="p-2 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all hover:scale-110 active:scale-95"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>
        </GlassCard >
    );
};
