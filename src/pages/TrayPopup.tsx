import { useMemo, useContext } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Activity, MousePointer, Keyboard, Zap, X, Settings as SettingsIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Hooks & Context
import { useDashboardData } from '../hooks/useDashboardData';
import { useUserStats } from '../hooks/useTrackerData';
import { SettingsContext } from '../context/SettingsContext';

// Components
import { GlassCard } from '../components/GlassCard';
import { AppIcon } from '../components/shared/AppIcon';
import { formatDuration } from '../utils/formatters';

const RANGE_LABELS: Record<string, string> = {
    'past_hour': 'Past Hour',
    'past_6h': 'Past 6 Hours',
    'past_12h': 'Past 12 Hours',
    'today': 'Today',
    'yesterday': 'Yesterday',
    'this_week': 'This Week',
    'this_month': 'This Month'
};

export function TrayPopup() {
    const settingsContext = useContext(SettingsContext);
    const selectedRange = settingsContext?.settings?.dashboardDefaultRange || 'today';

    // We use the setting's default range for the tray view
    const { stats, appUsage, isLoading } = useDashboardData(selectedRange);
    const { data: userStats } = useUserStats();

    const topApp = useMemo(() => appUsage && appUsage.length > 0 ? appUsage[0] : null, [appUsage]);

    // Note: Click-outside-to-close is handled at the Rust backend level via WindowEvent::Focused

    const handleClosePopup = async () => {
        console.log('[DEBUG] handleClosePopup triggered - using backend command');
        try {
            await invoke('hide_tray_window');
            console.log('[DEBUG] hide_tray_window command completed');
        } catch (error) {
            console.error('[DEBUG] Failed to hide tray window:', error);
        }
    };

    const openMainWindow = async (path: string = '/') => {
        console.log(`[DEBUG] Attempting to show main window with path: ${path}`);
        try {
            // Updated invoke to pass the path object to the backend
            console.log('[DEBUG] Invoking show_main_window with path:', path);
            await invoke('show_main_window', { path: path });

            // Wait slightly for the main window to show
            await new Promise(resolve => setTimeout(resolve, 50));

            // Hide the tray popup
            console.log('[DEBUG] Hiding tray popup');
            await handleClosePopup();
        } catch (error) {
            console.error('[DEBUG] Failed to open main window:', error);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="w-full h-full flex flex-col items-center justify-center bg-transparent font-body p-4"
        >
            <GlassCard className="w-full h-full flex flex-col p-6 shadow-2xl border border-[var(--border)] relative overflow-hidden rounded-[2.5rem] bg-[var(--background)]" hover={false}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <Activity size={22} />
                        </div>
                        <span className="font-display font-black text-xl tracking-tight">Activity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => {
                                console.log('[DEBUG] Settings button clicked');
                                openMainWindow('/settings');
                            }}
                            className="p-2.5 hover:bg-[var(--secondary)] rounded-full transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95"
                            title="Settings"
                        >
                            <SettingsIcon size={20} />
                        </button>
                        <button
                            onClick={() => {
                                console.log('[DEBUG] Close button clicked');
                                handleClosePopup();
                            }}
                            className="p-2.5 hover:bg-[var(--secondary)] rounded-full transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95"
                            title="Close"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-[var(--secondary)]/40 rounded-2xl p-4 flex flex-col border border-[var(--border)]/20">
                        <span className="text-[10px] uppercase text-[var(--muted-foreground)] font-black tracking-widest mb-1.5 opacity-60">Active Time</span>
                        <div className="flex items-center gap-2">
                            <Keyboard size={16} className="text-[var(--foreground)]" />
                            <span className="text-xl font-display font-black tracking-tight whitespace-nowrap">
                                {isLoading ? '...' : stats?.screenTime || '0m'}
                            </span>
                        </div>
                    </div>
                    <div className="bg-[var(--secondary)]/40 rounded-2xl p-4 flex flex-col border border-[var(--border)]/20">
                        <span className="text-[10px] uppercase text-[var(--muted-foreground)] font-black tracking-widest mb-1.5 opacity-60">Focus Score</span>
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-amber-500 fill-amber-500/20" />
                            <span className="text-xl font-display font-black tracking-tight whitespace-nowrap">
                                {isLoading ? '...' : stats?.focusScore || 0}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Top App Section */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-[10px] uppercase text-[var(--muted-foreground)] font-black tracking-widest opacity-60">Top Application</h3>
                        {topApp && (
                            <span className="text-[10px] font-display font-bold text-[var(--foreground)] px-2 py-0.5 bg-[var(--secondary)] rounded-full">
                                {formatDuration(topApp.value * 60)}
                            </span>
                        )}
                    </div>

                    {topApp ? (
                        <div className="mb-4 bg-[var(--secondary)]/20 rounded-2xl p-4 border border-[var(--border)]/30 group hover:bg-[var(--secondary)]/40 transition-colors">
                            <div className="flex items-center gap-3">
                                <AppIcon processName={topApp.name} size={32} className="shadow-sm" />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-display font-extrabold text-sm truncate">{topApp.name}</span>
                                    <span className="text-[10px] text-[var(--muted-foreground)] font-medium">Most active recently</span>
                                </div>
                            </div>
                            <div className="mt-4 h-1.5 bg-[var(--border)]/50 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    className="h-full bg-primary rounded-full"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-[var(--secondary)]/10 rounded-2xl p-6 flex flex-col items-center justify-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)]">
                            <MousePointer size={24} className="mb-2 opacity-30" />
                            <span className="text-[11px] font-bold">No activity recorded</span>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 space-y-4">
                    <div className="flex flex-col items-center text-center">
                        <span className="text-[10px] text-[var(--muted-foreground)] font-bold mb-1 opacity-60">Viewing Stats For</span>
                        <span className="text-[11px] font-display font-black text-[var(--foreground)] uppercase tracking-tight">
                            {RANGE_LABELS[selectedRange] || selectedRange}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mx-2">
                        <button
                            onClick={() => {
                                console.log('[DEBUG] Open Full App button clicked');
                                openMainWindow('/');
                            }}
                            className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-xs font-black tracking-tight hover:shadow-xl hover:shadow-primary/20 transition-all btn-press"
                        >
                            <Maximize2 size={14} />
                            OPEN FULL APP
                        </button>

                        {userStats && (
                            <div className="pt-2 flex justify-center border-t border-[var(--border)]/30 mt-2">
                                <p className="text-[10px] text-[var(--muted-foreground)] font-black tracking-widest uppercase opacity-40">
                                    LVL {userStats.current_level} • {userStats.current_streak} DAY STREAK
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </GlassCard>
        </motion.div>
    );
}
