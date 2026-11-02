import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Activity,
    Zap,
    Settings,
    Clock,
    Wrench,
} from 'lucide-react';
import { useActiveWindow, useIdleStatus } from '../hooks/useTrackerData';
import { useTrackingControl } from '../hooks/useTrackingControl';
import { useRecorderHealth } from '../hooks/useRecorderHealth';
import { describeSampleAge } from '../utils/recorderHealth';
import { formatAppName } from '../utils/formatters';
import { AppIcon } from './shared/AppIcon';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { StatusDot } from './ui/StatusDot';
import { statusLabel, statusDotColor, statusPulses } from '../utils/trackingStatus';
import { cn } from '../utils/cn';

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/timeline', icon: Clock, label: 'Timeline' },
    { to: '/activity', icon: Activity, label: 'Activity' },
    { to: '/power', icon: Zap, label: 'Power' },
    { to: '/tools', icon: Wrench, label: 'Tools', isNew: true },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';
    const { data: activeWindow } = useActiveWindow();
    const { data: idleStatus } = useIdleStatus();
    const { isTracking, isBusy, setTracking } = useTrackingControl();
    const { secondsAgo } = useRecorderHealth(isTracking);
    const sample = describeSampleAge(secondsAgo);

    useEffect(() => {
        const unlisten = listen<{ path: string }>('navigate', (event) => {
            console.log('[DEBUG] Navigation event received:', event.payload);
            navigate(event.payload.path);
        });
        return () => {
            unlisten.then((f) => f());
        };
    }, [navigate]);

    // Get current app name (strip .exe and capitalize)
    const currentApp = activeWindow?.process_name ? formatAppName(activeWindow.process_name) : 'Unknown';
    const currentTitle = activeWindow?.window_title || '';
    const isIdle = idleStatus?.isIdle || false;
    const status = statusLabel(isTracking, isIdle);

    return (
        <div className="flex h-screen overflow-hidden relative bg-[var(--background)]">
            {/* Skip link: keyboard users can jump past the rail */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:bg-[var(--foreground)] focus:text-[var(--background)]"
            >
                Skip to content
            </a>

            {/* Legacy background effects only for the glass skin */}
            {!isFlat && (
                <>
                    <div className="landing-orb landing-orb-1" />
                    <div className="landing-orb landing-orb-2" />
                    <div className="noise-overlay" />
                </>
            )}

            {/* Rail / Sidebar */}
            <aside
                className={cn(
                    'flex-shrink-0 flex flex-col z-10',
                    isFlat ? 'w-[196px] border-r border-[var(--border)] bg-[var(--background)]' : 'sidebar w-48'
                )}
            >
                {isFlat ? (
                    <>
                        {/* Brand */}
                        <div className="px-[22px] pb-[22px] pt-[26px]">
                            <h1 className="text-[13px] font-bold tracking-[-0.01em] text-[var(--foreground)]">
                                Activity Tracker
                            </h1>
                            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-[5px]">
                                track · visualize
                            </div>
                        </div>

                        {/* Navigation - text only, active = 2px left rule */}
                        <nav className="flex flex-col gap-px">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.to;
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={cn(
                                            'flex items-center gap-2 px-[22px] py-[9px] text-[13px] tracking-[-0.01em] border-l-2 transition-colors',
                                            isActive
                                                ? 'border-[var(--foreground)] font-bold text-[var(--foreground)]'
                                                : 'border-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
                                        )}
                                    >
                                        <span>{item.label}</span>
                                        {item.isNew && (
                                            <span className="font-mono text-[9px] tracking-[0.08em] px-[4px] py-[2px] border border-[var(--border)] text-[var(--accent-focus)]">
                                                NEW
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </nav>

                        {/* Footer - live tracking status + the control that changes it */}
                        <div className="mt-auto px-[22px] pt-[14px] pb-5 border-t border-[var(--border)]">
                            <div className="flex items-center gap-2">
                                <StatusDot
                                    color={statusDotColor(isTracking)}
                                    pulsing={statusPulses(isTracking, isIdle)}
                                />
                                <span className="font-mono text-[10.5px] tracking-[0.06em] text-[var(--muted-foreground)]">
                                    {status}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void setTracking(!isTracking)}
                                    disabled={isBusy}
                                    className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.08em] px-2 py-[3px] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-50"
                                    title={isTracking ? 'Stop recording activity' : 'Start recording activity'}
                                >
                                    {isTracking ? 'Pause' : 'Resume'}
                                </button>
                            </div>
                            {isTracking ? (
                                <>
                                    <div className="font-mono text-[10.5px] font-bold text-[var(--foreground)] mt-2 truncate">
                                        {currentApp}
                                    </div>
                                    {currentTitle && (
                                        <div className="font-mono text-[9.5px] text-[var(--muted-foreground)] mt-1 truncate">
                                            {currentTitle}
                                        </div>
                                    )}
                                    <div
                                        className="font-mono text-[9px] uppercase tracking-[0.06em] mt-1.5"
                                        style={{ color: sample.stale ? 'var(--accent-warning)' : 'var(--muted-foreground)' }}
                                        title="Age of the newest recorded second — evidence, not a status flag"
                                    >
                                        last sample {sample.label}
                                    </div>
                                </>
                            ) : (
                                <div className="font-mono text-[9.5px] text-[var(--muted-foreground)] mt-2">
                                    Not recording
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Logo */}
                        <div className="p-6 border-b border-[var(--border)]">
                            <h1 className="font-display text-xl font-bold text-[var(--foreground)]">
                                Activity Tracker
                            </h1>
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                Track • Visualize • Improve
                            </p>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 p-4 space-y-1 stagger-children">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.to;
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={cn(
                                            'group nav-item flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-[var(--duration-fast)]',
                                            isActive
                                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] nav-active'
                                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                        )}
                                    >
                                        <item.icon
                                            size={20}
                                            className={cn(
                                                'transition-transform duration-[var(--duration-fast)]',
                                                isActive ? '' : 'group-hover:scale-110'
                                            )}
                                        />
                                        <span className="font-medium">{item.label}</span>
                                        {item.isNew && (
                                            <span className="font-mono text-[9px] tracking-[0.08em] px-[4px] py-[2px] border border-[var(--border)] rounded text-[var(--accent-focus)]">
                                                NEW
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </nav>

                        {/* Footer - Live Status */}
                        <div className="p-4 border-t border-[var(--border)]">
                            <div className="card p-3 space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="status-indicator">
                                        <div
                                            className="status-dot"
                                            style={{
                                                backgroundColor: isTracking ? undefined : 'var(--muted-foreground)',
                                            }}
                                        />
                                        {statusPulses(isTracking, isIdle) && <div className="status-ring" />}
                                    </div>
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                        {isTracking ? (isIdle ? 'Idle' : 'Tracking Active') : 'Paused'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void setTracking(!isTracking)}
                                        disabled={isBusy}
                                        className="ml-auto px-2 py-1 text-[10px] font-bold rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-50"
                                        title={isTracking ? 'Stop recording activity' : 'Start recording activity'}
                                    >
                                        {isTracking ? 'Pause' : 'Resume'}
                                    </button>
                                </div>
                                {isTracking ? (
                                    <div className="text-xs text-[var(--muted-foreground)] truncate flex items-center gap-2">
                                        <AppIcon processName={activeWindow?.process_name || ''} size={14} className="opacity-80" />
                                        <span className="text-[var(--foreground)] font-bold font-display">{currentApp}</span>
                                    </div>
                                ) : (
                                    <div className="text-xs text-[var(--muted-foreground)]">Not recording</div>
                                )}
                                {isTracking && (
                                    <div
                                        className="text-[10px] font-mono uppercase tracking-wide"
                                        style={{ color: sample.stale ? 'var(--accent-warning)' : 'var(--muted-foreground)' }}
                                    >
                                        last sample {sample.label}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </aside>

            {/* Main Content */}
            <main id="main-content" className="flex-1 overflow-y-auto relative z-10 scroll-smooth h-screen">
                <Outlet />
            </main>
        </div>
    );
}
