import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Settings as SettingsIcon, Moon, Sun, Eye, EyeOff, Trash2, Play, Pause, LayoutGrid, Clock } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../context/useTheme';
import { useSettings } from '../hooks/useSettings';
import { isTauri } from '../utils/isTauri';
import { startTracking, stopTracking, clearData } from '../api/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/ui/Toast';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';

export function Settings() {
    const { theme, toggleTheme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const { showToast } = useToast();
    const [isTracking, setIsTracking] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    const queryClient = useQueryClient();

    const isDarkMode = theme === 'dark';

    const handleTrackingToggle = async () => {
        if (!isTauri()) {
            setIsTracking(!isTracking);
            showToast('info', isTracking ? 'Activity tracking has been paused.' : 'Activity tracking is now active.');
            return;
        }

        setIsToggling(true);
        try {
            if (isTracking) {
                await stopTracking();
                showToast('info', 'Activity tracking has been paused.');
            } else {
                await startTracking();
                showToast('success', 'Activity tracking is now active.');
            }
            setIsTracking(!isTracking);
        } catch (error) {
            console.error('Failed to toggle tracking:', error);
            showToast('error', 'Failed to toggle tracking state.');
        } finally {
            setIsToggling(false);
        }
    };

    const handleClearData = async () => {
        if (!isTauri()) {
            showToast('info', 'Data clearing is only available in the desktop app.');
            return;
        }

        if (confirm('Are you sure you want to delete all activity history? This cannot be undone.')) {
            setIsClearing(true);
            try {
                await clearData();
                // Invalidate all queries to refresh UI
                await queryClient.invalidateQueries();
                showToast('success', 'All activity history has been permanently deleted.');
            } catch (error) {
                console.error('Failed to clear data:', error);
                showToast('error', 'Failed to clear data. Please try again.');
            } finally {
                setIsClearing(false);
            }
        }
    };

    return (
        <div className="flex flex-col min-h-full font-sans">
            <PageHeader
                title="Settings"
                subtitle="Configure your tracking preferences and application settings"
            />



            <div className="p-8 pt-6 space-y-6 flex-1 max-w-4xl mx-auto w-full">
                {/* Tracking Control */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`p-2 rounded-lg ${isTracking ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                            {isTracking ? (
                                <Play size={20} className="text-emerald-500" />
                            ) : (
                                <Pause size={20} className="text-[var(--muted-foreground)]" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Tracking Status
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Control data collection
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg transition-transform duration-200 group-hover:scale-110 ${isTracking ? 'bg-emerald-500/10' : 'bg-[var(--muted)]'}`}>
                                {isTracking ? (
                                    <Play size={18} className="text-emerald-500" />
                                ) : (
                                    <Pause size={18} className="text-[var(--muted-foreground)]" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-[var(--foreground)]">
                                    {isTracking ? 'Tracking Active' : 'Tracking Paused'}
                                </p>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    {isTracking
                                        ? 'Recording your activity in the background'
                                        : 'Activity tracking is currently paused'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={isTracking ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={handleTrackingToggle}
                            loading={isToggling}
                            className="min-w-[100px]"
                        >
                            {isTracking ? 'Pause' : 'Resume'}
                        </Button>
                    </div>
                </GlassCard>

                {/* Dashboard Settings */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <LayoutGrid size={20} className="text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Dashboard Preferences
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Customize your dashboard view
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                <Clock size={18} className="text-[var(--foreground)]" />
                            </div>
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Default Date Range</p>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Initial range shown on the dashboard
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={settings.dashboardDefaultRange}
                                onChange={(e) => updateSettings({ dashboardDefaultRange: e.target.value as TimeRange })}
                                className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] block w-full p-2.5 outline-none cursor-pointer hover:bg-[var(--secondary)] transition-colors min-w-[150px]"
                            >
                                <option value="past_hour">Past Hour</option>
                                <option value="past_6h">Past 6 Hours</option>
                                <option value="past_12h">Past 12 Hours</option>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="this_week">This Week</option>
                                <option value="this_month">This Month</option>
                            </select>
                        </div>
                    </div>
                </GlassCard>

                {/* Appearance */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <SettingsIcon size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Appearance
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Customize the interface
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                {isDarkMode ? (
                                    <Moon size={18} className="text-[var(--foreground)]" />
                                ) : (
                                    <Sun size={18} className="text-[var(--foreground)]" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-[var(--foreground)]">Dark Mode</p>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Switch between light and dark themes
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`
                relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]
                ${isDarkMode ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}
              `}
                        >
                            <div
                                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm
                  transition-transform duration-200
                  ${isDarkMode ? 'translate-x-7' : 'translate-x-1'}
                `}
                            />
                        </button>
                    </div>
                </GlassCard>

                {/* Privacy & Data */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Eye size={20} className="text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Privacy & Data
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Manage your data and privacy settings
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Track Window Titles */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    {settings.trackWindowTitles ? (
                                        <Eye size={18} className="text-[var(--foreground)]" />
                                    ) : (
                                        <EyeOff size={18} className="text-[var(--muted-foreground)]" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Track Window Titles</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Record detailed window titles for better insights
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSettings({ trackWindowTitles: !settings.trackWindowTitles })}
                                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]
                  ${settings.trackWindowTitles ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}
                `}
                            >
                                <div
                                    className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${settings.trackWindowTitles ? 'translate-x-7' : 'translate-x-1'}
                  `}
                                />
                            </button>
                        </div>

                        {/* Clear Data */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--destructive)]/20 hover:border-[var(--destructive)]/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--destructive)]/10 transition-transform duration-200 group-hover:scale-110">
                                    <Trash2 size={18} className="text-[var(--destructive)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Clear All Data</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Delete all tracks and restore default settings
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleClearData}
                                loading={isClearing}
                            >
                                Clear Data
                            </Button>
                        </div>
                    </div>
                </GlassCard>

                {/* About */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-xs text-[var(--muted-foreground)]">
                        Activity Tracker v0.1.0 • Built with Tauri + React
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]/60 mt-1">
                        All data is stored locally. No information is uploaded to any server.
                    </p>
                </div>
            </div >
        </div >
    );
}
