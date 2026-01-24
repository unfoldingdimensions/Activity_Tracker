import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
    return (
        <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{
                repeat: Infinity,
                repeatType: 'reverse',
                duration: 1,
                ease: 'easeInOut',
            }}
            className={cn(
                'bg-[var(--muted)]/50',
                {
                    'rounded-md': variant === 'text',
                    'rounded-full': variant === 'circular',
                    'rounded-xl': variant === 'rectangular',
                },
                className
            )}
        />
    );
}
