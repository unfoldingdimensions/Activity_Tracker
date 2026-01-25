/**
 * Smoke test to verify testing infrastructure is working
 * This file can be deleted after Phase 1 verification
 */

import { describe, it, expect } from 'vitest';

describe('Testing Infrastructure', () => {
    it('vitest is configured correctly', () => {
        expect(true).toBe(true);
    });

    it('can do basic math', () => {
        expect(1 + 1).toBe(2);
    });

    it('has access to DOM matchers', () => {
        const element = document.createElement('div');
        element.textContent = 'Hello, World!';
        document.body.appendChild(element);

        expect(element).toBeInTheDocument();
        expect(element).toHaveTextContent('Hello, World!');

        document.body.removeChild(element);
    });
});
