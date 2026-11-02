import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/e2e/.artifacts/results.json' }],
  ],
  outputDir: 'tests/e2e/.artifacts/run',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
