import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Settings as SettingsIcon, Moon, Sun, Eye, EyeOff, Trash2, Play, Pause } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../context/useTheme';
import { isTauri } from '../utils/isTauri';
import { startTracking, stopTracking, clearData } from '../api/tauri';
import { useQueryClient } from '@tanstack/react-query';

export function Settings() {
    const { theme, toggleTheme } = useTheme();
    const [trackTitles, setTrackTitles] = useState(true);
    const [isTracking, setIsTracking] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const queryClient = useQueryClient();

    const isDarkMode = theme === 'dark';

    const handleTrackingToggle = async () => {
        if (!isTauri()) {
            setIsTracking(!isTracking);
            return;
        }

        setIsToggling(true);
        try {
            if (isTracking) {
                await stopTracking();
            } else {
                await startTracking();
            }
            setIsTracking(!isTracking);
        } catch (error) {
            console.error('Failed to toggle tracking:', error);
        } finally {
            setIsToggling(false);
        }
    };

    const handleClearData = async () => {
        if (!isTauri()) return;

        if (confirm('Are you sure you want to delete all activity history? This cannot be undone.')) {
            setIsClearing(true);
            try {
                await clearData();
                // Invalidate all queries to refresh UI
                await queryClient.invalidateQueries();
                alert('Data cleared successfully.');
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Failed to clear data');
            } finally {
                setIsClearing(false);
            }
        }
    };

    return (
        <div className="flex flex-col min-h-full animate-fade-in">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--background)]/80 p-8 pb-4 border-b border-[var(--border)]/50 transition-all">
                <h2 className="font-display text-3xl font-bold text-[var(--foreground)]">
                    Settings
                </h2>
                <p className="text-[var(--muted-foreground)] mt-1">
                    Configure your tracking preferences
                </p>
            </div>

            {/* Content */}
            <div className="p-8 pt-6 space-y-8 flex-1">
                {/* Tracking Control */}
                <GlassCard className="p-6 animate-fade-in-up" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        {isTracking ? (
                            <Play size={20} className="text-[#0f766e]" />
                        ) : (
                            <Pause size={20} className="text-[var(--muted-foreground)]" />
                        )}
                        <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                            Tracking
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {/* Tracking Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)] hover-lift group">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-transform duration-[var(--duration-fast)] group-hover:scale-110 ${isTracking ? 'bg-[#0f766e]/20' : 'bg-[var(--muted)]'
                                    }`}>
                                    {isTracking ? (
                                        <Play size={18} className="text-[#0f766e]" />
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
                            >
                                {isTracking ? 'Pause' : 'Resume'}
                            </Button>
                        </div>
                    </div>
                </GlassCard>

                {/* Appearance */}
                <GlassCard className="p-6 animate-fade-in-up" hover={false} spotlight style={{ animationDelay: '50ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <SettingsIcon size={20} className="text-[var(--foreground)]" />
                        <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                            Appearance
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)] hover-lift group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                                    {isDarkMode ? (
                                        <Moon size={18} className="text-[var(--foreground)]" />
                                    ) : (
                                        <Sun size={18} className="text-[var(--foreground)]" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Dark Mode</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Use dark theme for the interface
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className={`
                    relative w-14 h-7 rounded-full transition-all duration-[var(--duration-base)]
                    ${isDarkMode ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'}
                  `}
                            >
                                <div
                                    className={`
                      absolute top-1 w-5 h-5 rounded-full shadow-md
                      transition-all duration-[var(--duration-base)] ease-[var(--ease-out-back)]
                      ${isDarkMode
                                            ? 'left-8 bg-[var(--background)]'
                                            : 'left-1 bg-[var(--foreground)]'
                                        }
                    `}
                                />
                            </button>
                        </div>
                    </div>
                </GlassCard>

                {/* Privacy */}
                <GlassCard className="p-6 animate-fade-in-up" hover={false} spotlight style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <Eye size={20} className="text-[var(--foreground)]" />
                        <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">
                            Privacy
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {/* Track Window Titles */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)] hover-lift group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                                    {trackTitles ? (
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
                                onClick={() => setTrackTitles(!trackTitles)}
                                className={`
                    relative w-14 h-7 rounded-full transition-all duration-[var(--duration-base)]
                    ${trackTitles ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'}
                  `}
                            >
                                <div
                                    className={`
                      absolute top-1 w-5 h-5 rounded-full shadow-md
                      transition-all duration-[var(--duration-base)] ease-[var(--ease-out-back)]
                      ${trackTitles
                                            ? 'left-8 bg-[var(--background)]'
                                            : 'left-1 bg-[var(--foreground)]'
                                        }
                    `}
                                />
                            </button>
                        </div>

                        {/* Clear Data */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)] hover-lift group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--destructive)]/10 transition-transform duration-[var(--duration-fast)] group-hover:scale-110">
                                    <Trash2 size={18} className="text-[var(--destructive)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Clear All Data</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Delete all tracked activity data
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleClearData}
                                loading={isClearing}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                </GlassCard>

                {/* About */}
                <GlassCard className="p-6 animate-fade-in-up" hover={false} style={{ animationDelay: '150ms' }}>
                    <h3 className="font-display text-lg font-semibold mb-4 text-[var(--foreground)]">
                        About
                    </h3>
                    <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                        <p>
                            <span className="text-[var(--muted-foreground)]">Version:</span>{' '}
                            <span className="text-[var(--foreground)] font-medium">0.1.0</span>
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                                Development
                            </span>
                        </p>
                        <p>
                            <span className="text-[var(--muted-foreground)]">Built with:</span>{' '}
                            <span className="text-[var(--foreground)]">Tauri + React + TypeScript</span>
                        </p>
                        <p className="pt-2">
                            All data is stored locally on your device. No information is sent to any server.
                        </p>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
