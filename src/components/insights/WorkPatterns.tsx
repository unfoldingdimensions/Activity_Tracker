import React, { useMemo } from 'react';
import { useAppUsage } from '../../hooks/useTrackerData';

/**
 * Work patterns band: app diversity + cognitive load as hairline bars,
 * plus a one-line data-derived summary. The input-intensity heatmap lives
 * in its own InputIntensity component (same band position on both skins).
 */
export const WorkPatterns: React.FC = () => {
    const { data: appUsage } = useAppUsage();

    // Compute diversity and cognitive load from the raw app usage (last 24h)
    const { diversityIndex, cognitiveLoad } = useMemo(() => {
        if (!appUsage || appUsage.length === 0) {
            return { diversityIndex: 0, cognitiveLoad: 'Low' as const };
        }
        const diversity = Math.min(12, appUsage.length);
        const totalSeconds = appUsage.reduce((sum, app) => sum + (app.seconds || 0), 0) || 1;
        const topShare = appUsage[0] ? (appUsage[0].seconds || 0) / totalSeconds : 0;
        const load = topShare > 0.75 ? 'High' : topShare > 0.45 ? 'Medium' : 'Low';
        return { diversityIndex: diversity, cognitiveLoad: load };
    }, [appUsage]);

    const topApp = appUsage && appUsage.length > 0 ? appUsage[0].name.replace(/\.exe$/i, '') : null;

    const loadColor =
        cognitiveLoad === 'High'
            ? 'var(--accent-negative)'
            : cognitiveLoad === 'Medium'
              ? 'var(--accent-warning)'
              : 'var(--accent-focus)';

    return (
        <div>
            <div className="flex items-baseline justify-between">
                <h3 className="section-title text-[var(--foreground)]">Work patterns</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">DIVERSITY & LOAD</span>
            </div>
            <div className="mt-5 space-y-4 max-w-[420px]">
                <div>
                    <div className="flex justify-between text-[12.5px]">
                        <span className="text-[var(--muted-foreground)]">App diversity</span>
                        <span className="font-mono font-bold text-[var(--foreground)]">{diversityIndex} apps</span>
                    </div>
                    <div className="mt-2 h-[3px] bg-[var(--border)]">
                        <div className="h-full" style={{ width: `${Math.min(100, diversityIndex * 15)}%`, backgroundColor: 'var(--foreground)', opacity: 0.6 }} />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-[12.5px]">
                        <span className="text-[var(--muted-foreground)]">Cognitive load</span>
                        <span className="font-mono font-bold" style={{ color: loadColor }}>
                            {cognitiveLoad}
                        </span>
                    </div>
                    <div className="mt-2 h-[3px] bg-[var(--border)]">
                        <div
                            className="h-full"
                            style={{
                                width: cognitiveLoad === 'High' ? '80%' : cognitiveLoad === 'Medium' ? '50%' : '20%',
                                backgroundColor: loadColor,
                            }}
                        />
                    </div>
                </div>
                {topApp && (
                    <p className="text-[12.5px] leading-relaxed text-[var(--muted-foreground)] pt-1">
                        {diversityIndex} distinct apps in the last 24 hours — {topApp} leads.
                    </p>
                )}
            </div>
        </div>
    );
};
