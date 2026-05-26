import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      reportsDirectory: 'coverage',
    },
  },
});
