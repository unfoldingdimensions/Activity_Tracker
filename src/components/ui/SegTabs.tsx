import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface SegTabsProps<T extends string> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

/**
 * Segmented tabs. Flat: mono uppercase with a 1.5px underline on the
 * active tab. Glass: pill buttons on a secondary track.
 */
export function SegTabs<T extends string>({ options, value, onChange, className }: SegTabsProps<T>) {
    const theme = useVisualTheme();

    if (theme === 'flat') {
        return (
            <div className={cn('flex items-center gap-4 font-mono text-[12px] uppercase tracking-[0.06em]', className)}>
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            'pb-1 border-b-[1.5px] transition-colors',
                            value === opt.value
                                ? 'border-[var(--foreground)] font-bold text-[var(--foreground)]'
                                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className={cn('flex items-center gap-1 p-1 rounded-lg bg-[var(--secondary)] border border-[var(--border)]', className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        value === opt.value
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
