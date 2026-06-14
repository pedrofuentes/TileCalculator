import { defineConfig } from 'vitest/config';

// Unit/integration tests run in a Node environment — the pure pipeline
// (units, geometry, calc, normalize, storage, compute) needs no DOM.
// Browser-level checks live in `e2e/` and run under Playwright instead.
//
// Coverage is measured only for that pure pipeline; the React/SVG rendering
// layer (render/**, components/**, App.tsx, main.tsx) is intentionally excluded
// because it is exercised by the Playwright e2e smoke tests, not unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'src/units.ts',
        'src/compute.ts',
        'src/geometry/**/*.ts',
        'src/calc/**/*.ts',
        'src/state/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // High bar on the pure pipeline. Set just below the achieved numbers
      // (~99% lines / 93% branch) so the gate catches regressions — new
      // untested logic in this layer — without flaking on unchanged code.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
