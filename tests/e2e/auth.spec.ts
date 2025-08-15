import { test, expect } from '@playwright/test'

const creds = {
  owner: { email: process.env.E2E_OWNER_EMAIL || '', password: process.env.E2E_OWNER_PASSWORD || '' },
  tenant: { email: process.env.E2E_TENANT_EMAIL || '', password: process.env.E2E_TENANT_PASSWORD || '' },
  vendor: { email: process.env.E2E_VENDOR_EMAIL || '', password: process.env.E2E_VENDOR_PASSWORD || '' },
}

test.describe('Auth flows', () => {
  test('Owner can sign in and reach dashboard', async ({ page }) => {
    if (!creds.owner.email || !creds.owner.password) test.skip(true, 'Missing owner creds in env')
    await page.goto('/auth/login')
    await page.locator('[data-testid="login-email"]').fill(creds.owner.email)
    await page.locator('[data-testid="login-password"]').fill(creds.owner.password)
    await page.locator('[data-testid="login-submit"]').click()
    await expect(page).toHaveURL(/dashboard\/owner|onboarding/)
  })

  test('Vendor can sign in and reach dashboard', async ({ page }) => {
    if (!creds.vendor.email || !creds.vendor.password) test.skip(true, 'Missing vendor creds in env')
    await page.goto('/auth/login')
    await page.getByTestId('login-role-select').selectOption('vendor')
    await page.locator('[data-testid="login-email"]').fill(creds.vendor.email)
    await page.locator('[data-testid="login-password"]').fill(creds.vendor.password)
    await page.locator('[data-testid="login-submit"]').click()
    // Allow extra time for profile fetch + client redirects
    await page.locator('[data-testid="vendor-dashboard"]').waitFor({ state: 'visible', timeout: 30000 })
  })
})


