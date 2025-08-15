import { defineConfig, devices } from '@playwright/test'
const enabled = process.env.E2E_ENABLE === '1'

export default defineConfig({
  globalSetup: './setup-env.ts',
  testDir: './',
  // Disable Playwright by default unless E2E_ENABLE=1 is set
  testMatch: enabled ? ['**/*.spec.ts'] : ['__DISABLED__'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})


