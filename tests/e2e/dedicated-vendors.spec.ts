import { test, expect } from '@playwright/test'

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || ''
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || ''

test.describe('Owner Dedicated Vendors management', () => {
  test('search, add, toggle, remove', async ({ page }) => {
    test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Missing owner creds in env')

    await page.goto('/auth/login')
    await page.getByTestId('login-role-select').selectOption('owner')
    await page.getByTestId('login-email').fill(OWNER_EMAIL)
    await page.getByTestId('login-password').fill(OWNER_PASSWORD)
    await page.getByTestId('login-submit').click()

    await page.waitForURL(/\/dashboard\/owner/)

    await page.goto('/dashboard/owner/dedicated-vendors')

    // select first property
    const propSelect = page.locator('select').first()
    await propSelect.waitFor()

    // search vendor name (appopoleis)
    const search = page.getByPlaceholder('Type at least 2 characters...')
    await search.fill('appopoleis')

    // click Add on first result
    const addBtn = page.locator('button:has-text("Add")').first()
    await addBtn.waitFor({ state: 'visible' })
    await addBtn.click()

    // top card should show 1 vendor now
    await expect(page.locator('text=All Dedicated Vendors (')).toContainText('1')

    // toggle Active
    const activeBtn = page.locator('button', { hasText: 'Active' }).first()
    await activeBtn.click()
    await expect(page.locator('button', { hasText: 'Inactive' }).first()).toBeVisible()

    // remove
    const removeBtn = page.locator('button', { hasText: 'Remove' }).first()
    await removeBtn.click()
    await expect(page.locator('text=No dedicated vendors found.')).toBeVisible()
  })
})
