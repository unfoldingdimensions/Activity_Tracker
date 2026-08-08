import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** a11y label */
    label?: string;
    className?: string;
}

/**
 * Switch. Flat: 34x16 with a square 14x12 block justified end/start.
 * Glass: rounded 44x24 with a circular thumb.
 */
export function Toggle({ checked, onChange, label, className }: ToggleProps) {
    const theme = useVisualTheme();

    if (theme === 'flat') {
        return (
            <button
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={cn(
                    'flex w-[34px] h-4 p-px border transition-[justify-content] duration-150',
                    checked ? 'justify-end border-[var(--toggle-on)]' : 'justify-start border-[var(--border)]',
                    className
                )}
            >
                <span
                    className={cn('w-[14px] h-3', checked ? 'bg-[var(--toggle-on)]' : 'bg-[var(--border)]')}
                />
            </button>
        );
    }

    return (
        <button
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-150',
                checked ? 'bg-[var(--toggle-on)]' : 'bg-[var(--muted)]',
                className
            )}
        >
            <span
                className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full transition-all duration-150',
                    checked ? 'left-[22px] bg-[var(--toggle-thumb-on)]' : 'left-0.5 bg-[var(--toggle-thumb-off)]'
                )}
            />
        </button>
    );
}
