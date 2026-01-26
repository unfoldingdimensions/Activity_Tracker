import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { motion } from 'framer-motion';


export type TimeRange =
    | 'past_hour'
    | 'past_6h'
    | 'past_12h'
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'this_month';

interface TimeRangeFilterProps {
    value: TimeRange;
    onChange: (value: TimeRange) => void;
}

const RANGES: { value: TimeRange; label: string; icon: React.ReactNode }[] = [
    { value: 'past_hour', label: 'Past Hour', icon: <Clock className="w-4 h-4" /> },
    { value: 'past_6h', label: '6h', icon: <Clock className="w-4 h-4" /> },
    { value: 'past_12h', label: '12h', icon: <Clock className="w-4 h-4" /> },
    { value: 'today', label: 'Today', icon: <Calendar className="w-4 h-4" /> },
    { value: 'yesterday', label: 'Yesterday', icon: <Calendar className="w-4 h-4" /> },
    { value: 'this_week', label: 'Week', icon: <Calendar className="w-4 h-4" /> },
    { value: 'this_month', label: 'Month', icon: <Calendar className="w-4 h-4" /> },
];

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-secondary/30 border border-border/40 backdrop-blur-md">
            {RANGES.map((range) => {
                const isActive = value === range.value;
                return (
                    <button
                        key={range.value}
                        onClick={() => onChange(range.value)}
                        className={`
                            relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-300 btn-press
                            ${isActive
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                            }
                        `}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeRange"
                                className="absolute inset-0 bg-primary rounded-full -z-10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className={`${isActive ? 'opacity-100 scale-110' : 'opacity-60 scale-90'} transition-transform`}>
                            {range.icon}
                        </span>
                        <span>{range.label}</span>
                        {isActive && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-1 h-1 rounded-full bg-current opacity-80"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};


