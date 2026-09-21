import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  globalTimeout: 270000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: './test-results',
  reporter: [['list']],
  expect: {
    timeout: 8000,
  },
  use: {
    baseURL: 'http://localhost:3456',
    headless: true,
    locale: 'vi-VN',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
