import React from 'react';
import { Calendar, Clock } from 'lucide-react';

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
    { value: 'past_6h', label: '6 Hours', icon: <Clock className="w-4 h-4" /> },
    { value: 'past_12h', label: '12 Hours', icon: <Clock className="w-4 h-4" /> },
    { value: 'today', label: 'Today', icon: <Calendar className="w-4 h-4" /> },
    { value: 'yesterday', label: 'Yesterday', icon: <Calendar className="w-4 h-4" /> },
    { value: 'this_week', label: 'This Week', icon: <Calendar className="w-4 h-4" /> },
    { value: 'this_month', label: 'This Month', icon: <Calendar className="w-4 h-4" /> },
];

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({ value, onChange }) => {
    return (
        <div className="flex flex-wrap gap-2 mb-8">
            {RANGES.map((range) => (
                <button
                    key={range.value}
                    onClick={() => onChange(range.value)}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press
                        ${value === range.value
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/10'
                            : 'bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                        }
                    `}
                >
                    {range.icon}
                    {range.label}
                </button>
            ))}
        </div>
    );
};
