import React, { useEffect } from 'react';
import { SegTabs } from '../ui/SegTabs';

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

// Six visible ranges per the new design; 'yesterday' stays available to
// the internal digest logic but is not a tab.
const RANGES: { value: TimeRange; label: string }[] = [
    { value: 'past_hour', label: 'Hour' },
    { value: 'past_6h', label: '6h' },
    { value: 'past_12h', label: '12h' },
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'Week' },
    { value: 'this_month', label: 'Month' },
];

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({ value, onChange }) => {
    // Keyboard shortcuts 1-6 switch the active range
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
            if (idx >= 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                onChange(RANGES[idx].value);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onChange]);

    return <SegTabs options={RANGES} value={value} onChange={onChange} />;
};
