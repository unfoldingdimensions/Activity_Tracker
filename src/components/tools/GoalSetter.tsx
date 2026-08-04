
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../GlassCard';
import { useAppUsage } from '../../hooks/useTrackerData';
import { Plus, Trash2, Target, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAppName } from '../../utils/formatters';

import { AppIcon } from '../shared/AppIcon';

interface DailyGoal {

    id: string;
    appName: string; // "All" or specific process name
    targetMinutes: number;
}

export const GoalSetter: React.FC = () => {
    const { data: appUsage } = useAppUsage();
    // Load goals from local storage once, lazily (avoids setState-in-effect)
    const [goals, setGoals] = useState<DailyGoal[]>(() => {
        const saved = localStorage.getItem('activity_tracker_goals');
        if (saved) {
            try {
                return JSON.parse(saved) as DailyGoal[];
            } catch (e) {
                console.error('Failed to parse goals', e);
            }
        }
        return [];
    });
    const [isAdding, setIsAdding] = useState(false);
    const [newGoalApp, setNewGoalApp] = useState('');
    const [newGoalDuration, setNewGoalDuration] = useState('60');

    // Save goals
    useEffect(() => {
        localStorage.setItem('activity_tracker_goals', JSON.stringify(goals));
    }, [goals]);

    const addGoal = () => {
        if (!newGoalApp || !newGoalDuration) return;
        const newGoal: DailyGoal = {
            id: Date.now().toString(),
            appName: newGoalApp,
            targetMinutes: parseInt(newGoalDuration)
        };
        setGoals([...goals, newGoal]);
        setIsAdding(false);
        setNewGoalApp('');
        setNewGoalDuration('60');
    };

    const removeGoal = (id: string) => {
        setGoals(goals.filter(g => g.id !== id));
    };

    const getProgress = (goal: DailyGoal) => {
        if (!appUsage) return 0;

        // Find usage for this app
        // Note: appUsage names usually end in .exe on Windows, let's loose match
        const appEntry = appUsage.find(a =>
            a.name.toLowerCase().includes(goal.appName.toLowerCase())
        );

        if (!appEntry) return 0;

        const currentMinutes = Math.round(appEntry.seconds / 60);
        return Math.min(100, (currentMinutes / goal.targetMinutes) * 100);
    };

    return (
        <GlassCard className="p-5" spotlight>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Daily Targets</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Set goals for app usage</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="p-1.5 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors text-[var(--foreground)]"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Add Goal Form */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-4 bg-[var(--muted)] rounded-lg p-3 space-y-3"
                    >
                        <input
                            type="text"
                            placeholder="App Name (e.g. Code)"
                            value={newGoalApp}
                            onChange={(e) => setNewGoalApp(e.target.value)}
                            className="w-full bg-transparent border-b border-[var(--border)] text-sm py-1 focus:outline-none focus:border-emerald-500 text-[var(--foreground)]"
                        />
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={newGoalDuration}
                                onChange={(e) => setNewGoalDuration(e.target.value)}
                                className="w-16 bg-transparent border-b border-[var(--border)] text-sm py-1 focus:outline-none focus:border-emerald-500 text-[var(--foreground)]"
                            />
                            <span className="text-xs text-[var(--muted-foreground)]">min</span>
                            <div className="flex-1" />
                            <button
                                onClick={addGoal}
                                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-medium hover:bg-emerald-500/30"
                            >
                                Add
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Goals List */}
            <div className="space-y-3">
                {goals.length === 0 && !isAdding && (
                    <div className="text-center py-4 text-[var(--muted-foreground)] text-xs">
                        No goals set. Click + to add one.
                    </div>
                )}
                {goals.map(goal => {
                    const progress = getProgress(goal);
                    const isComplete = progress >= 100;

                    return (
                        <div key={goal.id} className="relative group">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-bold font-display flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                        {isComplete ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Target size={12} className="text-[var(--muted-foreground)]" />}
                                        <AppIcon processName={goal.appName} size={14} />
                                    </div>
                                    {formatAppName(goal.appName)}
                                </span>

                                <span className="text-xs text-[var(--muted-foreground)]">{goal.targetMinutes}m</span>
                            </div>

                            <div className="w-full bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                                <motion.div
                                    className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                />
                            </div>

                            <button
                                onClick={() => removeGoal(goal.id)}
                                className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 p-1 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/30 transition-all translate-x-full"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
};
