/**
 * Centralized color palette for charts and visualizations
 * Follows the Glassmorphism design system
 */

/** Primary chart color palette for pie/bar charts */
export const CHART_COLORS = [
    '#1c1917', // Zinc 900
    '#a16207', // Amber 700
    '#0f766e', // Teal 700
    '#7c3aed', // Violet 600
    '#78716c', // Stone 500
    '#be185d', // Pink 700
    '#0369a1', // Sky 700
    '#15803d', // Green 700
] as const;

/** Flow state colors for Focus Flow chart */
export const FLOW_COLORS = {
    focus: '#0f766e',        // Teal 700 - Deep focus
    distraction: '#a16207',  // Amber 700 - Distractions/idle
} as const;

/** Gradient definitions for Area charts */
export const GRADIENT_COLORS = {
    emerald: {
        start: '#10b981',  // Emerald 500
        end: 'transparent',
    },
    amber: {
        start: '#f59e0b',  // Amber 500
        end: 'transparent',
    },
    teal: {
        start: '#14b8a6',  // Teal 500
        end: 'transparent',
    },
} as const;

/**
 * Get flow state color based on score
 * @param score Flow score (0-100)
 * @returns Hex color string
 */
export function getFlowColor(score: number): string {
    if (score >= 80) return '#10b981'; // Emerald 500 - Excellent
    if (score >= 60) return '#3b82f6'; // Blue 500 - Good
    if (score >= 40) return '#f59e0b'; // Amber 500 - Fair
    return '#ef4444';                   // Red 500 - Poor
}

/**
 * Get flow state label based on score
 * @param score Flow score (0-100)
 * @returns Human readable label
 */
export function getFlowLabel(score: number): string {
    if (score >= 80) return 'Deep Focus';
    if (score >= 60) return 'Focused';
    if (score >= 40) return 'Distracted';
    return 'Very Distracted';
}

/** Status indicator colors */
export const STATUS_COLORS = {
    active: '#10b981',    // Emerald 500
    idle: '#78716c',      // Stone 500
    warning: '#f59e0b',   // Amber 500
    error: '#ef4444',     // Red 500
} as const;

/** Achievement tier colors */
export const TIER_COLORS = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
} as const;
