import { cn } from '../../utils/cn';

/** 1px hairline rule. */
export function Rule({ className }: { className?: string }) {
    return <div className={cn('h-px bg-[var(--border)]', className)} />;
}
