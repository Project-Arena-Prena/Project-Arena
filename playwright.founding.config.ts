import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.FOUNDING_TEST_PORT ?? 3215);
const baseURL = 'http://127.0.0.1:' + port;
export default defineConfig({
  testDir: './tests/founding', testMatch: '**/*.spec.ts',
  fullyParallel: false, workers: 1, forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0, timeout: 120_000,
  expect: { timeout: 20000 },
  reporter: [['list'], ['html', { outputFolder: 'founding-playwright-report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next dev --webpack -p ' + port,
    url: baseURL, reuseExistingServer: !process.env.CI, timeout: 180000,
    stdout: 'pipe', stderr: 'pipe',
  },
});
