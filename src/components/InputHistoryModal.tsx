import { useState } from 'react';
import { GlassCard } from './GlassCard';
import { X } from 'lucide-react';
import { useInputHistory } from '../hooks/useTrackerData';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface InputHistoryModalProps {
    onClose: () => void;
}

export function InputHistoryModal({ onClose }: InputHistoryModalProps) {
    const [interval, setInterval] = useState(60); // Default 1 hour
    const { data: history, isLoading } = useInputHistory(interval, true);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            <GlassCard className="w-full max-w-4xl h-[600px] p-6 relative flex flex-col" hover={false}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="font-display text-2xl font-bold text-[var(--foreground)]">
                            Input Activity History
                        </h2>
                        <p className="text-sm text-[var(--muted-foreground)]">
                            Keystrokes and mouse clicks over the last 24 hours
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--secondary)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] z-10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Controls */}
                <div className="flex gap-2 mb-6">
                    {[10, 30, 60].map((m) => (
                        <button
                            key={m}
                            onClick={() => setInterval(m)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${interval === m
                                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-lg scale-105'
                                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)]'
                                }`}
                        >
                            {m === 60 ? '1 Hour' : `${m} Mins`}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-0 w-full">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] flex-col gap-2">
                            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                            <span>Loading history...</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={history || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="time"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={history ? Math.floor(history.length / 8) : 0}
                                />
                                <YAxis
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-swiss)',
                                    }}
                                    cursor={{ fill: 'var(--secondary)', opacity: 0.5 }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    dataKey="keystrokes"
                                    name="Keystrokes"
                                    fill="#0f766e"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                                <Bar
                                    dataKey="mouse_clicks"
                                    name="Clicks"
                                    fill="#7c3aed"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
