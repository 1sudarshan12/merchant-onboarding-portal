import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['mock-api/**/*.spec.ts', 'shared/**/*.spec.ts'],
    restoreMocks: true,
  },
});
