import { test, expect } from '@playwright/test'

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || ''
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || ''
const VENDOR_EMAIL = process.env.E2E_VENDOR_EMAIL || ''
const VENDOR_PASSWORD = process.env.E2E_VENDOR_PASSWORD || ''

// Utility: login helper
async function login(page: any, role: 'owner' | 'vendor', email: string, password: string) {
  await page.goto('/auth/login')
  await page.getByTestId('login-role-select').selectOption(role)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

test.describe('Owner -> Invite Vendor -> Vendor sees job', () => {
  test('owner creates request inviting vendor; vendor sees Submit Quote CTA', async ({ page, browser }) => {
    test.skip(!OWNER_EMAIL || !OWNER_PASSWORD || !VENDOR_EMAIL || !VENDOR_PASSWORD, 'Missing creds in env')

    // Owner creates request
    await login(page, 'owner', OWNER_EMAIL, OWNER_PASSWORD)
    await page.waitForURL(/\/dashboard\/owner/)
    await page.goto('/dashboard/owner/maintenance/new')

    // Pick first property
    await page.locator('label:text("Property")')
    const prop = page.locator('select').first()
    await prop.waitFor()
    // choose first non-empty option
    const options = await prop.locator('option').all()
    if (options.length < 2) test.skip(true, 'No owner properties to create request for')
    await prop.selectOption({ index: 1 })

    await page.getByPlaceholder('e.g., Geyser burst, Electrical fault').fill('Playwright Test Issue')
    await page.getByPlaceholder('Describe the issue in detail...').fill('Test description via E2E')

    // Invite Vendors path
    await page.getByLabel('Invite Vendors').check()

    // Search vendor
    const search = page.getByPlaceholder('Type at least 2 characters...')
    await search.fill('appopoleis')
    const result = page.locator('button:has-text("Appopoleis")').first()
    await result.waitFor({ state: 'visible' })
    await result.click()

    // Submit request
    const submit = page.getByRole('button', { name: 'Create Maintenance Request' })
    await submit.click()

    await page.waitForURL(/\/dashboard\/owner\/maintenance/)

    // Vendor logs in and sees job
    const vendorContext = await browser.newContext()
    const vendorPage = await vendorContext.newPage()
    await login(vendorPage, 'vendor', VENDOR_EMAIL, VENDOR_PASSWORD)
    await vendorPage.waitForURL(/\/dashboard\/vendor/)
    await vendorPage.goto('/dashboard/vendor/jobs#current-jobs')

    // Find a Submit Quote CTA for the created request
    const submitQuote = vendorPage.locator('a,button', { hasText: 'Submit Quote' }).first()
    await expect(submitQuote).toBeVisible()

    await vendorContext.close()
  })
})
