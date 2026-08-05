import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { renderWithClient } from '../utils';
import { Dashboard } from '../../pages/Dashboard';
import { BrowserRouter } from 'react-router-dom';

// 1. Mock dependencies BEFORE imports
vi.mock('recharts', async () => {
    const Original = await vi.importActual('recharts');
    return {
        ...Original,
        ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div style={{ width: 800, height: 600 }}>{children}</div>,
    };
});

vi.mock('../../utils/isTauri', () => ({
    isTauri: () => false,
}));

// Mock chart components
vi.mock('../../components/dashboard/FocusFlowChart', () => ({
    FocusFlowChart: ({ data }: { data?: unknown[] }) => <div data-testid="focus-flow-chart">Focus Flow: {data?.length || 0} items</div>,
}));

vi.mock('../../components/dashboard/AppUsageChart', () => ({
    AppUsageChart: ({ data }: { data?: unknown[] }) => <div data-testid="app-usage-chart">App Usage: {data?.length || 0} items</div>,
}));

// Mock feature components
vi.mock('../../components/InputHistoryModal', () => ({ InputHistoryModal: () => <div /> }));
vi.mock('../../components/gamification/LevelSystem', () => ({ LevelSystem: () => <div /> }));
vi.mock('../../components/gamification/StreakCounter', () => ({ StreakCounter: () => <div /> }));
vi.mock('../../components/gamification/Achievements', () => ({ Achievements: () => <div /> }));
vi.mock('../../components/insights/FlowStateMetrics', () => ({ FlowStateMetrics: () => <div /> }));
vi.mock('../../components/insights/WorkPatterns', () => ({ WorkPatterns: () => <div /> }));
vi.mock('../../components/wellbeing/BreathingWidget', () => ({ BreathingWidget: () => <div /> }));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('../../components/ui/AnimatedNumber', () => ({
    AnimatedNumber: ({ value }: { value: number }) => <span>{value}</span>,
}));

// MOCK QUERIES MODULE
const defaultRes = { data: [], isLoading: false };
const mocks = {
    useDailyStats: vi.fn().mockReturnValue({ data: {}, isLoading: false }),
    useTimelineEventsRange: vi.fn().mockReturnValue(defaultRes),
    useTimeline: vi.fn().mockReturnValue(defaultRes),
    useInputHistory: vi.fn().mockReturnValue(defaultRes),
    useAppUsage: vi.fn().mockReturnValue(defaultRes),
    useAppUsageRange: vi.fn().mockReturnValue(defaultRes),
    useStatsRange: vi.fn().mockReturnValue({ data: null, isLoading: false })
};

vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => ({
        settings: {
            dashboardDefaultRange: 'today',
            trackWindowTitles: true,
            idleThreshold: 60,
            blacklistedApps: [],
            retentionDays: 90,
            launchOnStartup: false,
            startMinimized: false,
            redactedKeywords: [],
            appLimits: {},
            appClassification: {}
        },
        updateSettings: vi.fn()
    })
}));

vi.mock('../../hooks/queries', () => ({
    useDailyStats: (...args: never[]) => mocks.useDailyStats(...args),
    useTimelineEventsRange: (...args: never[]) => mocks.useTimelineEventsRange(...args),
    useTimeline: (...args: never[]) => mocks.useTimeline(...args),
    useInputHistory: (...args: never[]) => mocks.useInputHistory(...args),
    useAppUsage: (...args: never[]) => mocks.useAppUsage(...args),
    useAppUsageRange: (...args: never[]) => mocks.useAppUsageRange(...args),
    useStatsRange: (...args: never[]) => mocks.useStatsRange(...args),
}));

describe('Dashboard Filters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default safe returns
        mocks.useDailyStats.mockReturnValue({ data: {}, isLoading: false });
        mocks.useTimelineEventsRange.mockReturnValue({ data: [], isLoading: false });
        mocks.useTimeline.mockReturnValue({ data: [], isLoading: false });
        mocks.useInputHistory.mockReturnValue({ data: [], isLoading: false });
        mocks.useAppUsage.mockReturnValue({ data: [], isLoading: false });
        mocks.useAppUsageRange.mockReturnValue({ data: [], isLoading: false });
        mocks.useStatsRange.mockReturnValue({
            data: {
                total_active_seconds: 3600,
                total_idle_seconds: 0,
                total_keystrokes: 1000,
                total_mouse_clicks: 500
            }, isLoading: false
        });
    });

    it('toggles time range and updates data', async () => {
        // Setup data
        mocks.useDailyStats.mockReturnValue({
            data: { total_active_seconds: 3600 },
            isLoading: false
        });

        // Mock range events needed for Focus Chart
        mocks.useTimelineEventsRange.mockReturnValue({
            data: [{
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                process_name: 'Code',
                duration_seconds: 3600
            }],
            isLoading: false
        });

        renderWithClient(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        // check default (today)
        expect(screen.getByText('Today')).toBeInTheDocument();
        // Check "30m" overlap text from StatCard or similar if present, 
        // OR just check focus flow chart presence
        await waitFor(() => expect(screen.getByTestId('focus-flow-chart')).toBeInTheDocument());

        expect(mocks.useTimelineEventsRange).toHaveBeenCalled(); // Should be called for today now

        // Switch to Week via the inline tab filter (no dropdown)
        const weekButton = screen.getByRole('button', { name: /week/i });
        fireEvent.click(weekButton);

        await waitFor(() => {
            expect(screen.getByText('Week')).toBeInTheDocument();
        });

        // Verify the range hook was called again with the new range
        expect(mocks.useTimelineEventsRange).toHaveBeenCalledTimes(2); // Once initial, once update
    });

    it('renders today chart with range events', async () => {
        mocks.useDailyStats.mockReturnValue({
            data: { total_active_seconds: 3600 },
            isLoading: false
        });

        mocks.useTimelineEventsRange.mockReturnValue({
            data: [{
                timestamp: new Date().toISOString(),
                process_name: 'Code',
                duration_seconds: 60
            }],
            isLoading: false
        });

        renderWithClient(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        // Expect hook called with correct args
        expect(mocks.useTimelineEventsRange).toHaveBeenCalledWith(expect.any(String), expect.any(String), true);

        // Expect chart
        await waitFor(() => {
            expect(screen.getByTestId('focus-flow-chart')).toBeInTheDocument();
            expect(screen.getByTestId('app-usage-chart')).toBeInTheDocument();
        });
    });
});
