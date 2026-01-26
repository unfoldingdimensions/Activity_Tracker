import { Monitor, MousePointer, Keyboard, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

// Components
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/dashboard/StatCard';
import { FocusFlowChart } from '../components/dashboard/FocusFlowChart';
import { AppUsageChart } from '../components/dashboard/AppUsageChart';
import { TimeRangeFilter, type TimeRange } from '../components/dashboard/TimeRangeFilter';
import { RefreshButton } from '../components/shared/RefreshButton';


// Data Hook
import { useDashboardData } from '../hooks/useDashboardData';

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
    const [timeRange, setTimeRange] = useState<TimeRange>('today');
    const [showInputModal, setShowInputModal] = useState(false);
    const [showBreathing, setShowBreathing] = useState(false);

    // Fetch unified data
    const { stats, rawStats, appUsage, timelineData, isLoading } = useDashboardData(timeRange);

    // Build stats configuration for cards
    const statCards = useMemo(() => [
        {
            label: 'Screen Time',
            value: stats.screenTime,
            numericValue: rawStats?.total_active_seconds || 0,
            icon: Monitor,
            subtitle: timeRange === 'today' ? 'today' : 'in range',
            clickable: false,
            useStringValue: true,
        },
        {
            label: 'Keystrokes',
            value: stats.keystrokes,
            numericValue: rawStats?.total_keystrokes || 0,
            icon: Keyboard,
            subtitle: timeRange === 'today' ? 'today' : 'in range',
            clickable: true,
        },
        {
            label: 'Mouse Clicks',
            value: stats.mouseActivity,
            numericValue: rawStats?.total_mouse_clicks || 0,
            icon: MousePointer,
            subtitle: 'clicks',
            clickable: true,
        },
        {
            label: 'Focus Score',
            value: `${stats.focusScore}%`,
            numericValue: stats.focusScore,
            icon: Zap,
            subtitle: 'score',
            clickable: false,
            suffix: '%',
        },
    ], [stats, rawStats, timeRange]);

    return (
        <div className="flex flex-col min-h-full">
            {/* Modals */}
            <BreathingWidget isOpen={showBreathing} onClose={() => setShowBreathing(false)} />
            {showInputModal && <InputHistoryModal onClose={() => setShowInputModal(false)} />}

            {/* Header */}
            <PageHeader
                title="The Pulse"
                subtitle="Your productivity overview"
                actions={
                    <div className="flex items-center gap-4">
                        <RefreshButton />
                        <div className="w-[1px] h-6 bg-border/40 mx-1" />
                        <TimeRangeFilter value={timeRange} onChange={setTimeRange} />

                        <div className="w-[1px] h-6 bg-border/40 mx-1" />
                        <StreakCounter />
                    </div>
                }
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
                    {statCards.map((stat) => (
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
                        <FocusFlowChart data={timelineData} isLoading={isLoading} title="Focus Flow" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <AppUsageChart data={appUsage} isLoading={isLoading} />
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
