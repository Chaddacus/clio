const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e/tests',
  // production-sweep.spec.js drives the live production deployment
  // (https://clio.chadacus.dev) and registers real accounts on it. testIgnore
  // removes it at discovery, so this config cannot run it at all, not even when
  // the file is named on the command line. That is deliberate: no env var can
  // turn it back on in CI. To run it by hand, point Playwright at a separate
  // config (`npx playwright test -c <config>`) that does not ignore it.
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
