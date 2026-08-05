import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Activity, MousePointer, Keyboard, Zap, X, Settings as SettingsIcon, Flame, Clock3, TrendingUp } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Hooks & Context
import { useDashboardData } from '../hooks/useDashboardData';
import { useUserStats } from '../hooks/useTrackerData';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';
import { useVisualTheme } from '../hooks/useVisualTheme';

// Components
import { GlassCard } from '../components/GlassCard';
import { AppIcon } from '../components/shared/AppIcon';
import { formatDuration } from '../utils/formatters';

export function TrayPopup() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    // Always show today in tray popup for consistent behavior
    const selectedRange: TimeRange = 'today';

    // We use the setting's default range for the tray view
    const { stats, appUsage, digest, isLoading } = useDashboardData(selectedRange);
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

    /* ================= FLAT: hairline-ruled popup ================= */
    if (isFlat) {
        return (
            <div className="w-full h-full flex flex-col bg-[var(--background)] border border-[var(--border)] font-body">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <Activity size={14} className="text-[var(--accent-focus)]" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--foreground)]">
                            Activity Tracker
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => openMainWindow('/settings')}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                            title="Settings"
                        >
                            <SettingsIcon size={14} />
                        </button>
                        <button
                            onClick={() => handleClosePopup()}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Metric band: 2 cells divided by a rule */}
                <div className="grid grid-cols-2 border-b border-[var(--border)]">
                    <div className="px-5 py-4">
                        <div className="label-mono">Active time</div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <Keyboard size={13} className="text-[var(--muted-foreground)]" />
                            <span className="font-display text-[22px] font-semibold tracking-[-0.04em] tabular-nums text-[var(--foreground)]">
                                {isLoading ? '…' : stats?.screenTime || '0m'}
                            </span>
                        </div>
                    </div>
                    <div className="px-5 py-4 border-l border-[var(--border)]">
                        <div className="label-mono">Focus score</div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <Zap size={13} className="text-[var(--accent-warning)]" />
                            <span className="font-display text-[22px] font-semibold tracking-[-0.04em] tabular-nums text-[var(--foreground)]">
                                {isLoading ? '…' : stats?.focusScore || 0}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Digest line */}
                <div className="flex items-center justify-center gap-4 px-5 py-3 border-b border-[var(--border)] font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                        <Flame size={11} className="text-[var(--accent-warning)]" />
                        {isLoading ? '…' : `${digest?.sessionCount ?? 0} deep`}
                    </span>
                    <span className="w-px h-3 bg-[var(--border)]" />
                    <span className="flex items-center gap-1">
                        <Clock3 size={11} />
                        peak {digest?.peakHour ?? '—'}
                    </span>
                    {digest && digest.deltaVsPrevious !== null && (
                        <>
                            <span className="w-px h-3 bg-[var(--border)]" />
                            <span className="flex items-center gap-1">
                                <TrendingUp size={11} className={digest.deltaVsPrevious >= 0 ? 'text-[var(--accent-focus)]' : 'text-[var(--accent-negative)]'} />
                                {digest.deltaVsPrevious >= 0 ? '+' : '−'}
                                {formatDuration(Math.abs(digest.deltaVsPrevious))}
                            </span>
                        </>
                    )}
                </div>

                {/* Top app */}
                <div className="flex-1 min-h-0 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="label-mono">Top application</span>
                        {topApp && (
                            <span className="font-mono text-[10px] font-bold text-[var(--foreground)]">
                                {formatDuration(topApp.value * 60)}
                            </span>
                        )}
                    </div>

                    {topApp ? (
                        <div className="flex items-center gap-3">
                            <AppIcon processName={topApp.name} size={28} />
                            <div className="flex flex-col min-w-0">
                                <span className="text-[13px] font-semibold text-[var(--foreground)] truncate">
                                    {topApp.name}
                                </span>
                                <span className="text-[10px] text-[var(--muted-foreground)]">
                                    Most active recently
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] py-6">
                            <MousePointer size={20} className="mb-2 opacity-30" />
                            <span className="text-[11px] font-bold">No activity recorded</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-4 pt-3 border-t border-[var(--border)]">
                    <button
                        onClick={() => openMainWindow('/')}
                        className="w-full py-3 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-[0.14em] font-bold hover:opacity-90 transition-opacity"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Maximize2 size={13} />
                            Open full app
                        </span>
                    </button>
                    {userStats && (
                        <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                            LVL {userStats.current_level} · {userStats.current_streak} DAY STREAK
                        </p>
                    )}
                </div>
            </div>
        );
    }

    /* ================= GLASS ================= */
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

                {/* Digest line - today at a glance */}
                <div className="flex items-center justify-center gap-4 mb-5 text-[10px] text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                        <Flame size={11} className="text-orange-500" />
                        {isLoading ? '…' : `${digest?.sessionCount ?? 0} deep session${digest?.sessionCount === 1 ? '' : 's'}`}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                    <span className="flex items-center gap-1">
                        <Clock3 size={11} />
                        peak {digest?.peakHour ?? '—'}
                    </span>
                    {digest && digest.deltaVsPrevious !== null && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                            <span className="flex items-center gap-1">
                                <TrendingUp size={11} className={digest.deltaVsPrevious >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
                                {digest.deltaVsPrevious >= 0 ? '+' : '−'}
                                {formatDuration(Math.abs(digest.deltaVsPrevious))}
                            </span>
                        </>
                    )}
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
                            Today
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
