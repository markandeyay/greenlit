import { defineConfig, devices } from '@playwright/test';

// The e2e suite runs against a production build (`next build` + `next start`) by default, so the
// leak test sees the real JS chunks and pages render without dev-mode compile delays.
// E2E_DEV=1 runs against `next dev` instead (faster iteration, no build).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const DEV = process.env.E2E_DEV === '1';
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'list' : [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testIgnore: /leak\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      testIgnore: /leak\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true },
    },
    // Phase 1 exit criterion (Section 13): the answer never reaches the client before the reveal.
    { name: 'leak', testMatch: /leak\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: DEV ? `pnpm dev --port ${PORT}` : `pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/api/today`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
