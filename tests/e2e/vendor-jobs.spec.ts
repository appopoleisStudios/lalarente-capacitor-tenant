import { test, expect } from '@playwright/test'

test.describe('Vendor Jobs navigation', () => {
  test.beforeEach(async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:4173'
    await page.goto(base + '/auth/login')
    await page.getByTestId('login-role-select').selectOption('vendor')
    await page.getByTestId('login-email').fill(process.env.E2E_VENDOR_EMAIL || 'vendor@example.com')
    await page.getByTestId('login-password').fill(process.env.E2E_VENDOR_PASSWORD || 'Password1!')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard\/vendor/)
  })

  test('header Available Jobs deep-link opens All Open Jobs', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:4173'
    await page.goto(base + '/dashboard/vendor/jobs#open-jobs')
    await expect(page.locator('h3:has-text("All Open Jobs")')).toBeVisible()
  })

  test('Active Jobs View All deep-link opens Current Jobs', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:4173'
    await page.goto(base + '/dashboard/vendor/jobs#current-jobs')
    await expect(page.locator('h3:has-text("Current Jobs")')).toBeVisible()
  })
})


