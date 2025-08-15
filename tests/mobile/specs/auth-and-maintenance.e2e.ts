import { expect } from 'chai'

const E2E_BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

describe('Mobile E2E: auth and maintenance flow', () => {
  it('vendor can login and see open jobs', async () => {
    // Open app WebView
    // If your Capacitor app loads the web app URL, navigate there
    // For a pure WebView harness, we can open a deep link
    await driver.pause(3000)

    // switch to webview when available
    const contexts = await driver.getContexts()
    const webview = contexts.find((c) => c.includes('WEBVIEW'))
    if (webview) await driver.switchContext(webview)

    await driver.url(`${E2E_BASE}/auth/login`)

    const role = await $('select')
    await role.selectByVisibleText('Vendor')

    await $('[data-testid="login-email"]').setValue(process.env.E2E_VENDOR_EMAIL || '')
    await $('[data-testid="login-password"]').setValue(process.env.E2E_VENDOR_PASSWORD || '')
    await $('[data-testid="login-submit"]').click()

    // Jobs screen
    await expect(await $('=Jobs')).to.exist
    await driver.url(`${E2E_BASE}/dashboard/vendor/jobs#open-jobs`)
    const open = await $('//*[text()="All Open Jobs"]')
    await open.click()

    // At least tries to render list container
    const list = await $('//*[contains(text(),"No items.") or contains(text(),"Maintenance Request")]')
    await expect(await list.isExisting()).to.be.true
  })
})


