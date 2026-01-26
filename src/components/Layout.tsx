import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Activity,
    Zap,
    Settings,
    Clock,
} from 'lucide-react';
import { useActiveWindow, useIdleStatus } from '../hooks/useTrackerData';
import { formatAppName } from '../utils/formatters';
import { AppIcon } from './shared/AppIcon';

import { AnimatePresence, motion } from 'framer-motion';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/timeline', icon: Clock, label: 'Timeline' },
    { to: '/activity', icon: Activity, label: 'Activity' },
    { to: '/power', icon: Zap, label: 'Power' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
    const location = useLocation();
    const { data: activeWindow } = useActiveWindow();
    const { data: idleStatus } = useIdleStatus();

    // Get current app name (strip .exe and capitalize)
    const currentApp = activeWindow?.process_name ? formatAppName(activeWindow.process_name) : 'Unknown';
    const isIdle = idleStatus?.isIdle || false;

    return (
        <div className="flex h-screen overflow-hidden relative bg-[var(--background)]">
            {/* Background Orbs */}
            <div className="landing-orb landing-orb-1" />
            <div className="landing-orb landing-orb-2" />
            <div className="noise-overlay" />

            {/* Sidebar */}
            <aside className="sidebar w-64 flex-shrink-0 flex flex-col z-10">
                {/* Logo */}
                <div className="p-6 border-b border-[var(--border)]">
                    <h1 className="font-display text-xl font-bold text-[var(--foreground)] animate-fade-in">
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
                                className={`
                  group nav-item flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors duration-[var(--duration-fast)]
                  ${isActive
                                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] nav-active'
                                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                    }
                `}
                            >
                                <item.icon
                                    size={20}
                                    className={`
                    transition-transform duration-[var(--duration-fast)]
                    ${isActive ? '' : 'group-hover:scale-110'}
                  `}
                                />
                                <span className="font-medium">{item.label}</span>
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
                                    style={{ backgroundColor: isIdle ? 'var(--muted-foreground)' : undefined }}
                                />
                                {!isIdle && <div className="status-ring" />}
                            </div>
                            <span className="text-xs text-[var(--muted-foreground)]">
                                {isIdle ? 'Idle' : 'Tracking Active'}
                            </span>
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] truncate flex items-center gap-2">
                            <AppIcon processName={activeWindow?.process_name || ''} size={14} className="opacity-80" />
                            <span className="text-[var(--foreground)] font-bold font-display">{currentApp}</span>
                        </div>

                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10 scroll-smooth h-screen">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="min-h-full"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
