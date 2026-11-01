import { describe, it, expect } from 'vitest';

/**
 * The layering rule from AGENTS.md §1.5: `invoke` belongs in `src/api/tauri.ts` and nowhere else, so a command rename
 * breaks one typed binding instead of a dozen call sites — and so each payload shape is written down once.
 *
 * Two files bypassed it (`TrayPopup.tsx`, `AppIcon.tsx`) for long enough that the rule started reading as advice, and a
 * mocked Tauri hides that at runtime. So the check reads the source — through Vite rather than the filesystem, because
 * the app's tsconfig deliberately has no Node types and a test is not a reason to hand every component `fs`.
 */
const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

const INVOKE_IMPORT = /from\s+'@tauri-apps\/api\/core'/;

describe('API boundary', () => {
    it('finds the sources it is meant to police', () => {
        // A glob that silently matched nothing would make the check below vacuous.
        expect(Object.keys(sources).length).toBeGreaterThan(50);
        expect(Object.keys(sources)).toContain('/src/api/tauri.ts');
    });

    it('imports invoke only from src/api/tauri.ts', () => {
        const offenders = Object.entries(sources)
            .filter(([path]) => path !== '/src/api/tauri.ts')
            .filter(([path]) => !path.includes('/__tests__/') && !path.startsWith('/src/test/'))
            .filter(([, source]) => INVOKE_IMPORT.test(source))
            .map(([path]) => path);

        expect(offenders).toEqual([]);
    });
});
