/**
 * PageHeader - page title + mono meta line + right-side actions.
 * Flat: solid sticky header, 34px title. Glass: blurred sticky header.
 */

import type { ReactNode } from 'react';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { useReadingMode } from '../../hooks/useReadingMode';
import { cn } from '../../utils/cn';

export interface PageHeaderProps {
    /** Page title */
    title: string;
    /** Mono meta line: "Tue 5 Aug · 03:31 · PAST HOUR | UPDATED 4s AGO" */
    meta?: ReactNode;
    /** Legacy subtitle; rendered as the mono meta line in flat mode */
    subtitle?: string;
    /** Optional action elements (buttons, counters) to display on the right */
    actions?: ReactNode;
    /** Optional back button or left-side action */
    leftAction?: ReactNode;
    /** Optional max width for centering, e.g. "max-w-4xl" */
    maxWidth?: string;
}

export function PageHeader({ title, meta, subtitle, actions, leftAction, maxWidth }: PageHeaderProps) {
    const theme = useVisualTheme();
    const { editorial } = useReadingMode();
    const metaLine = meta ?? subtitle;

    if (theme === 'flat') {
        return (
            <div className="sticky top-0 z-20 bg-[var(--background)] px-8 pt-[26px] pb-[18px] border-b border-[var(--border)]">
                <div
                    className={cn(
                        'flex justify-between items-end gap-6',
                        maxWidth ? `${maxWidth} mx-auto w-full` : ''
                    )}
                >
                    <div className="flex items-end gap-3">
                        {leftAction}
                        <div>
                            <h2
                                className={cn(
                                    'font-bold tracking-[-0.035em] leading-none text-[var(--foreground)]',
                                    editorial
                                        ? 'font-serif italic tracking-[-0.01em] text-[42px]'
                                        : 'font-display text-[34px]'
                                )}
                            >
                                {title}
                            </h2>
                            {metaLine && (
                                <div
                                    className={cn(
                                        'mt-[9px]',
                                        editorial
                                            ? 'font-serif italic text-[15px] text-[var(--muted-foreground)]'
                                            : 'font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]'
                                    )}
                                >
                                    {metaLine}
                                </div>
                            )}
                        </div>
                    </div>
                    {actions && <div className="flex items-center gap-5">{actions}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-6 border-b border-[var(--border)]/50 transition-all">
            <div className={cn('flex justify-between items-center', maxWidth ? `${maxWidth} mx-auto w-full` : '')}>
                <div className="flex items-center gap-3">
                    {leftAction}
                    <div>
                        <h2
                            className={cn(
                                'font-bold text-[var(--foreground)]',
                                editorial ? 'font-serif italic text-4xl' : 'font-display text-3xl'
                            )}
                        >{title}</h2>
                        {metaLine && (
                            <p className="text-[var(--muted-foreground)] mt-1">{metaLine}</p>
                        )}
                        {subtitle && meta && (
                            <p className="text-[var(--muted-foreground)]/80 text-sm mt-0.5">{subtitle}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
        </div>
    );
}
