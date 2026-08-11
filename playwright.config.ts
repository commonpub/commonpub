import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/reference/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Answer the cookie banner for every spec. On an instance with analytics
    // configured it is fixed to the bottom of the viewport and intercepts
    // clicks on whatever is under it, so without this every spec would be
    // partly testing the banner. 'essential' dismisses it without opting the
    // run into a third-party tag. analytics-consent.spec.ts deliberately
    // overrides this back to an empty state to test the gate itself.
    storageState: './apps/reference/e2e/helpers/consent-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @commonpub/reference dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
