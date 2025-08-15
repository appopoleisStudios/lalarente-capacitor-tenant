import { test, expect } from '@playwright/test'

test.describe('Vendor Jobs navigation', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.E2E_VENDOR_EMAIL || !process.env.E2E_VENDOR_PASSWORD) test.skip(true, 'Missing vendor creds in env')
    await page.goto('/auth/login')
    await page.getByTestId('login-role-select').selectOption('vendor')
    const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var ${k}`); return v }
    await page.getByTestId('login-email').fill(env('E2E_VENDOR_EMAIL'))
    await page.getByTestId('login-password').fill(env('E2E_VENDOR_PASSWORD'))
    await page.getByTestId('login-submit').click()
    // Some profiles may land on onboarding; accept either, then go to vendor dashboard
    try {
      await page.waitForURL(/\/dashboard\/vendor|\/onboarding\/user-type\//, { timeout: 30000 })
    } catch {
      // fallthrough
    }
    await page.goto('/dashboard/vendor')
  })

  test('header Available Jobs deep-link opens All Open Jobs', async ({ page }) => {
    await page.goto('/dashboard/vendor/jobs#open-jobs')
    await expect(page.locator('h3:has-text("All Open Jobs")')).toBeVisible()
  })

  test('Active Jobs View All deep-link opens Current Jobs', async ({ page }) => {
    await page.goto('/dashboard/vendor/jobs#current-jobs')
    await expect(page.locator('h3:has-text("Current Jobs")')).toBeVisible()
  })
})


