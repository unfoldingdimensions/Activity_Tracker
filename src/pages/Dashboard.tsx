import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

// Components
import { PageHeader } from '../components/shared/PageHeader';
import { GlassCard } from '../components/GlassCard';
import { FocusFlowChart } from '../components/dashboard/FocusFlowChart';
import { TimeRangeFilter, type TimeRange } from '../components/dashboard/TimeRangeFilter';
import { RefreshButton } from '../components/shared/RefreshButton';
import { SessionBanner } from '../components/dashboard/SessionBanner';
import { MetricBand } from '../components/dashboard/MetricBand';
import { AppUsageSide } from '../components/dashboard/AppUsageSide';
import { InputIntensity } from '../components/dashboard/InputIntensity';
import { ProgressFooter } from '../components/dashboard/ProgressFooter';

// Data Hook
import { useDashboardData } from '../hooks/useDashboardData';
import { DailyDigest } from '../components/dashboard/DailyDigest';
import { DeepWorkSessions } from '../components/dashboard/DeepWorkSessions';
import { useSettings } from '../hooks/useSettings';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { useInputHistory } from '../hooks/useTrackerData';
import { formatDuration } from '../utils/formatters';
import { buildDashboardInsights } from '../utils/editorialInsights';

// Feature components
import { InputHistoryModal } from '../components/InputHistoryModal';
import { StreakCounter } from '../components/gamification/StreakCounter';
import { FlowStateMetrics } from '../components/insights/FlowStateMetrics';
import { WorkPatterns } from '../components/insights/WorkPatterns';

// Constants
import { containerVariants } from '../constants/animations';
import { EditorialIntro } from '../components/shared/EditorialIntro';

const RANGE_LABELS: Record<TimeRange, string> = {
    past_hour: 'PAST HOUR',
    past_6h: 'PAST 6H',
    past_12h: 'PAST 12H',
    today: 'TODAY',
    yesterday: 'YESTERDAY',
    this_week: 'THIS WEEK',
    this_month: 'THIS MONTH',
};

export function Dashboard() {
    const { settings } = useSettings();
    const isFlat = useVisualTheme() === 'flat';
    // Local state
    const [timeRange, setTimeRange] = useState<TimeRange>(settings.dashboardDefaultRange);
    const [showInputModal, setShowInputModal] = useState(false);

    // Fetch unified data
    const { stats, rawStats, appUsage, timelineData, focusSessions, digest, bucketMinutes, isLoading } = useDashboardData(timeRange);
    const { data: inputHistory, isLoading: inputLoading } = useInputHistory(60, true);

    const headerActions = (
        <div className="flex items-center gap-4">
            <RefreshButton />
            <div className="w-[1px] h-6 bg-border/40 mx-1" />
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />

            <div className="w-[1px] h-6 bg-border/40 mx-1" />
            <StreakCounter />
        </div>
    );

    const now = new Date();
    const metaLine = `${now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${RANGE_LABELS[timeRange]}`;

    const editorialSentence = `You focused for ${formatDuration(digest.focusSeconds)} across ${digest.sessionCount} deep ${digest.sessionCount === 1 ? 'session' : 'sessions'} ${digest.topAppName ? `— ${digest.topAppName} led the way` : ''}.`;

    const insights = useMemo(
        () => buildDashboardInsights(digest, focusSessions, timelineData),
        [digest, focusSessions, timelineData]
    );

    /* ================= FLAT SKIN — The Pulse ================= */
    if (isFlat) {
        return (
            <div className="flex flex-col min-h-full">
                {showInputModal && <InputHistoryModal onClose={() => setShowInputModal(false)} />}

                <PageHeader title="The Pulse" meta={metaLine} actions={headerActions} />

                <EditorialIntro sentence={editorialSentence} insights={insights} />

                <div className="pb-8">
                    <SessionBanner timeline={timelineData} bucketMinutes={bucketMinutes} />

                    <MetricBand
                        screenTimeSeconds={rawStats?.total_active_seconds ?? 0}
                        keystrokes={rawStats?.total_keystrokes ?? 0}
                        mouseClicks={rawStats?.total_mouse_clicks ?? 0}
                        mouseDistance={rawStats?.total_mouse_distance ?? 0}
                        focusScore={stats.focusScore}
                        spark={timelineData.map((d) => d.focus ?? 0)}
                        isLoading={isLoading}
                    />

                    <DailyDigest digest={digest} isLoading={isLoading} />

                    {/* Main split: focus flow + KPI row | app usage side */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 py-6 px-8 border-b border-[var(--border)]">
                        <div className="min-w-0 pr-0 lg:pr-7">
                            <FocusFlowChart data={timelineData} isLoading={isLoading} minHeight={250} title="Focus flow" />
                            <FlowStateMetrics />
                        </div>
                        <AppUsageSide appUsage={appUsage} isLoading={isLoading} />
                    </div>

                    {/* Two-up: input intensity | work patterns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-6 px-8 border-b border-[var(--border)]">
                        <div className="widget px-6 py-5 min-w-0 overflow-hidden">
                            <InputIntensity buckets={inputHistory ?? []} isLoading={inputLoading} onExpand={() => setShowInputModal(true)} />
                        </div>
                        <div className="widget px-6 py-5 min-w-0 overflow-hidden">
                            <WorkPatterns />
                        </div>
                    </div>

                    {/* Deep work sessions */}
                    <div className="py-6 px-8 border-b border-[var(--border)]">
                        <div className="widget px-6 py-5 min-w-0">
                            <DeepWorkSessions sessions={focusSessions} isLoading={isLoading} />
                        </div>
                    </div>

                    <ProgressFooter />
                </div>
            </div>
        );
    }

    /* ================= GLASS SKIN — same composition as flat ================= */
    return (
        <div className="flex flex-col min-h-full">
            {/* Modals */}
            {showInputModal && <InputHistoryModal onClose={() => setShowInputModal(false)} />}

            {/* Header */}
            <PageHeader
                title="The Pulse"
                subtitle="Your productivity overview"
                meta={metaLine}
                actions={headerActions}
            />

            <EditorialIntro sentence={editorialSentence} insights={insights} />

            {/* Content — same bands as the flat skin, glass containers */}
            <div className="p-8 pt-6 space-y-6 flex-1">
                <SessionBanner timeline={timelineData} bucketMinutes={bucketMinutes} />

                <MetricBand
                    screenTimeSeconds={rawStats?.total_active_seconds ?? 0}
                    keystrokes={rawStats?.total_keystrokes ?? 0}
                    mouseClicks={rawStats?.total_mouse_clicks ?? 0}
                    mouseDistance={rawStats?.total_mouse_distance ?? 0}
                    focusScore={stats.focusScore}
                    spark={timelineData.map((d) => d.focus ?? 0)}
                    isLoading={isLoading}
                />

                <DailyDigest digest={digest} isLoading={isLoading} />

                {/* Main split: focus flow + KPI row | app usage side */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        <FocusFlowChart
                            data={timelineData}
                            isLoading={isLoading}
                            minHeight={360}
                            title={`Focus Flow (${timeRange === 'past_hour' ? 'Past Hour' : timeRange === 'today' ? 'Today' : timeRange === 'yesterday' ? 'Yesterday' : timeRange === 'this_week' ? 'Past Week' : timeRange === 'this_month' ? 'Past Month' : timeRange.replace('past_', 'Past ')})`}
                        />
                        <div className="mt-4">
                            <FlowStateMetrics />
                        </div>
                    </motion.div>
                    <AppUsageSide appUsage={appUsage} isLoading={isLoading} />
                </div>

                {/* Two-up: input intensity | work patterns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard className="p-6" hover={false}>
                        <InputIntensity buckets={inputHistory ?? []} isLoading={inputLoading} onExpand={() => setShowInputModal(true)} />
                    </GlassCard>
                    <GlassCard className="p-6" hover={false}>
                        <WorkPatterns />
                    </GlassCard>
                </div>

                {/* Deep work sessions */}
                <DeepWorkSessions sessions={focusSessions} isLoading={isLoading} />

                <ProgressFooter />
            </div>
        </div>
    );
}
