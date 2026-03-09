import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'workload'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/index.ts',
        'node_modules/**',
      ],
      thresholds: {
        // Set reasonable initial thresholds — increase as coverage improves
        statements: 30,
        branches: 20,
        functions: 25,
        lines: 30,
      },
    },
  },
});
