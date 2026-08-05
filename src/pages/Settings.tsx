import { Button } from '../components/Button';
import { Settings as SettingsIcon, Moon, Sun, Play, Pause, Download } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '../context/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { isTauri } from '../utils/isTauri';
import { startTracking, stopTracking, clearData, isTracking as fetchTrackingState, exportData } from '../api/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/ui/Toast';
import { APP_VERSION } from '../constants/config';
import { SegTabs } from '../components/ui/SegTabs';
import { Toggle } from '../components/ui/Toggle';
import { Chip } from '../components/ui/Chip';
import { Bar } from '../components/ui/Bar';
import { cn } from '../utils/cn';
import type { TimeRange } from '../components/dashboard/TimeRangeFilter';
import { useAppUsage } from '../hooks/useTrackerData';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';

/* ------------------------------------------------------------------ */
/* Section shell: flat = ruled two-column band, glass = GlassCard      */
/* ------------------------------------------------------------------ */

function Section({ title, desc, icon, children }: { title: string; desc: string; icon?: ReactNode; children: ReactNode }) {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    // Same two-column ruled structure on both skins; glass wraps it in a card.
    const shell = isFlat ? 'grid grid-cols-[232px_1fr]' : 'grid grid-cols-[232px_1fr] w-full';
    return (
        <div className={isFlat ? '' : cn('widget rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 backdrop-blur-md px-6 py-5')}>
            <div className={shell}>
                <div className="py-2 pr-6 border-r border-[var(--border)]">
                    <div className="flex items-center gap-2">
                        {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
                        <h3 className="section-title text-[var(--foreground)]">{title}</h3>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-[var(--muted-foreground)] mt-1.5">{desc}</p>
                </div>
                <div className="py-1 pl-6">{children}</div>
            </div>
        </div>
    );
}

/* Control row: label + control on a hairline rule (both skins) */
function Row({
    label,
    caption,
    control,
    destructive,
}: {
    label: ReactNode;
    caption?: string;
    control: ReactNode;
    destructive?: boolean;
}) {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    return (
        <div
            className={cn(
                'flex items-center justify-between gap-6 py-3 border-b border-[var(--border)] last:border-b-0',
                !isFlat && 'border-[var(--border)]/70'
            )}
        >
            <div>
                <div
                    className={cn(
                        'font-semibold tracking-[-0.01em] text-[var(--foreground)] text-[13.5px]',
                        destructive && 'text-[var(--accent-negative)]'
                    )}
                >
                    {label}
                </div>
                {caption && <div className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{caption}</div>}
            </div>
            <div className="flex-shrink-0">{control}</div>
        </div>
    );
}

/** Flat-style text input (dashed underline in flat, rounded in glass) */
function TextField({
    value,
    onChange,
    onEnter,
    placeholder,
    ariaLabel,
    mono = false,
}: {
    value: string;
    onChange: (v: string) => void;
    onEnter?: () => void;
    placeholder?: string;
    ariaLabel?: string;
    mono?: boolean;
}) {
    const theme = useVisualTheme();
    if (theme === 'flat') {
        return (
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onEnter?.();
                }}
                placeholder={placeholder}
                aria-label={ariaLabel}
                className={cn(
                    'flex-1 bg-transparent border-b border-dashed border-[var(--border)] focus:border-[var(--foreground)] outline-none text-[var(--foreground)] py-1.5 transition-colors placeholder:text-[var(--muted-foreground)]/60',
                    mono ? 'font-mono text-[12px]' : 'text-[13.5px]'
                )}
            />
        );
    }
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') onEnter?.();
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg focus:ring-[var(--primary)] focus:border-[var(--primary)] px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
        />
    );
}

/** Flat: dashed "ADD" button; glass: secondary Button */
function AddButton({ onClick, children = 'Add' }: { onClick: () => void; children?: ReactNode }) {
    const theme = useVisualTheme();
    if (theme === 'flat') {
        return (
            <button
                onClick={onClick}
                className="px-3 py-1.5 border border-dashed border-[var(--border)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
                {children}
            </button>
        );
    }
    return (
        <Button variant="secondary" size="sm" onClick={onClick}>
            {children}
        </Button>
    );
}

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: 'past_hour', label: 'Hour' },
    { value: 'past_6h', label: '6h' },
    { value: 'past_12h', label: '12h' },
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'Week' },
    { value: 'this_month', label: 'Month' },
];

const CLASS_COLUMNS: { key: 'focus' | 'distraction' | 'ignore'; label: string; color: string }[] = [
    { key: 'focus', label: 'Focus', color: 'var(--accent-focus)' },
    { key: 'distraction', label: 'Distraction', color: 'var(--accent-warning)' },
    { key: 'ignore', label: 'Ignore', color: 'var(--foreground)' },
];

export function Settings() {
    const { theme, toggleTheme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const visualTheme = useVisualTheme();
    const isFlat = visualTheme === 'flat';
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
    const { data: appUsage } = useAppUsage();

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

    // Live usage for the distraction-guard bars (minutes used today per limited app)
    const usageFor = (name: string): number => {
        const entry = (appUsage ?? []).find((a) => a.name.toLowerCase().includes(name.toLowerCase()));
        return entry ? Math.round(entry.seconds / 60) : 0;
    };

    const classificationEntries = Object.entries(settings.appClassification);
    const limitEntries = Object.entries(settings.appLimits);

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader title="Settings" meta="TRACKING · APPEARANCE · PRIVACY" />

            <div
                className={cn(
                    isFlat
                        ? 'w-full px-8 pt-2 pb-10 divide-y divide-[var(--border)]'
                        : 'p-8 pt-6 space-y-6 flex-1 w-full'
                )}
            >
                {/* ============ Tracking status ============ */}
                <Section
                    title="Tracking status"
                    desc="Whether the app is collecting activity right now."
                    icon={isTracking ? <Play size={20} className="text-emerald-500" /> : <Pause size={20} className="text-[var(--muted-foreground)]" />}
                >
                    <Row
                        label="Capturing window, keystroke count and clicks"
                        caption={isFlat ? undefined : isTracking ? 'Recording your activity in the background' : 'Activity tracking is currently paused'}
                        control={
                            isFlat ? (
                                <Toggle checked={isTracking} onChange={handleTrackingToggle} label="Tracking status" />
                            ) : (
                                <Button
                                    variant={isTracking ? 'secondary' : 'primary'}
                                    size="sm"
                                    onClick={handleTrackingToggle}
                                    loading={isToggling}
                                    className="min-w-[100px]"
                                >
                                    {isTracking ? 'Pause' : 'Resume'}
                                </Button>
                            )
                        }
                    />
                    {isFlat && <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] pt-1.5">5S CADENCE</div>}
                </Section>

                {/* ============ General ============ */}
                <Section title="General" desc="How the app launches and behaves." icon={<SettingsIcon size={20} className="text-blue-500" />}>
                    <Row
                        label="Launch on startup"
                        caption="Start tracking automatically when you sign in"
                        control={<Toggle checked={settings.launchOnStartup} onChange={handleLaunchOnStartupToggle} label="Launch on startup" />}
                    />
                    <Row
                        label="Start minimised to tray"
                        caption="Hide the window on launch; keep running in the tray"
                        control={
                            <Toggle
                                checked={settings.startMinimized}
                                onChange={(v) => updateSettings({ startMinimized: v })}
                                label="Start minimised to tray"
                            />
                        }
                    />
                </Section>

                {/* ============ Tracking behaviour ============ */}
                <Section title="Tracking behaviour" desc="Idle detection, exclusions and title capture." icon={<SettingsIcon size={20} className="text-cyan-500" />}>
                    <Row
                        label="Idle threshold"
                        caption="Seconds without input before you count as idle"
                        control={
                            <div className="flex items-center gap-3 min-w-[200px]">
                                <input
                                    type="range"
                                    min={30}
                                    max={300}
                                    step={15}
                                    value={settings.idleThreshold}
                                    onChange={(e) => updateSettings({ idleThreshold: Number(e.target.value) })}
                                    className={cn('cursor-pointer', isFlat ? 'slider-flat flex-1' : 'flex-1 accent-[var(--primary)]')}
                                    aria-label="Idle threshold in seconds"
                                />
                                <span className="font-mono text-[12px] text-[var(--foreground)] w-10 text-right">
                                    {settings.idleThreshold}s
                                </span>
                            </div>
                        }
                    />
                    <Row
                        label="Blacklisted apps"
                        caption="Excluded from tracking entirely"
                        control={
                            <div className={cn('flex gap-2', isFlat ? 'flex-col items-stretch w-full gap-2' : 'w-full')}>
                                <div className="flex gap-2">
                                    <TextField
                                        value={blacklistInput}
                                        onChange={setBlacklistInput}
                                        onEnter={addToBlacklist}
                                        placeholder="e.g. chrome.exe or Chrome"
                                        ariaLabel="Blacklist app name"
                                        mono
                                    />
                                    <AddButton onClick={addToBlacklist}>Add</AddButton>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {settings.blacklistedApps.length === 0 ? (
                                        <span className="text-[12px] text-[var(--muted-foreground)]/60">No apps blacklisted.</span>
                                    ) : (
                                        settings.blacklistedApps.map((name) => (
                                            <Chip key={name} onRemove={() => removeFromBlacklist(name)}>
                                                {name}
                                            </Chip>
                                        ))
                                    )}
                                </div>
                            </div>
                        }
                    />
                    <Row
                        label="Record window titles"
                        caption="Store window titles for the timeline log"
                        control={
                            <Toggle
                                checked={settings.trackWindowTitles}
                                onChange={(v) => updateSettings({ trackWindowTitles: v })}
                                label="Record window titles"
                            />
                        }
                    />
                    <Row
                        label="Redact these keywords"
                        caption="Replaced with ••• at record time — never stored"
                        control={
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
                                aria-label="Redaction keywords"
                                className={cn(
                                    isFlat
                                        ? 'w-full bg-transparent border-b border-dashed border-[var(--border)] focus:border-[var(--foreground)] outline-none font-mono text-[12px] py-1.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60'
                                        : 'w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50'
                                )}
                            />
                        }
                    />
                </Section>

                {/* ============ App classification ============ */}
                <Section
                    title="App classification"
                    desc="Override how apps count toward your Focus Score. SET marks the active column."
                    icon={<SettingsIcon size={20} className="text-rose-500" />}
                >
                    {isFlat ? (
                        <>
                            <div className="grid grid-cols-[1fr_92px_116px_92px_30px] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] py-2 border-b border-[var(--border)]">
                                <span>App</span>
                                <span>Focus</span>
                                <span>Distraction</span>
                                <span>Ignore</span>
                                <span />
                            </div>
                            {classificationEntries.length === 0 && (
                                <div className="py-3 text-[12px] text-[var(--muted-foreground)]/60">
                                    No overrides yet — the built-in defaults apply.
                                </div>
                            )}
                            {classificationEntries.map(([name, cls]) => (
                                <div key={name} className="grid grid-cols-[1fr_92px_116px_92px_30px] items-center py-2.5 border-b border-[var(--border)] last:border-b-0">
                                    <span className="text-[13.5px] font-semibold text-[var(--foreground)] truncate pr-2">{name}</span>
                                    {CLASS_COLUMNS.map((col) => (
                                        <button
                                            key={col.key}
                                            onClick={() => setClassification(name, col.key)}
                                            className="text-left font-mono text-[10px] uppercase tracking-[0.08em] py-0.5"
                                            style={cls === col.key ? { color: col.color } : undefined}
                                            aria-label={`Set ${name} as ${col.label}`}
                                        >
                                            {cls === col.key ? (
                                                <span className="border-b-[1.5px] pb-0.5 font-bold" style={{ borderColor: col.color }}>
                                                    SET
                                                </span>
                                            ) : (
                                                <span className="text-[var(--muted-foreground)]">—</span>
                                            )}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => removeClassification(name)}
                                        aria-label={`Remove classification for ${name}`}
                                        className="text-[var(--muted-foreground)] hover:text-[var(--accent-negative)] transition-colors text-lg leading-none"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <TextField
                                    value={classInput}
                                    onChange={setClassInput}
                                    onEnter={addClassification}
                                    placeholder="App name, e.g. figma"
                                    ariaLabel="Classification app name"
                                    mono
                                />
                                <select
                                    value={classSelect}
                                    onChange={(e) => setClassSelect(e.target.value as 'focus' | 'distraction')}
                                    aria-label="Classification choice"
                                    className="bg-transparent border-b border-dashed border-[var(--border)] font-mono text-[12px] text-[var(--foreground)] py-1.5 outline-none cursor-pointer"
                                >
                                    <option value="focus">Focus</option>
                                    <option value="distraction">Distraction</option>
                                </select>
                                <AddButton onClick={addClassification}>Add</AddButton>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {classificationEntries.length > 0 && (
                                <div className="space-y-2">
                                    {classificationEntries.map(([name, cls]) => (
                                        <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                            <span className="text-sm font-medium text-[var(--foreground)] truncate mr-2">{name}</span>
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
                                        className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
                                    />
                                    <select
                                        value={classSelect}
                                        onChange={(e) => setClassSelect(e.target.value as 'focus' | 'distraction')}
                                        className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-2 outline-none cursor-pointer"
                                    >
                                        <option value="focus">Focus</option>
                                        <option value="distraction">Distraction</option>
                                    </select>
                                    <AddButton onClick={addClassification}>Add</AddButton>
                                </div>
                            </div>
                        </div>
                    )}
                </Section>

                {/* ============ Distraction guard ============ */}
                <Section
                    title="Distraction guard"
                    desc="Daily time limits per app — notified once when crossed."
                    icon={<SettingsIcon size={20} className="text-red-500" />}
                >
                    {isFlat ? (
                        <>
                            {limitEntries.length === 0 && (
                                <div className="py-3 text-[12px] text-[var(--muted-foreground)]/60">No limits set.</div>
                            )}
                            {limitEntries.map(([name, seconds]) => {
                                const used = usageFor(name);
                                const limitMin = Math.round(seconds / 60);
                                return (
                                    <div key={name} className="grid grid-cols-[160px_1fr_150px_30px] items-center gap-4 py-2.5 border-b border-[var(--border)] last:border-b-0">
                                        <span className="text-[13.5px] font-semibold text-[var(--foreground)] truncate">{name}</span>
                                        <Bar value={(used / Math.max(1, limitMin)) * 100} color="var(--accent-warning)" height="thin" />
                                        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                                            {used} / {limitMin} min
                                        </span>
                                        <button
                                            onClick={() => removeAppLimit(name)}
                                            aria-label={`Remove limit for ${name}`}
                                            className="text-[var(--muted-foreground)] hover:text-[var(--accent-negative)] transition-colors text-lg leading-none"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                            <div className="flex gap-2 pt-2">
                                <TextField
                                    value={limitInput}
                                    onChange={setLimitInput}
                                    onEnter={addAppLimit}
                                    placeholder="App name, e.g. chrome"
                                    ariaLabel="Limit app name"
                                    mono
                                />
                                <input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={limitMinutes}
                                    onChange={(e) => setLimitMinutes(Number(e.target.value))}
                                    aria-label="Daily limit in minutes"
                                    className="w-16 bg-transparent border-b border-dashed border-[var(--border)] font-mono text-[12px] text-[var(--foreground)] py-1.5 outline-none"
                                />
                                <span className="flex items-center font-mono text-[11px] text-[var(--muted-foreground)]">min</span>
                                <AddButton onClick={addAppLimit}>Add</AddButton>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {limitEntries.length > 0 && (
                                <div className="space-y-2">
                                    {limitEntries.map(([name, seconds]) => (
                                        <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                            <span className="text-sm font-medium text-[var(--foreground)] truncate mr-2">{name}</span>
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
                                        className="flex-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2 outline-none placeholder:text-[var(--muted-foreground)]/50"
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
                                    <AddButton onClick={addAppLimit}>Add</AddButton>
                                </div>
                            </div>
                        </div>
                    )}
                </Section>

                {/* ============ Dashboard & appearance ============ */}
                <Section
                    title="Dashboard & appearance"
                    desc="Reading mode, visual style, typography and theme."
                    icon={isDarkMode ? <Moon size={20} className="text-[var(--foreground)]" /> : <Sun size={20} className="text-[var(--foreground)]" />}
                >
                    <Row
                        label="Reading mode"
                        caption="Data leads with numbers; Editorial leads with a sentence"
                        control={<SegTabs options={[{ value: 'data', label: 'Data' }, { value: 'editorial', label: 'Editorial' }]} value={settings.readingMode} onChange={(v) => updateSettings({ readingMode: v })} />}
                    />
                    <Row
                        label="Write the summary sentence"
                        caption="Editorial mode narration under the lede"
                        control={
                            <Toggle
                                checked={settings.writeSummarySentence}
                                onChange={(v) => updateSettings({ writeSummarySentence: v })}
                                label="Write the summary sentence"
                            />
                        }
                    />
                    <Row
                        label="Visual style"
                        caption="Flat: hairline rules. Glassmorphism: the legacy cards."
                        control={
                            <SegTabs
                                options={[{ value: 'flat', label: 'Flat' }, { value: 'glass', label: 'Glassmorphism' }]}
                                value={settings.visualTheme}
                                onChange={(v) => updateSettings({ visualTheme: v })}
                            />
                        }
                    />
                    <Row
                        label="Font pair"
                        caption="Typography across the whole app"
                        control={
                            <SegTabs
                                options={[{ value: 'swiss', label: 'Swiss' }, { value: 'geist', label: 'Geist' }, { value: 'grotesk', label: 'Grotesk' }]}
                                value={settings.fontPair}
                                onChange={(v) => updateSettings({ fontPair: v })}
                            />
                        }
                    />
                    <Row
                        label="Default range"
                        caption="Initial range shown on the dashboard"
                        control={<SegTabs options={RANGE_OPTIONS} value={settings.dashboardDefaultRange} onChange={(v) => updateSettings({ dashboardDefaultRange: v })} />}
                    />
                    <Row
                        label="Dark mode"
                        caption="Switch between light and dark themes"
                        control={<Toggle checked={isDarkMode} onChange={toggleTheme} label="Dark mode" />}
                    />
                </Section>

                {/* ============ Privacy & data ============ */}
                <Section
                    title="Privacy & data"
                    desc="Everything stays local. Export or delete it any time."
                    icon={<SettingsIcon size={20} className="text-amber-500" />}
                >
                    <Row
                        label="Data retention"
                        caption="How long activity history is kept"
                        control={
                            <SegTabs
                                options={[
                                    { value: '30', label: '30d' },
                                    { value: '90', label: '90d' },
                                    { value: '180', label: '180d' },
                                    { value: '0', label: 'Forever' },
                                ]}
                                value={String(settings.retentionDays)}
                                onChange={(v) => updateSettings({ retentionDays: Number(v) })}
                            />
                        }
                    />
                    <Row
                        label="Export history"
                        caption="Download everything as JSON or CSV"
                        control={
                            isFlat ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExport}
                                        className="px-3 py-1.5 border border-[var(--border)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                    >
                                        JSON / CSV
                                    </button>
                                </div>
                            ) : (
                                <Button variant="secondary" size="sm" onClick={handleExport}>
                                    <Download size={14} className="mr-1" /> Export
                                </Button>
                            )
                        }
                    />
                    <Row
                        label="Clear all activity history"
                        caption="Deletes every record and restores defaults"
                        destructive
                        control={
                            isFlat ? (
                                <button
                                    onClick={handleClearData}
                                    disabled={isClearing}
                                    className="px-3 py-1.5 border border-[var(--accent-negative)] text-[var(--accent-negative)] font-mono text-[10px] uppercase tracking-[0.08em] hover:bg-[var(--accent-negative)] hover:text-white transition-colors disabled:opacity-60"
                                >
                                    {isClearing ? 'Deleting…' : 'Delete everything'}
                                </button>
                            ) : (
                                <Button variant="destructive" size="sm" onClick={handleClearData} loading={isClearing}>
                                    Clear Data
                                </Button>
                            )
                        }
                    />
                </Section>

                {/* About */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-xs text-[var(--muted-foreground)]">
                        Activity Tracker v{APP_VERSION} • Built with Tauri + React
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)]/60 mt-1">
                        All data is stored locally. No information is uploaded to any server.
                    </p>
                </div>
            </div>
        </div>
    );
}
