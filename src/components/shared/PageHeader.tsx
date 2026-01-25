/**
 * PageHeader - Reusable sticky page header component
 * Provides consistent header styling across all pages
 */

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
    /** Page title */
    title: string;
    /** Optional subtitle/description */
    subtitle?: string;
    /** Optional action elements (buttons, counters) to display on the right */
    actions?: ReactNode;
    /** Optional back button or left-side action */
    leftAction?: ReactNode;
}

export function PageHeader({
    title,
    subtitle,
    actions,
    leftAction,
}: PageHeaderProps) {
    return (
        <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-6 border-b border-[var(--border)]/50 transition-all">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-between items-center"
            >
                <div className="flex items-center gap-3">
                    {leftAction}
                    <div>
                        <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-[var(--muted-foreground)] mt-1">{subtitle}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </motion.div>
        </div>
    );
}
