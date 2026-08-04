
import React, { useEffect, useRef } from 'react';
import { GlassCard } from '../GlassCard';
import { useWellbeing } from '../../hooks/useWellbeing';
import { Eye, Clock, Activity, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { isTauri } from '../../utils/isTauri';

interface ErgonomicMetricsProps {
    onStartBreathing?: () => void;
}

interface CircleProgressProps {
    percentage: number;
    color?: string;
    size?: number;
}

// Circular Progress indicator (hoisted out of the component: creating
// components during render is disallowed by react-hooks v7)
function CircleProgress({ percentage, color = "stroke-emerald-500", size = 48 }: CircleProgressProps) {
    const radius = size / 2 - 4;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90 w-full h-full">
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-[var(--muted)]" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke="currentColor" strokeWidth="3" fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`${color} transition-all duration-1000 ease-out`}
                />
            </svg>
        </div>
    );
}

export const ErgonomicMetrics: React.FC<ErgonomicMetricsProps> = ({ onStartBreathing }) => {
    const { typingFatigue, sedentaryMinutes, needsBreak, eyeStrainProgress } = useWellbeing();

    // Fire a native notification when a break becomes needed (once per
    // break session - re-arms when the alert clears)
    const wasNeedingBreak = useRef(false);
    useEffect(() => {
        if (needsBreak && !wasNeedingBreak.current && isTauri()) {
            sendNotification({
                title: 'Time for a break',
                body: "You've been working for a while. Stand up, stretch, and rest your eyes.",
            });
        }
        wasNeedingBreak.current = needsBreak;
    }, [needsBreak]);

    return (
        <GlassCard className={`p-5 group relative overflow-hidden h-full flex flex-col ${needsBreak ? 'border-rose-500/50' : ''}`} spotlight>
            {needsBreak && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500 animate-pulse" />
            )}

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Wellbeing</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Health & Ergonomics</p>
                </div>
                {needsBreak && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onStartBreathing}
                        className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1 hover:bg-rose-500/30 transition-colors"
                    >
                        <AlertCircle size={12} />
                        Take a Break
                    </motion.button>
                )}
                {!needsBreak && onStartBreathing && (
                    <button
                        onClick={onStartBreathing}
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-xs border border-[var(--border)] rounded-full px-2 py-1"
                    >
                        Breathe
                    </button>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* 20-20-20 Rule */}
                <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                        <CircleProgress percentage={eyeStrainProgress} color="stroke-blue-400" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Eye size={16} className="text-blue-400" />
                        </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] font-medium">Eye Strain</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">20-20-20 Rule</span>
                </div>

                {/* Sedentary Timer */}
                <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                        <CircleProgress
                            percentage={Math.min(100, (sedentaryMinutes / 60) * 100)}
                            color={sedentaryMinutes > 45 ? "stroke-rose-500" : "stroke-amber-400"}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Clock size={16} className={sedentaryMinutes > 45 ? "text-rose-500" : "text-amber-400"} />
                        </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] font-medium">Sedentary</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{sedentaryMinutes}m active</span>
                </div>

                {/* Typing Fatigue */}
                <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                        <CircleProgress percentage={typingFatigue} color={typingFatigue > 70 ? "stroke-orange-500" : "stroke-emerald-400"} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Activity size={16} className={typingFatigue > 70 ? "text-orange-500" : "text-emerald-400"} />
                        </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] font-medium">Fatigue</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{typingFatigue}% load</span>
                </div>
            </div>
        </GlassCard>
    );
};
