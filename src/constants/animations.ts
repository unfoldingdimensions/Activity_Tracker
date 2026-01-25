/**
 * Shared Framer Motion animation variants
 * Centralizes animation definitions to eliminate DRY violations
 */

import type { Variants } from 'framer-motion';

/**
 * Standard container variant for staggered children
 * Use on parent elements that contain multiple animated items
 */
export const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

/**
 * Fast container variant with quicker stagger
 * Use for lists with many items
 */
export const containerVariantsFast: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

/**
 * Standard item variant - fade in with upward motion
 * Use on children of containerVariants
 */
export const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

/**
 * Subtle item variant with less vertical motion
 * Use for tighter spacing layouts
 */
export const itemVariantsSubtle: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
};

/**
 * Fade in from left - for headers and titles
 */
export const fadeInLeft: Variants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
};

/**
 * Fade in from right
 */
export const fadeInRight: Variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
};

/**
 * Scale up fade - for modals and overlays
 */
export const scaleUp: Variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
};

/**
 * Page transition variant
 * Used by Layout for route transitions
 */
export const pageTransition: Variants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
};

/**
 * Transition presets
 */
export const transitions = {
    /** Fast transitions (150ms) */
    fast: { duration: 0.15 },
    /** Standard transitions (300ms) */
    default: { duration: 0.3 },
    /** Slow transitions (500ms) */
    slow: { duration: 0.5 },
    /** Spring for bouncy interactions */
    spring: { type: 'spring', stiffness: 300, damping: 30 },
} as const;
