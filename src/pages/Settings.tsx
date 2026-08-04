import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Settings as SettingsIcon, Moon, Sun, Eye, EyeOff, Trash2, Play, Pause, LayoutGrid, Clock, Rocket, Minimize2, Gauge, ShieldBan, Lock, CalendarClock, ListFilter, ShieldAlert, Download } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/useTheme';
import { useSettings } from '../hooks/useSettings';
import { isTauri } from '../utils/isTauri';
import { startTracking, stopTracking, clearData, isTracking as fetchTrackingState, exportData } from '../api/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/ui/Toast';
import { APP_VERSION } from '../constants/config';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';

export function Settings() {
    const { theme, toggleTheme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const { showToast } = useToast();
    const [isTracking, setIsTracking] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [blacklistInput, setBlacklistInput] = useState('');
    const [classInput, setClassInput] = useState('');
    const [classSelect, setClassSelect] = useState<'focus' | 'distraction'>('distraction');
    const [limitInput, setLimitInput] = useState('');
    const [limitMinutes, setLimitMinutes] = useState(120);

    const queryClient = useQueryClient();

    // Latest-ref for updateSettings so effects can call it without
    // re-running on every settings change (which would loop)
    const updateSettingsRef = useRef(updateSettings);
    useEffect(() => {
        updateSettingsRef.current = updateSettings;
    }, [updateSettings]);

    // Sync toggle with the real backend tracking state
    useEffect(() => {
        if (!isTauri()) return;
        let active = true;
        fetchTrackingState()
            .then((tracking) => {
                if (active) setIsTracking(tracking);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    // Reconcile the launch-on-startup toggle with the OS autostart registry
    useEffect(() => {
        if (!isTauri()) return;
        let active = true;
        isAutostartEnabled()
            .then((enabled) => {
                if (active) updateSettingsRef.current({ launchOnStartup: enabled });
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

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

    const handleLaunchOnStartupToggle = async () => {
        const next = !settings.launchOnStartup;
        if (isTauri()) {
            try {
                if (next) {
                    await enableAutostart();
                } else {
                    await disableAutostart();
                }
            } catch (error) {
                console.error('Failed to update autostart:', error);
                showToast('error', 'Failed to update launch on startup.');
                return;
            }
        }
        updateSettings({ launchOnStartup: next });
        showToast('success', next ? 'Will launch on startup.' : 'Won\u2019t launch on startup.');
    };

    const addToBlacklist = () => {
        const name = blacklistInput.trim();
        if (!name) return;
        if (settings.blacklistedApps.some((b) => b.toLowerCase() === name.toLowerCase())) {
            showToast('info', 'That app is already blacklisted.');
            return;
        }
        updateSettings({ blacklistedApps: [...settings.blacklistedApps, name] });
        setBlacklistInput('');
        showToast('success', `${name} will no longer be tracked.`);
    };

    const removeFromBlacklist = (name: string) => {
        updateSettings({ blacklistedApps: settings.blacklistedApps.filter((b) => b !== name) });
    };

    const addClassification = () => {
        const name = classInput.trim();
        if (!name) return;
        updateSettings({
            appClassification: { ...settings.appClassification, [name]: classSelect },
        });
        setClassInput('');
        showToast('success', `${name} classified as ${classSelect}.`);
    };

    const setClassification = (name: string, cls: 'focus' | 'distraction' | 'ignore') => {
        updateSettings({
            appClassification: { ...settings.appClassification, [name]: cls },
        });
    };

    const removeClassification = (name: string) => {
        const next = { ...settings.appClassification };
        delete next[name];
        updateSettings({ appClassification: next });
    };

    const addAppLimit = () => {
        const name = limitInput.trim();
        if (!name) return;
        updateSettings({ appLimits: { ...settings.appLimits, [name]: limitMinutes * 60 } });
        setLimitInput('');
        showToast('success', `Daily limit set for ${name}.`);
    };

    const setAppLimit = (name: string, minutes: number) => {
        const seconds = Math.max(5, minutes) * 60;
        updateSettings({ appLimits: { ...settings.appLimits, [name]: seconds } });
    };

    const removeAppLimit = (name: string) => {
        const next = { ...settings.appLimits };
        delete next[name];
        updateSettings({ appLimits: next });
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
                // Reset local preferences and in-session settings to defaults
                localStorage.removeItem('user_settings');
                localStorage.removeItem('activity_tracker_goals');
                updateSettings({ dashboardDefaultRange: 'past_hour', trackWindowTitles: true });
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

    const handleExport = async () => {
        if (!isTauri()) {
            showToast('info', 'Export is only available in the desktop app.');
            return;
        }

        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const dateStr = new Date().toISOString().slice(0, 10);
            const path = await save({
                defaultPath: `activity-tracker-${dateStr}.json`,
                filters: [
                    { name: 'JSON', extensions: ['json'] },
                    { name: 'CSV', extensions: ['csv'] },
                ],
            });
            if (!path) return; // cancelled

            const format = path.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
            await exportData(path, format);
            showToast('success', 'Activity history exported successfully.');
        } catch (error) {
            console.error('Failed to export data:', error);
            showToast('error', 'Failed to export data.');
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

                {/* General */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                            <Rocket size={20} className="text-violet-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                General
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                How the app launches and behaves
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Launch on Startup */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <Rocket size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Launch on Startup</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Start tracking automatically when you sign in
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleLaunchOnStartupToggle}
                                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]
                  ${settings.launchOnStartup ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}
                `}
                            >
                                <div
                                    className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${settings.launchOnStartup ? 'translate-x-7' : 'translate-x-1'}
                  `}
                                />
                            </button>
                        </div>

                        {/* Start Minimized to Tray */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <Minimize2 size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Start Minimized to Tray</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Hide the window on launch; keep running in the tray
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSettings({ startMinimized: !settings.startMinimized })}
                                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]
                  ${settings.startMinimized ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}
                `}
                            >
                                <div
                                    className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${settings.startMinimized ? 'translate-x-7' : 'translate-x-1'}
                  `}
                                />
                            </button>
                        </div>
                    </div>
                </GlassCard>

                {/* Tracking Behavior */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-cyan-500/10">
                            <Gauge size={20} className="text-cyan-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Tracking Behavior
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Idle detection and app exclusions
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Idle Threshold */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <Gauge size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Idle Threshold</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Seconds without input before you count as idle
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 min-w-[180px]">
                                <input
                                    type="range"
                                    min={30}
                                    max={300}
                                    step={15}
                                    value={settings.idleThreshold}
                                    onChange={(e) => updateSettings({ idleThreshold: Number(e.target.value) })}
                                    className="flex-1 accent-[var(--primary)] cursor-pointer"
                                    aria-label="Idle threshold in seconds"
                                />
                                <span className="font-mono text-sm text-[var(--foreground)] w-12 text-right">
                                    {settings.idleThreshold}s
                                </span>
                            </div>
                        </div>

                        {/* Blacklisted Apps */}
                        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <ShieldBan size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Blacklisted Apps</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        These apps are excluded from tracking entirely
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-3">
                                <input
                                    value={blacklistInput}
                                    onChange={(e) => setBlacklistInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') addToBlacklist();
                                    }}
                                    placeholder="e.g. chrome.exe or Chrome"
                                    className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
                                />
                                <Button variant="secondary" size="sm" onClick={addToBlacklist}>
                                    Add
                                </Button>
                            </div>

                            {settings.blacklistedApps.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {settings.blacklistedApps.map((name) => (
                                        <span
                                            key={name}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                                        >
                                            {name}
                                            <button
                                                onClick={() => removeFromBlacklist(name)}
                                                className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                                                aria-label={`Remove ${name} from blacklist`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--muted-foreground)]/60">
                                    No apps blacklisted. Add one to keep it out of your stats.
                                </p>
                            )}
                        </div>
                    </div>
                </GlassCard>

                {/* App Classification */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-rose-500/10">
                            <ListFilter size={20} className="text-rose-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                App Classification
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Override how apps count toward your Focus Score
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.keys(settings.appClassification).length > 0 && (
                            <div className="space-y-2">
                                {Object.entries(settings.appClassification).map(([name, cls]) => (
                                    <div
                                        key={name}
                                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]"
                                    >
                                        <span className="text-sm font-medium text-[var(--foreground)] truncate mr-2">
                                            {name}
                                        </span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <select
                                                value={cls}
                                                onChange={(e) => setClassification(name, e.target.value as 'focus' | 'distraction' | 'ignore')}
                                                className="bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg p-1.5 outline-none cursor-pointer"
                                            >
                                                <option value="focus">Focus</option>
                                                <option value="distraction">Distraction</option>
                                                <option value="ignore">Ignore</option>
                                            </select>
                                            <button
                                                onClick={() => removeClassification(name)}
                                                className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors text-lg leading-none"
                                                aria-label={`Remove classification for ${name}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)]">
                            <div className="flex gap-2">
                                <input
                                    value={classInput}
                                    onChange={(e) => setClassInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') addClassification();
                                    }}
                                    placeholder="App name, e.g. figma or Figma.exe"
                                    className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
                                />
                                <select
                                    value={classSelect}
                                    onChange={(e) => setClassSelect(e.target.value as 'focus' | 'distraction')}
                                    className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 outline-none cursor-pointer"
                                >
                                    <option value="focus">Focus</option>
                                    <option value="distraction">Distraction</option>
                                </select>
                                <Button variant="secondary" size="sm" onClick={addClassification}>
                                    Add
                                </Button>
                            </div>
                            <p className="text-[10px] text-[var(--muted-foreground)]/60 mt-2">
                                Overrides the built-in defaults. Names match by fragment (chrome matches Chrome.exe).
                                Ignore removes an app from Focus Score, Focus Flow and Timeline badges.
                            </p>
                        </div>
                    </div>
                </GlassCard>

                {/* Distraction Guard */}
                <GlassCard className="p-6" hover={false} spotlight>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-red-500/10">
                            <ShieldAlert size={20} className="text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                Distraction Guard
                            </h3>
                            <p className="text-sm text-[var(--muted-foreground)]">
                                Daily time limits per app — notified once when crossed
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.keys(settings.appLimits).length > 0 && (
                            <div className="space-y-2">
                                {Object.entries(settings.appLimits).map(([name, seconds]) => (
                                    <div
                                        key={name}
                                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]"
                                    >
                                        <span className="text-sm font-medium text-[var(--foreground)] truncate mr-2">
                                            {name}
                                        </span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <input
                                                type="number"
                                                min={5}
                                                step={5}
                                                value={Math.round(seconds / 60)}
                                                onChange={(e) => setAppLimit(name, Number(e.target.value))}
                                                className="w-20 bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 py-1.5 outline-none"
                                                aria-label={`Daily limit for ${name} in minutes`}
                                            />
                                            <span className="text-xs text-[var(--muted-foreground)]">min</span>
                                            <button
                                                onClick={() => removeAppLimit(name)}
                                                className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors text-lg leading-none"
                                                aria-label={`Remove limit for ${name}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)]">
                            <div className="flex gap-2">
                                <input
                                    value={limitInput}
                                    onChange={(e) => setLimitInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') addAppLimit();
                                    }}
                                    placeholder="App name, e.g. chrome or YouTube"
                                    className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
                                />
                                <input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={limitMinutes}
                                    onChange={(e) => setLimitMinutes(Number(e.target.value))}
                                    className="w-20 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 py-2 outline-none"
                                    aria-label="Daily limit in minutes"
                                />
                                <span className="flex items-center text-xs text-[var(--muted-foreground)]">min</span>
                                <Button variant="secondary" size="sm" onClick={addAppLimit}>
                                    Add
                                </Button>
                            </div>
                            <p className="text-[10px] text-[var(--muted-foreground)]/60 mt-2">
                                When an app passes its limit you get one notification per day, plus an in-app alert.
                            </p>
                        </div>
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

                        {/* Sensitive Title Redaction */}
                        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <Lock size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Redact Sensitive Titles</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Replace these words in window titles with ••• (comma-separated)
                                    </p>
                                </div>
                            </div>
                            <input
                                key={settings.redactedKeywords.join(',')}
                                defaultValue={settings.redactedKeywords.join(', ')}
                                onBlur={(e) => {
                                    const keywords = e.target.value
                                        .split(',')
                                        .map((k) => k.trim())
                                        .filter(Boolean);
                                    updateSettings({ redactedKeywords: keywords });
                                }}
                                placeholder="password, bank, secret"
                                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
                            />
                            <p className="text-[10px] text-[var(--muted-foreground)]/60 mt-1.5">
                                Applied at record time — redacted titles are never stored.
                            </p>
                        </div>

                        {/* Data Retention */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <CalendarClock size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Data Retention</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        How long activity history is kept
                                    </p>
                                </div>
                            </div>
                            <select
                                value={settings.retentionDays}
                                onChange={(e) => updateSettings({ retentionDays: Number(e.target.value) })}
                                className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] block p-2.5 outline-none cursor-pointer hover:bg-[var(--secondary)] transition-colors min-w-[130px]"
                            >
                                <option value={30}>30 days</option>
                                <option value={90}>90 days</option>
                                <option value={180}>180 days</option>
                                <option value={0}>Keep forever</option>
                            </select>
                        </div>

                        {/* Export Data */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[var(--muted)] transition-transform duration-200 group-hover:scale-110">
                                    <Download size={18} className="text-[var(--foreground)]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--foreground)]">Export Data</p>
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        Download your activity history as JSON or CSV
                                    </p>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleExport}>
                                Export
                            </Button>
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
                        Activity Tracker v{APP_VERSION} • Built with Tauri + React
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]/60 mt-1">
                        All data is stored locally. No information is uploaded to any server.
                    </p>
                </div>
            </div >
        </div >
    );
}
