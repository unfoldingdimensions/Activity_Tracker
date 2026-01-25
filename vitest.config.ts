import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['node_modules', 'dist', 'src-tauri'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                'src-tauri/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types/',
            ],
            include: ['src/**/*.{ts,tsx}'],
            thresholds: {
                // Critical paths focus - start with reasonable baseline
                statements: 50,
                branches: 40,
                functions: 50,
                lines: 50,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
