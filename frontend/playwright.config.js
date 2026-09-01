const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e/tests',
  // production-sweep.spec.js drives the live production deployment
  // (https://clio.chadacus.dev) and registers real accounts on it. It is a
  // hand-run smoke tool, so it is excluded from every automated run rather
  // than gated on an env var that CI could flip.
  testIgnore: /production-sweep\.spec\.js/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3011',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'docker compose up',
    url: 'http://localhost:3011',
    reuseExistingServer: true,
    timeout: 180 * 1000,
  },
});
