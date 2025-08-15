import { test, expect } from '@playwright/test'

test.describe('Vendor login flow', () => {
  test('can login as vendor and see dashboard widgets', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByTestId('login-role-select').selectOption('vendor')
    const email = process.env.E2E_VENDOR_EMAIL || ''
    const password = process.env.E2E_VENDOR_PASSWORD || ''
    if (!email || !password) test.skip(true, 'Missing vendor creds in env')
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill(password)
    await page.getByTestId('login-submit').click()

    await page.waitForURL(/\/dashboard\/vendor/)
    await expect(page.locator('text=Job Overview')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Active Jobs' })).toBeVisible()
  })
})


