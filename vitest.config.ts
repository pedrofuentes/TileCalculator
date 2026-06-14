import { defineConfig } from 'vitest/config';

// Unit/integration tests run in a Node environment — the pure pipeline
// (units, geometry, calc, normalize, storage, compute) needs no DOM.
// Browser-level checks live in `e2e/` and run under Playwright instead.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
