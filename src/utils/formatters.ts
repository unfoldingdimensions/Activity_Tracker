/**
 * Shared formatting utilities
 * Consolidates formatting functions from api/tauri.ts and hooks
 */

/**
 * Format seconds as human-readable duration
 * @param seconds Total seconds
 * @returns Formatted string like "2h 30m" or "45s"
 * 
 * @example
 * formatDuration(3661) // "1h 1m"
 * formatDuration(120)  // "2m"
 * formatDuration(45)   // "45s"
 */
export function formatDuration(seconds: number): string {
    if (seconds < 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${secs}s`;
}

/**
 * Format a number with locale-aware thousand separators
 * @param num Number to format
 * @returns Formatted string like "12,493"
 * 
 * @example
 * formatNumber(12493) // "12,493"
 */
export function formatNumber(num: number): string {
    return num.toLocaleString('en-US');
}

/**
 * Format a decimal as percentage
 * @param value Decimal value (0-1) or percentage (0-100)
 * @param isDecimal Whether input is decimal (default: false, assumes 0-100)
 * @returns Formatted percentage string like "75%"
 * 
 * @example
 * formatPercentage(75)        // "75%"
 * formatPercentage(0.75, true) // "75%"
 */
export function formatPercentage(value: number, isDecimal = false): string {
    const percentage = isDecimal ? value * 100 : value;
    return `${Math.round(percentage)}%`;
}

/**
 * Format bytes as human-readable file size
 * @param bytes Number of bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * @param date Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

/**
 * Truncate text with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Strip .exe extension and capitalize words
 * @param processName Process name
 * @returns Formatted name
 */
export function formatAppName(processName: string): string {
    const withoutExe = processName.replace(/\.exe$/i, '');
    // Capitalize each word and handle some common app names
    return withoutExe
        .split(/[._\-\s]+/)
        .map(word => {
            if (word.length === 0) return '';
            // Handle common acronyms
            const upper = word.toUpperCase();
            if (['VSCODE', 'IDE', 'UI', 'UX', 'SQL'].includes(upper)) return upper;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

/**
 * Format time of day from ISO string
 * @param isoString ISO date string
 * @returns Time string like "14:30"
 */
export function formatTimeOfDay(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a Date as a local calendar date (YYYY-MM-DD).
 * Unlike `date.toISOString().split('T')[0]`, this uses the machine's LOCAL timezone,
 * which is what the backend uses to key `app_usage` rows.
 * @param date Date to format
 * @returns Local date string like "2024-08-03"
 */
export function toLocalDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Approximate cursor travel distance from raw pixel counts.
 * Assumes standard 96 DPI Windows scaling (96 px ≈ 1 inch ≈ 0.0254 m).
 * @param pixels Total cursor travel in screen pixels
 * @returns Human-readable distance like "265 m" or "1.3 km"
 */
export function formatDistance(pixels: number): string {
    const pxPerMeter = 96 / 0.0254; // pixels per metre at 96 DPI
    const meters = Math.max(0, pixels) / pxPerMeter;

    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
}

/**
 * Derive level and progress-to-next-level from total XP.
 * Mirrors the backend level curve: level = floor(sqrt(xp / 100)) + 1
 * (level N requires 100*(N-1)^2 XP, next level at 100*N^2).
 * @param totalXp Total XP accumulated
 * @returns The current level and progress (0-100) toward the next one
 */
export function getLevelInfo(totalXp: number): { level: number; progress: number } {
    const safeXp = Math.max(0, Math.floor(totalXp));
    const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;
    const n = level - 1;
    const currentBase = 100 * n * n;
    const nextBase = 100 * (n + 1) * (n + 1);
    const progress = nextBase > currentBase
        ? Math.max(0, Math.min(100, ((safeXp - currentBase) / (nextBase - currentBase)) * 100))
        : 100;
    return { level, progress };
}
