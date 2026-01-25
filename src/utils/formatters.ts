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
 * Strip .exe extension from process names
 * @param processName Process name potentially with .exe
 * @returns Clean process name
 */
export function cleanProcessName(processName: string): string {
    return processName.replace(/\.exe$/i, '');
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
