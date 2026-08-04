
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { renderWithClient } from '../utils';
import { Dashboard } from '../../pages/Dashboard';
import { BrowserRouter } from 'react-router-dom';

vi.mock('recharts', async () => {
    const Original = await vi.importActual('recharts');
    return {
        ...Original,
        ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div style={{ width: 800, height: 600 }}>{children}</div>,
    };
});

// Mock isTauri to force API path (using setup.ts mocks)
vi.mock('../../utils/isTauri', () => ({
    isTauri: () => true,
}));

// Mock complex chart components to isolate failure
vi.mock('../../components/dashboard/FocusFlowChart', () => ({
    FocusFlowChart: () => <div data-testid="focus-flow-chart">Focus Flow Chart</div>,
}));

vi.mock('../../components/dashboard/AppUsageChart', () => ({
    AppUsageChart: () => <div data-testid="app-usage-chart">App Usage Chart</div>,
}));

// Mock other feature components
vi.mock('../../components/InputHistoryModal', () => ({ InputHistoryModal: () => <div data-testid="mock-input-history-modal">InputHistoryModal</div> }));
vi.mock('../../components/gamification/LevelSystem', () => ({ LevelSystem: () => <div data-testid="mock-level-system">LevelSystem</div> }));
vi.mock('../../components/gamification/StreakCounter', () => ({ StreakCounter: () => <div data-testid="mock-streak-counter">StreakCounter</div> }));
vi.mock('../../components/gamification/Achievements', () => ({ Achievements: () => <div data-testid="mock-achievements">Achievements</div> }));
vi.mock('../../components/insights/FlowStateMetrics', () => ({ FlowStateMetrics: () => <div data-testid="mock-flow-state-metrics">FlowStateMetrics</div> }));
vi.mock('../../components/insights/WorkPatterns', () => ({ WorkPatterns: () => <div data-testid="mock-work-patterns">WorkPatterns</div> }));
vi.mock('../../components/wellbeing/ErgonomicMetrics', () => ({ ErgonomicMetrics: () => <div data-testid="mock-ergonomic-metrics">ErgonomicMetrics</div> }));
vi.mock('../../components/wellbeing/BreathingWidget', () => ({ BreathingWidget: () => <div data-testid="mock-breathing-widget">BreathingWidget</div> }));
vi.mock('../../components/tools/GoalSetter', () => ({ GoalSetter: () => <div data-testid="mock-goal-setter">GoalSetter</div> }));
vi.mock('../../components/tools/PomodoroTimer', () => ({ PomodoroTimer: () => <div data-testid="mock-pomodoro-timer">PomodoroTimer</div> }));

// Mock framer-motion
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        motion: {
            div: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
            button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button>,
            span: ({ children, ...props }: ComponentProps<'span'>) => <span {...props}>{children}</span>,
        },
        AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    };
});

// Mock AnimatedNumber to avoid animation issues
vi.mock('../../components/ui/AnimatedNumber', () => ({
    AnimatedNumber: ({ value }: { value: number }) => <span data-testid="animated-number">{value}</span>,
}));

// Mock hooks if necessary, or let them run with mocked API
// We'll trust the setup.ts mocks for API calls if isTauri is handled
// But assume isTauri is false in test env, so it uses MOCK_APP_USAGE which is also fine for integration
// If we want to test "Real" flow we should mock isTauri to true

vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => ({
        settings: {
            dashboardDefaultRange: 'today',
            trackWindowTitles: true
        },
        updateSettings: vi.fn()
    })
}));

describe('Dashboard Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sanity check', () => {
        renderWithClient(<div>Test</div>);
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('renders dashboard with stats and charts', async () => {
        renderWithClient(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        // Check header
        expect(screen.getByText('The Pulse')).toBeInTheDocument();
        expect(screen.getByText('Your productivity overview')).toBeInTheDocument();

        // Check Stat Cards (labels from Dashboard.tsx)
        await waitFor(() => {
            expect(screen.getByText('Screen Time')).toBeInTheDocument();
            expect(screen.getByText('Keystrokes')).toBeInTheDocument();
            expect(screen.getByText('Mouse Clicks')).toBeInTheDocument();
            expect(screen.getByText('Focus Score')).toBeInTheDocument();
        });

        // Check that charts are present (by their title or unique text if any, or just existence of svg/canvas if recharts renders them)
        // Since we mocked ResponsiveContainer, we can look for "Focus Flow" text if it's in the component
        // The FocusFlowChart component has a title "Focus Flow" in it? 
        // Let's check FocusFlowChart source later. For now assume it renders something.

        // Check for Focus Score value which comes from useDailyStats (mocked in setup.ts)
        // The card's focus score is overridden by the reconciled app-usage score:
        // appUsage is [{ Code.exe: 3600 }], Code is productive => focusScore = 100%
        // content is split between AnimatedNumber ("100") and suffix ("%")
        await waitFor(() => {
            expect(screen.getByText('100')).toBeInTheDocument();
        });
    });
});
