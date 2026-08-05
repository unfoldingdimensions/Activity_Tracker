import { cn } from '../../utils/cn';

interface MetricValueProps {
    value: string | number;
    unit?: string;
    /** css color for the digits (e.g. 'var(--accent-focus)') */
    color?: string;
    size?: 'metric' | 'sub';
    className?: string;
}

/**
 * Primary KPI number. Metric = 46px tabular, sub = 28px. Unit suffixes are
 * visibly subordinate (24px / muted).
 */
export function MetricValue({ value, unit, color, size = 'metric', className }: MetricValueProps) {
    return (
        <span
            className={cn(size === 'metric' ? 'metric-value' : 'sub-metric', className)}
            style={color ? { color } : undefined}
        >
            {value}
            {unit && (
                <span className={size === 'metric' ? 'metric-unit' : 'text-base font-medium text-[var(--muted-foreground)]'}>
                    {unit}
                </span>
            )}
        </span>
    );
}
