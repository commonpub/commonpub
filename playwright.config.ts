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
    // In CI, serve the PRODUCTION build (the e2e job runs `pnpm build` first)
    // instead of `nuxt dev`. Dev-mode on-demand Vite compilation made the FIRST
    // homepage navigation take >15s on a cold runner, so the first test's
    // `waitFor('.cpub-tab' / '.cpub-hero-banner', 15s)` timed out — and with
    // `workers: 1` in CI the first test always ate that cold compile (later
    // tests ran warm and passed). A prebuilt Nitro server serves pre-compiled
    // pages instantly, removing the race. Locally keep `nuxt dev` (and reuse an
    // already-running dev server) for fast iteration.
    command: process.env.CI
      ? 'pnpm --filter @commonpub/reference exec nuxt preview'
      : 'pnpm --filter @commonpub/reference dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
