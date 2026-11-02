import { describe, it, expect } from 'vitest';
import { statusLabel, statusDotColor, statusPulses } from '../trackingStatus';

describe('statusLabel', () => {
    it('reports PAUSED even when the idle query still says idle', () => {
        // The footer used to render "IDLE" for a stopped loop, which read as "recording, nothing happening".
        expect(statusLabel(false, true)).toBe('PAUSED');
        expect(statusLabel(false, false)).toBe('PAUSED');
    });

    it('separates idle from tracking only while the loop runs', () => {
        expect(statusLabel(true, true)).toBe('IDLE');
        expect(statusLabel(true, false)).toBe('TRACKING');
    });
});

describe('status dot', () => {
    it('never lets a paused app look live', () => {
        expect(statusPulses(false, false)).toBe(false);
        expect(statusPulses(false, true)).toBe(false);
        expect(statusPulses(true, false)).toBe(true);
        expect(statusPulses(true, true)).toBe(false);
    });

    it('uses the muted lead when stopped, the focus accent only while recording', () => {
        expect(statusDotColor(false)).toBe('var(--muted-foreground)');
        expect(statusDotColor(true)).toBe('var(--accent-focus)');
    });
});
