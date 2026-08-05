/**
 * Toast notification component and hook
 * Provides user feedback for async operations
 */

import { useState, useCallback, createContext, useContext, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============ Types ============

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    showToast: (type: ToastType, message: string, duration?: number) => void;
    dismissToast: (id: string) => void;
}

// ============ Context ============

const ToastContext = createContext<ToastContextValue | null>(null);

// ============ Provider ============

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    // Cleanup all timeouts on unmount
    useEffect(() => {
        // Copy the ref value: the Set instance itself never changes, and this
        // avoids the stale-ref warning on the cleanup function.
        const timeoutIds = timeoutIdsRef.current;
        return () => {
            timeoutIds.forEach(id => clearTimeout(id));
            timeoutIds.clear();
        };
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (type: ToastType, message: string, duration = 4000) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const toast: Toast = { id, type, message, duration };

            setToasts((prev) => [...prev, toast]);

            // Auto-dismiss after duration
            if (duration > 0) {
                const timeoutId = setTimeout(() => {
                    dismissToast(id);
                }, duration);
                timeoutIdsRef.current.add(timeoutId);
            }
        },
        [dismissToast]
    );

    return (
        <ToastContext.Provider value={{ showToast, dismissToast }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
}

// ============ Hook ============

// Context modules intentionally pair the provider with its hook in one file
// (idiomatic React). Fast refresh is sacrificed for this module, which is
// acceptable in a desktop app (no remote HMR loop).
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// ============ Toast Container ============

function ToastContainer({
    toasts,
    onDismiss,
}: {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
}

// ============ Toast Item ============

const TOAST_ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
} as const;

const TOAST_COLORS = {
    success: 'bg-[var(--accent-focus)]/10 border-[var(--accent-focus)]/30 text-[var(--accent-focus)]',
    error: 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]',
    warning: 'bg-[var(--accent-warning)]/10 border-[var(--accent-warning)]/30 text-[var(--accent-warning)]',
    info: 'bg-[var(--muted)]/60 border-[var(--border)] text-[var(--muted-foreground)]',
} as const;

function ToastItem({
    toast,
    onDismiss,
}: {
    toast: Toast;
    onDismiss: (id: string) => void;
}) {
    const Icon = TOAST_ICONS[toast.type];
    const colorClass = TOAST_COLORS[toast.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg max-w-sm ${colorClass}`}
        >
            <Icon size={20} className="shrink-0" />
            <p className="text-sm text-(--foreground) flex-1">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded hover:bg-(--secondary) transition-colors"
            >
                <X size={14} className="text-(--muted-foreground)" />
            </button>
        </motion.div>
    );
}
