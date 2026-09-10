import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --import tsx apps/server/src/main.ts',
      url: 'http://127.0.0.1:2567/health',
      reuseExistingServer: false,
      env: {
        GUEST_SESSION_SIGNING_SECRET: 'browser-test-secret-at-least-32-characters',
        COUNTDOWN_SECONDS: '3',
        CLIENT_ORIGIN: 'http://localhost:5173',
        DEV_BOT_COUNT: '0',
      },
    },
    {
      command: 'node node_modules/vite/bin/vite.js apps/client --host 127.0.0.1',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
  ],
});
