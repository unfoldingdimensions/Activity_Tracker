/**
 * StatCard - Reusable stat card component for dashboard metrics
 * Extracted from Dashboard.tsx for reusability and SRP
 */

import type { LucideIcon } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Skeleton } from '../ui/Skeleton';

export interface StatCardProps {
    /** Display label for the stat */
    label: string;
    /** String value for display (used for Screen Time format) */
    value: string;
    /** Numeric value for AnimatedNumber component */
    numericValue: number;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Subtitle/change indicator text */
    subtitle?: string;
    /** Whether the card is in loading state */
    isLoading?: boolean;
    /** Whether the card is clickable */
    clickable?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Suffix to append after numeric value (e.g., '%') */
    suffix?: string;
    /** If true, display the string value instead of AnimatedNumber */
    useStringValue?: boolean;
}

export function StatCard({
    label,
    value,
    numericValue,
    icon: Icon,
    subtitle,
    isLoading = false,
    clickable = false,
    onClick,
    suffix,
    useStringValue = false,
}: StatCardProps) {
    return (
        <GlassCard
            className={`p-5 group relative overflow-hidden ${clickable
                    ? 'cursor-pointer hover:border-[var(--foreground)]/20 active:scale-95 transition-all'
                    : ''
                }`}
            spotlight
            onClick={clickable ? onClick : undefined}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
                    <div className="text-2xl font-bold font-display mt-1 text-[var(--foreground)]">
                        {isLoading ? (
                            <Skeleton variant="text" className="h-8 w-24" />
                        ) : useStringValue ? (
                            value
                        ) : (
                            <div className="flex items-center">
                                <AnimatedNumber value={numericValue} />
                                {suffix}
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-2 rounded-lg bg-[var(--secondary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                    <Icon size={20} className="text-[var(--foreground)]" />
                </div>
            </div>
            {subtitle && (
                <p className="text-xs mt-3 font-medium text-[var(--muted-foreground)]">
                    {subtitle}
                </p>
            )}
        </GlassCard>
    );
}
