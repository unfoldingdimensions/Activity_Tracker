/**
 * Dashboard - Main productivity overview page
 * Refactored to use extracted components (was 386 lines, now ~120)
 */

import { Monitor, MousePointer, Keyboard, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';

// Hooks
import {
    useAppUsage,
    useDailyStats,
    useTimeline,
    formatStatsForCards,
    formatAppUsageForChart,
} from '../hooks/useTrackerData';

// Shared components
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/dashboard/StatCard';
import { FocusFlowChart } from '../components/dashboard/FocusFlowChart';
import { AppUsageChart } from '../components/dashboard/AppUsageChart';

// Feature components
import { InputHistoryModal } from '../components/InputHistoryModal';
import { LevelSystem } from '../components/gamification/LevelSystem';
import { StreakCounter } from '../components/gamification/StreakCounter';
import { Achievements } from '../components/gamification/Achievements';
import { FlowStateMetrics } from '../components/insights/FlowStateMetrics';
import { WorkPatterns } from '../components/insights/WorkPatterns';
import { ErgonomicMetrics } from '../components/wellbeing/ErgonomicMetrics';
import { BreathingWidget } from '../components/wellbeing/BreathingWidget';
import { GoalSetter } from '../components/tools/GoalSetter';
import { PomodoroTimer } from '../components/tools/PomodoroTimer';

// Constants
import { containerVariants, itemVariants } from '../constants/animations';

export function Dashboard() {
    // Local state
    const [showInputModal, setShowInputModal] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);

    // Fetch live data from backend
    const { data: appUsageRaw, isLoading: appLoading } = useAppUsage();
    const { data: dailyStats, isLoading: statsLoading } = useDailyStats();
    const { data: timelineRaw } = useTimeline();

    // Format data for display
    const formattedStats = formatStatsForCards(dailyStats);
    const appUsageData = formatAppUsageForChart(appUsageRaw);

    // Transform timeline data for Focus Flow chart
    const timelineData = useMemo(() => {
        if (!timelineRaw) return [];
        return timelineRaw.map((segment) => {
            const total = segment.active_seconds + segment.idle_seconds;
            const focus = total > 0 ? Math.round((segment.active_seconds / total) * 100) : 0;
            return { time: segment.time, focus, distraction: 100 - focus };
        });
    }, [timelineRaw]);

    // Build stats configuration
    const stats = useMemo(() => [
        {
            label: 'Screen Time',
            value: formattedStats.screenTime,
            numericValue: dailyStats?.total_active_seconds || 0,
            icon: Monitor,
            subtitle: 'today',
            clickable: false,
            useStringValue: true,
        },
        {
            label: 'Keystrokes',
            value: formattedStats.keystrokes,
            numericValue: dailyStats?.total_keystrokes || 0,
            icon: Keyboard,
            subtitle: 'today',
            clickable: true,
        },
        {
            label: 'Mouse Clicks',
            value: formattedStats.mouseActivity,
            numericValue: dailyStats?.total_mouse_clicks || 0,
            icon: MousePointer,
            subtitle: 'clicks',
            clickable: true,
        },
        {
            label: 'Focus Score',
            value: `${formattedStats.focusScore}%`,
            numericValue: formattedStats.focusScore,
            icon: Zap,
            subtitle: 'score',
            clickable: false,
            suffix: '%',
        },
    ], [formattedStats, dailyStats]);

    const isLoading = appLoading || statsLoading;

    return (
        <div className="flex flex-col min-h-full">
            {/* Modals */}
            <BreathingWidget isOpen={showBreathing} onClose={() => setShowBreathing(false)} />
            {showInputModal && <InputHistoryModal onClose={() => setShowInputModal(false)} />}

            {/* Header */}
            <PageHeader
                title="The Pulse"
                subtitle="Your productivity overview for today"
                actions={<StreakCounter />}
            />

            {/* Content */}
            <div className="p-8 pt-6 space-y-12 flex-1">
                {/* 1. Primary Metrics */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    {stats.map((stat) => (
                        <motion.div key={stat.label} variants={itemVariants}>
                            <StatCard
                                label={stat.label}
                                value={stat.value}
                                numericValue={stat.numericValue}
                                icon={stat.icon}
                                subtitle={stat.subtitle}
                                isLoading={isLoading}
                                clickable={stat.clickable}
                                onClick={() => stat.clickable && setShowInputModal(true)}
                                suffix={stat.suffix}
                                useStringValue={stat.useStringValue}
                            />
                        </motion.div>
                    ))}
                </motion.div>

                {/* 2. Core Visual Analytics */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <FocusFlowChart data={timelineData} isLoading={isLoading} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <AppUsageChart data={appUsageData} isLoading={isLoading} />
                    </motion.div>
                </motion.div>

                {/* 3. Deep Analytical Insights */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                    <motion.div variants={itemVariants}>
                        <FlowStateMetrics />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <WorkPatterns />
                    </motion.div>
                </motion.div>

                {/* 4. Gamification & Progress */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <LevelSystem />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <Achievements />
                    </motion.div>
                </motion.div>

                {/* 5. Wellbeing & Tools */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    <motion.div variants={itemVariants}>
                        <ErgonomicMetrics onStartBreathing={() => setShowBreathing(true)} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <GoalSetter />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <PomodoroTimer />
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
