import { useState, useEffect, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../utils/isTauri';

// Memory cache to avoid repeated invokes for the same process
const iconCache: Record<string, string> = {};

interface AppIconProps {
    processName: string;
    className?: string;
    size?: number;
    fallbackText?: string;
}

export const AppIcon = memo(function AppIcon(props: AppIconProps) {
    // Keying by processName remounts the inner component whenever the app
    // changes, so its state starts fresh from the cache (no reset needed
    // inside an effect, which react-hooks v7 forbids).
    return <AppIconInner key={props.processName} {...props} />;
});

function AppIconInner({ processName, className = '', size = 24, fallbackText }: AppIconProps) {
    const [iconData, setIconData] = useState<string | null>(() => iconCache[processName] || null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!processName) return;

        // Cache hit: initial state already used it; nothing to do.
        if (iconCache[processName]) return;

        let isMounted = true;

        async function fetchIcon() {
            // Browser dev mode has no Tauri icon backend; keep the letter tile.
            if (!isTauri()) return;
            try {
                const data = await invoke<string | null>('get_app_icon', { processName });
                if (data && isMounted) {
                    iconCache[processName] = data;
                    setIconData(data);
                } else if (isMounted) {
                    setError(true);
                }
            } catch (err) {
                console.error('Failed to fetch icon:', err);
                if (isMounted) setError(true);
            }
        }

        fetchIcon();

        return () => {
            isMounted = false;
        };
    }, [processName]);

    // Fallback UI (First letter of app name in a colored box)
    const renderFallback = () => {
        const char = fallbackText?.charAt(0) || processName?.charAt(0) || '?';
        return (
            <div
                className={`flex items-center justify-center rounded bg-secondary font-bold text-muted-foreground ${className}`}
                style={{ width: size, height: size, fontSize: size * 0.6 }}
            >
                {char.toUpperCase()}
            </div>
        );
    };

    if (error || !iconData) {
        return renderFallback();
    }

    return (
        <img
            src={iconData}
            alt={processName}
            className={`rounded shadow-sm ${className}`}
            style={{ width: size, height: size, objectFit: 'contain' }}
            onError={() => setError(true)}
        />
    );
}
