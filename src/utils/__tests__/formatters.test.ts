
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
    formatDuration,
    formatNumber,
    formatPercentage,
    formatBytes,
    truncateText,
    formatAppName,
    formatRelativeTime,
    formatTimeOfDay,
    toLocalDateString,
    getLevelInfo
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

    describe('formatAppName', () => {
        it('removes .exe extension and capitalizes', () => {
            expect(formatAppName('chrome.exe')).toBe('Chrome');
            expect(formatAppName('Code.exe')).toBe('Code');
            expect(formatAppName('app')).toBe('App');
        });

        it('is case insensitive for extension', () => {
            expect(formatAppName('Game.EXE')).toBe('Game');
        });

        it('handles acronyms correctly', () => {
            expect(formatAppName('vscode.exe')).toBe('VSCODE');
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

    describe('toLocalDateString', () => {
        it('formats a date as a local YYYY-MM-DD string', () => {
            // 2024-08-03 12:00 local
            const date = new Date(2024, 7, 3, 12, 0, 0);
            expect(toLocalDateString(date)).toBe('2024-08-03');
        });

        it('pads single-digit month and day', () => {
            const date = new Date(2024, 0, 5, 0, 0, 0);
            expect(toLocalDateString(date)).toBe('2024-01-05');
        });

        it('does not shift to UTC date for late local times', () => {
            // Late evening local in a UTC+X timezone must NOT roll to the next UTC date
            const date = new Date(2024, 7, 3, 23, 30, 0);
            expect(toLocalDateString(date)).toBe('2024-08-03');
        });
    });

    describe('getLevelInfo', () => {
        it('starts at level 1 with 0 XP', () => {
            expect(getLevelInfo(0)).toEqual({ level: 1, progress: 0 });
        });

        it('treats negative XP as 0', () => {
            expect(getLevelInfo(-10)).toEqual({ level: 1, progress: 0 });
        });

        it('progresses within level 1 toward 100 XP', () => {
            expect(getLevelInfo(50)).toEqual({ level: 1, progress: 50 });
        });

        it('levels up at exactly 100 XP (level 2 requires 100 XP)', () => {
            expect(getLevelInfo(100)).toEqual({ level: 2, progress: 0 });
        });

        it('matches the backend sqrt curve (level 3 at 400 XP)', () => {
            expect(getLevelInfo(399)).toEqual({ level: 2, progress: expect.closeTo(99.666666, 2) });
            expect(getLevelInfo(400)).toEqual({ level: 3, progress: 0 });
            expect(getLevelInfo(900)).toEqual({ level: 4, progress: 0 });
        });
    });
});