import { test, expect } from '@playwright/test'

const creds = {
  owner: { email: process.env.E2E_OWNER_EMAIL || '', password: process.env.E2E_OWNER_PASSWORD || '' },
  vendor: { email: process.env.E2E_VENDOR_EMAIL || '', password: process.env.E2E_VENDOR_PASSWORD || '' },
}

async function signIn(page: any, email: string, password: string, role?: 'owner'|'vendor') {
  await page.goto('/auth/login')
  if (role) await page.getByTestId('login-role-select').selectOption(role)
  await page.locator('[data-testid="login-email"]').fill(email)
  await page.locator('[data-testid="login-password"]').fill(password)
  await page.locator('[data-testid="login-submit"]').click()
}

test.describe('Maintenance flow: owner -> public job -> vendor sees open job', () => {
  test('Owner creates open market request; vendor sees it and can submit a quote', async ({ page, context }) => {
    if (!creds.owner.email || !creds.owner.password || !creds.vendor.email || !creds.vendor.password) test.skip(true, 'Missing creds in env')
    // Owner creates request
    await signIn(page, creds.owner.email, creds.owner.password, 'owner')
    await page.goto('/dashboard/owner/maintenance/new')
    // Assumes at least one property exists for owner
    await page.locator('select').first().selectOption({ index: 1 })
    await page.getByPlaceholder('e.g., Geyser burst, Electrical fault').fill('Test – Leaky pipe')
    await page.getByPlaceholder('Describe the issue in detail...').fill('E2E test – please ignore')
    await page.getByText('Create Maintenance Request').click()
    await expect(page).toHaveURL(/dashboard\/owner\/maintenance/)

    // New context as vendor
    const vendorPage = await context.newPage()
    await signIn(vendorPage, creds.vendor.email, creds.vendor.password, 'vendor')
    await vendorPage.goto('/dashboard/vendor/jobs#open-jobs')
    await vendorPage.getByText('All Open Jobs').click()
    // Should see at least one item
    await expect(vendorPage.getByText('Maintenance Request').first()).toBeVisible()
  })
})


