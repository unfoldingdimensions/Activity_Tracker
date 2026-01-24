
import { useMemo } from 'react';
import { useInputHistory, useIdleStatus } from './useTrackerData';

export interface WellbeingMetrics {
    typingFatigue: number; // 0-100%
    sedentaryMinutes: number;
    timeSinceLastBreak: number; // minutes
    needsBreak: boolean;
    eyeStrainProgress: number; // 0-100% (based on 20 min cycle)
}

export function useWellbeing() {
    const { data: inputHistory } = useInputHistory(1, true);
    const { data: idleStatus } = useIdleStatus();

    const metrics: WellbeingMetrics = useMemo(() => {
        if (!inputHistory || !idleStatus) {
            return {
                typingFatigue: 0,
                sedentaryMinutes: 0,
                timeSinceLastBreak: 0,
                needsBreak: false,
                eyeStrainProgress: 0
            };
        }

        // 1. Sedentary / Break Analysis
        // We look backwards from now to find the last gap > 5 minutes (a "break")
        // Note: This logic assumes inputHistory is sorted ascending (usually is from API)
        // If we want "Time since last break", we iterate backwards.

        // This is a simplified "Session" timer.
        let minutesSinceBreak = 0;
        // Reversed iteration to find last break
        for (let i = inputHistory.length - 1; i >= 0; i--) {
            const bucket = inputHistory[i];
            const activity = (bucket.keystrokes || 0) + (bucket.mouse_clicks || 0);

            // If < 5 inputs in a minute, considers it a "micro break" or idle
            // But for a REAL break, we want a block of inactivity. 
            // Let's count consecutive active minutes.
            if (activity > 5) {
                minutesSinceBreak++;
            } else {
                // If we hit an inactive block, stop? 
                // A break should be significant (e.g. > 1 min). 
                // For this simple metric, let's just count continuous active minutes.
                break;
            }
        }

        // 2. Typing Fatigue
        // Based on sustained high intensity.
        // If average inputs > 50 for last 30 mins -> High Fatigue.
        let recentInputs = 0;
        const fatigueWindow = 30;
        const recentBuckets = inputHistory.slice(-fatigueWindow);
        recentBuckets.forEach(b => recentInputs += (b.keystrokes || 0));

        // Max inputs in 30 mins approx 30 * 100 = 3000 ? 
        // Let's normalized: Avg > 40 per min = 100% fatigue
        const avgFatigueInputs = recentBuckets.length > 0 ? recentInputs / recentBuckets.length : 0;
        const typingFatigue = Math.min(100, (avgFatigueInputs / 40) * 100);

        // 3. Eye Strain (20-20-20 Rule)
        // Every 20 minutes.
        const eyeStrainProgress = ((minutesSinceBreak % 20) / 20) * 100;

        return {
            typingFatigue: Math.round(typingFatigue),
            sedentaryMinutes: minutesSinceBreak, // Using continuous active time as proxy for sedentary sans-break
            timeSinceLastBreak: minutesSinceBreak,
            needsBreak: minutesSinceBreak > 50 || typingFatigue > 80,
            eyeStrainProgress
        };
    }, [inputHistory, idleStatus]);

    return metrics;
}
