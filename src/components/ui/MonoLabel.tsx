import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** Mono 9.5px uppercase tracked label (the flat system's caption voice). */
export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={cn('label-mono', className)}>{children}</span>;
}
