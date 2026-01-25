import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../utils/cn';

export type TimeRange = 'today' | 'yesterday' | 'past_1h' | 'past_6h' | 'past_12h' | 'week' | 'month';

interface TimeRangeFilterProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
    disabled?: boolean;
}

const RANGES: { id: TimeRange; label: string; icon?: React.ElementType }[] = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'yesterday', label: 'Yesterday', icon: Calendar },
    { id: 'past_1h', label: 'Past Hour', icon: Clock },
    { id: 'past_6h', label: 'Past 6 Hours', icon: Clock },
    { id: 'past_12h', label: 'Past 12 Hours', icon: Clock },
    { id: 'week', label: 'This Week', icon: Calendar },
    { id: 'month', label: 'This Month', icon: Calendar },
];

export function TimeRangeFilter({ value, onChange, disabled }: TimeRangeFilterProps) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedRange = RANGES.find(r => r.id === value) || RANGES[0];

    return (
        <div className="relative">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                    "bg-[var(--card)] border-[var(--border)] text-[var(--foreground)]",
                    "hover:border-[var(--primary)] hover:text-[var(--primary)]",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                {selectedRange.icon && <selectedRange.icon className="w-4 h-4" />}
                <span>{selectedRange.label}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-48 z-50 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden py-1"
                    >
                        {RANGES.map((range) => {
                            const Icon = range.icon || Calendar;
                            const isSelected = value === range.id;

                            return (
                                <button
                                    key={range.id}
                                    onClick={() => {
                                        onChange(range.id);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                                        isSelected
                                            ? "bg-[var(--primary)] text-white"
                                            : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                                    )}
                                >
                                    <Icon className="w-4 h-4 opacity-70" />
                                    {range.label}
                                </button>
                            );
                        })}
                    </motion.div>
                </>
            )}
        </div>
    );
}
