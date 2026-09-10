import { defineConfig } from 'vitest/config';
import { loadEnvironment } from './apps/server/src/config/environment.js';

loadEnvironment();

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
