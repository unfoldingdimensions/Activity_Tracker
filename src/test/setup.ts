/**
 * Global test setup for Vitest + React Testing Library
 * This file runs before each test file
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Cleanup after each test case (unmount components, reset DOM)
afterEach(() => {
    cleanup();
});

// Mock window.matchMedia (required for components using media queries)
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // Mock ResizeObserver (required for Recharts)
    globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));
});

// Mock Tauri invoke for non-Tauri test environment
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockImplementation((command: string) => {
        // Return mock data based on command
        const mockResponses: Record<string, unknown> = {
            get_active_window: { process_name: 'Code.exe', window_title: 'Test File' },
            get_app_usage: [{ name: 'Code.exe', seconds: 3600 }],
            get_daily_stats: {
                total_active_seconds: 7200,
                total_idle_seconds: 1800,
                total_keystrokes: 5000,
                total_mouse_clicks: 1200,
                total_mouse_distance: 10000,
            },
            get_activity_timeline: [],
            get_recent_events: [],
            get_user_stats: { total_xp: 100, current_level: 1, current_streak: 3, last_activity_date: null },
            get_unlocked_achievements: [],
            get_idle_seconds: 0,
            get_input_history: [],
        };
        return Promise.resolve(mockResponses[command] ?? null);
    }),
}));

// Suppress console errors during tests (optional - uncomment if needed)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
//     originalError.call(console, ...args);
//   };
// });
// afterAll(() => {
//   console.error = originalError;
// });
