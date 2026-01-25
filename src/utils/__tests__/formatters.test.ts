
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
    formatDuration,
    formatNumber,
    formatPercentage,
    formatBytes,
    truncateText,
    cleanProcessName,
    formatRelativeTime,
    formatTimeOfDay
} from '../formatters';

describe('formatters', () => {
    describe('formatDuration', () => {
        it('formats seconds correctly', () => {
            expect(formatDuration(45)).toBe('45s');
            expect(formatDuration(0)).toBe('0s');
        });

        it('formats minutes correctly', () => {
            expect(formatDuration(120)).toBe('2m');
            expect(formatDuration(150)).toBe('2m'); // Rounds down/simple display
        });

        it('formats hours correctly', () => {
            expect(formatDuration(3600)).toBe('1h');
            expect(formatDuration(3660)).toBe('1h 1m');
            expect(formatDuration(7320)).toBe('2h 2m');
        });

        it('handles negative numbers', () => {
            expect(formatDuration(-10)).toBe('0s');
        });
    });

    describe('formatNumber', () => {
        it('formats numbers with commas', () => {
            expect(formatNumber(100)).toBe('100');
            expect(formatNumber(1000)).toBe('1,000');
            expect(formatNumber(1234567)).toBe('1,234,567');
        });
    });

    describe('formatPercentage', () => {
        it('formats predefined percentage (0-100)', () => {
            expect(formatPercentage(50)).toBe('50%');
            expect(formatPercentage(100)).toBe('100%');
            expect(formatPercentage(0)).toBe('0%');
        });

        it('formats decimal value (0-1) when isDecimal is true', () => {
            expect(formatPercentage(0.5, true)).toBe('50%');
            expect(formatPercentage(0.123, true)).toBe('12%');
            expect(formatPercentage(1, true)).toBe('100%');
        });
    });

    describe('formatBytes', () => {
        it('formats bytes', () => {
            expect(formatBytes(0)).toBe('0 Bytes');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1536)).toBe('1.5 KB'); // 1.5 * 1024
            expect(formatBytes(1048576)).toBe('1 MB');
            expect(formatBytes(1073741824)).toBe('1 GB');
        });
    });

    describe('truncateText', () => {
        it('truncates text correctly', () => {
            expect(truncateText('Hello World', 5)).toBe('He...');
            expect(truncateText('Hello', 10)).toBe('Hello');
            expect(truncateText('Test', 4)).toBe('Test');
        });
    });

    describe('cleanProcessName', () => {
        it('removes .exe extension', () => {
            expect(cleanProcessName('chrome.exe')).toBe('chrome');
            expect(cleanProcessName('Code.exe')).toBe('Code');
            expect(cleanProcessName('app')).toBe('app');
        });

        it('is case insensitive for extension', () => {
            expect(cleanProcessName('Game.EXE')).toBe('Game');
        });
    });

    describe('formatRelativeTime', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('formats "just now"', () => {
            const now = new Date('2024-01-01T12:00:00');
            vi.setSystemTime(now);
            expect(formatRelativeTime(new Date('2024-01-01T11:59:40'))).toBe('just now');
        });

        it('formats minutes ago', () => {
            const now = new Date('2024-01-01T12:00:00');
            vi.setSystemTime(now);
            expect(formatRelativeTime(new Date('2024-01-01T11:55:00'))).toBe('5m ago');
        });

        it('formats hours ago', () => {
            const now = new Date('2024-01-01T15:00:00');
            vi.setSystemTime(now);
            expect(formatRelativeTime(new Date('2024-01-01T12:00:00'))).toBe('3h ago');
        });

        it('formats days ago', () => {
            const now = new Date('2024-01-05T12:00:00');
            vi.setSystemTime(now);
            expect(formatRelativeTime(new Date('2024-01-01T12:00:00'))).toBe('4d ago');
        });

        it('formats full date for older items', () => {
            const now = new Date('2024-02-01T12:00:00');
            vi.setSystemTime(now);
            // Returns locale date string, which might vary by environment. 
            // In test environment (Node/Vitest default locale), it's often M/D/YYYY
            const date = new Date('2024-01-01T12:00:00');
            expect(formatRelativeTime(date)).toBe(date.toLocaleDateString());
        });
    });

    describe('formatTimeOfDay', () => {
        it('formats time from ISO string', () => {
            // We need to handle locale differences or mock ToLocaleTimeString
            // For simplicity, we check if it returns a string containing expected parts or match a regex
            const iso = '2024-01-01T14:30:00';
            const result = formatTimeOfDay(iso);
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });
    });
});
