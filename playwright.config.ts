import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: [
    {
      command: 'node --import tsx apps/server/src/main.ts',
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
      env: {
        GUEST_SESSION_SIGNING_SECRET: 'browser-test-secret-at-least-32-characters',
        GAME_SERVER_PORT: '2568',
        COUNTDOWN_SECONDS: '3',
        CLIENT_ORIGIN: 'http://localhost:5174',
        DEV_BOT_COUNT: '0',
      },
      url: 'http://127.0.0.1:2568/health',
    },
    {
      command: 'node node_modules/vite/bin/vite.js apps/client --host 127.0.0.1 --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
      env: { VITE_GAME_SERVER_URL: 'ws://127.0.0.1:2568' },
    },
  ],
});
