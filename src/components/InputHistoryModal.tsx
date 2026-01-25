import { useState, useMemo } from 'react';
import { GlassCard } from './GlassCard';
import { X } from 'lucide-react';
import { useInputHistory } from '../hooks/useTrackerData';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';

interface InputHistoryModalProps {
    onClose: () => void;
}

export function InputHistoryModal({ onClose }: InputHistoryModalProps) {
    const [interval, setInterval] = useState(60); // Default 1 hour
    const [metric, setMetric] = useState<'keystrokes' | 'clicks'>('keystrokes');
    const { data: history, isLoading } = useInputHistory(interval, true);
    const filteredHistory = useMemo(() => {
        if (!history) return [];
        // Assuming backend returns 24h of data for any interval
        if (interval === 10) return history.slice(-18); // Last 3 hours (18 * 10min)
        if (interval === 30) return history.slice(-12); // Last 6 hours (12 * 30min)
        return history; // Last 24 hours
    }, [history, interval]);

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
                            Keystrokes and mouse clicks over time
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
                <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-start sm:items-center">
                    {/* Interval Toggle */}
                    <div className="flex gap-2 bg-[var(--surface)] p-1 rounded-full border border-[var(--border)]">
                        {[10, 30, 60].map((m) => (
                            <button
                                key={m}
                                onClick={() => setInterval(m)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${interval === m
                                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]'
                                    }`}
                            >
                                {m === 60 ? '1h' : `${m}m`}
                            </button>
                        ))}
                    </div>

                    {/* Metric Toggle */}
                    <div className="flex gap-2 bg-[var(--surface)] p-1 rounded-full border border-[var(--border)]">
                        {(['keystrokes', 'clicks'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMetric(m)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all duration-200 ${metric === m
                                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
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
                            <BarChart data={filteredHistory} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                                <XAxis
                                    dataKey="time"
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={true}
                                    axisLine={true}
                                    interval={filteredHistory.length > 20 ? 'preserveStartEnd' : 0}
                                    tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    style={{ fontFamily: 'var(--font-body)' }}
                                />
                                <YAxis
                                    stroke="var(--muted-foreground)"
                                    fontSize={12}
                                    tickLine={true}
                                    axisLine={true}
                                    style={{ fontFamily: 'var(--font-body)' }}
                                />
                                <Tooltip
                                    labelFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--foreground)',
                                        boxShadow: 'var(--shadow-swiss)',
                                    }}
                                    cursor={{ fill: 'var(--secondary)', opacity: 0.5 }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    formatter={(value) => <span style={{ fontFamily: 'var(--font-body)' }}>{value}</span>}
                                />
                                {metric === 'keystrokes' && (
                                    <Bar
                                        dataKey="keystrokes"
                                        name="Keystrokes"
                                        fill="#0f766e"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={50}
                                        animationDuration={1000}
                                    />
                                )}
                                {metric === 'clicks' && (
                                    <Bar
                                        dataKey="mouse_clicks"
                                        name="Clicks"
                                        fill="#7c3aed"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={50}
                                        animationDuration={1000}
                                    />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </GlassCard >
        </div >
    );
}
