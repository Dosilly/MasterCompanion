import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  timeout: 20_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 100 },
  },
  // A normal run must fail on missing baselines rather than silently accepting them.
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{testFilePath}/{arg}{ext}',
  outputDir: '.local/ui-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.local/ui-report', open: 'never' }],
    ['json', { outputFile: '.local/ui-run.json' }],
  ],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4310',
    locale: 'pl-PL',
    timezoneId: 'UTC',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'fullhd-light',
      use: { viewport: { width: 1920, height: 1080 }, colorScheme: 'light' },
    },
    { name: 'fullhd-dark', use: { viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' } },
    { name: 'scaled-light', use: { viewport: { width: 1536, height: 864 }, colorScheme: 'light' } },
    { name: 'scaled-dark', use: { viewport: { width: 1536, height: 864 }, colorScheme: 'dark' } },
  ],
  webServer: {
    command: 'node tools/ui-server.mjs',
    url: 'http://127.0.0.1:4310',
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
