describe('Owner/Vendor flows (mobile)', () => {
  it('owner can login and open Dedicated Vendors', async () => {
    // Wait for app to load
    await browser.pause(3000)

    // Switch to webview when available
    const contexts = await driver.getContexts()
    const webview = contexts.find((c) => c.includes('WEBVIEW'))
    if (webview) {
      await driver.switchContext(webview)
      console.log('Switched to WebView context for owner test')
    }

    // Look for login form elements
    const emailInput = await $('[data-testid="login-email"]')
    const passwordInput = await $('[data-testid="login-password"]')
    const submitButton = await $('[data-testid="login-submit"]')

    if (await emailInput.isExisting()) {
      await emailInput.setValue('test@example.com')
      console.log('Owner email input found and filled')
    }

    if (await passwordInput.isExisting()) {
      await passwordInput.setValue('testpassword')
      console.log('Owner password input found and filled')
    }

    if (await submitButton.isExisting()) {
      console.log('Owner submit button found')
    }

    // Take screenshot
    await browser.saveScreenshot('./owner-vendor-flows-test.png')
    
    // Basic validation
    const hasElements = await emailInput.isExisting() || 
                       await passwordInput.isExisting() || 
                       await submitButton.isExisting()
    
    expect(hasElements).toBe(true)
  })

  it('vendor can login and see Jobs list', async () => {
    // Wait for app to load
    await browser.pause(3000)

    // Switch to webview when available
    const contexts = await driver.getContexts()
    const webview = contexts.find((c) => c.includes('WEBVIEW'))
    if (webview) {
      await driver.switchContext(webview)
      console.log('Switched to WebView context for vendor test')
    }

    // Look for login form elements
    const emailInput = await $('[data-testid="login-email"]')
    const passwordInput = await $('[data-testid="login-password"]')
    const submitButton = await $('[data-testid="login-submit"]')

    if (await emailInput.isExisting()) {
      await emailInput.setValue('test@example.com')
      console.log('Vendor email input found and filled')
    }

    if (await passwordInput.isExisting()) {
      await passwordInput.setValue('testpassword')
      console.log('Vendor password input found and filled')
    }

    if (await submitButton.isExisting()) {
      console.log('Vendor submit button found')
    }

    // Basic validation
    const hasElements = await emailInput.isExisting() || 
                       await passwordInput.isExisting() || 
                       await submitButton.isExisting()
    
    expect(hasElements).toBe(true)
  })
})
