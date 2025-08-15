import { test, expect } from '@playwright/test'

test.describe('Vendor login flow', () => {
  test('can login as vendor and see dashboard widgets', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:4173'
    await page.goto(base + '/auth/login')

    await page.getByTestId('login-role-select').selectOption('vendor')
    await page.getByTestId('login-email').fill(process.env.E2E_VENDOR_EMAIL || 'vendor@example.com')
    await page.getByTestId('login-password').fill(process.env.E2E_VENDOR_PASSWORD || 'Password1!')
    await page.getByTestId('login-submit').click()

    await page.waitForURL(/\/dashboard\/vendor/)
    await expect(page.locator('text=Job Overview')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Active Jobs' })).toBeVisible()
  })
})


