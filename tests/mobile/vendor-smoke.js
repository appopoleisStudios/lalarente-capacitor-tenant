// Minimal Appium smoke test for Android APK (Capacitor WebView)
// Requires: `npm i -D webdriverio`

const { remote } = require('webdriverio')
const path = require('path')

async function run() {
  const apkPath = process.env.APK_PATH || path.resolve(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk')
  const email = process.env.E2E_VENDOR_EMAIL || 'vendor@example.com'
  const password = process.env.E2E_VENDOR_PASSWORD || 'Password1!'

  const caps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:app': apkPath,
    'appium:autoGrantPermissions': true,
    // Remove autoWebview to use native automation
    'appium:newCommandTimeout': 120,
  }

  const driver = await remote({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: caps,
    logLevel: 'error',
  })

  try {
    console.log('Waiting for app to load...')
    await driver.pause(5000)

    // Switch to WebView context manually if available
    console.log('Checking available contexts...')
    const contexts = await driver.getContexts()
    console.log('Available contexts:', contexts)
    
    let webviewContext = null
    for (const context of contexts) {
      if (context.includes('WEBVIEW')) {
        webviewContext = context
        break
      }
    }

    if (webviewContext) {
      console.log('Switching to WebView context:', webviewContext)
      await driver.switchContext(webviewContext)
      
      // Wait for login screen to load
      console.log('Looking for login form...')
      const emailInput = await driver.$('[data-testid="login-email"]')
      await emailInput.waitForDisplayed({ timeout: 15000 })
      console.log('Login form found')

      // Handle role selection - try multiple approaches
      console.log('Selecting vendor role...')
      const roleSelect = await driver.$('[data-testid="login-role-select"]')
      await roleSelect.waitForDisplayed({ timeout: 10000 })
      
      try {
        // Try clicking and selecting by visible text
        await roleSelect.click()
        await driver.pause(1000)
        
        // Look for vendor option and click it
        const vendorOption = await driver.$('option[value="vendor"]')
        if (await vendorOption.isDisplayed()) {
          await vendorOption.click()
        } else {
          // Fallback: try to set value directly
          await driver.executeScript('arguments[0].value = "vendor"; arguments[0].dispatchEvent(new Event("change"));', roleSelect)
        }
        console.log('Vendor role selected')
      } catch (roleError) {
        console.log('Role selection failed, continuing without role selection:', roleError.message)
      }

      // Fill login form
      console.log('Filling login form...')
      await emailInput.setValue(email)
      await (await driver.$('[data-testid="login-password"]')).setValue(password)
      
      // Submit form
      console.log('Submitting login form...')
      const submitBtn = await driver.$('[data-testid="login-submit"]')
      await submitBtn.waitForDisplayed({ timeout: 10000 })
      await submitBtn.click()

      // Wait for vendor dashboard
      console.log('Waiting for vendor dashboard...')
      await driver.pause(3000)
      
      // Look for vendor dashboard elements
      const dashboardElements = [
        'h2=Job Overview',
        'h2=Active Jobs', 
        'h2=Available Jobs',
        '[data-testid="vendor-dashboard"]'
      ]
      
      let dashboardFound = false
      for (const selector of dashboardElements) {
        try {
          const element = await driver.$(selector)
          if (await element.isDisplayed()) {
            console.log(`OK: Vendor dashboard loaded (found: ${selector})`)
            dashboardFound = true
            break
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!dashboardFound) {
        throw new Error('Vendor dashboard not found after login')
      }
    } else {
      console.log('No WebView context found, using native automation')
      
      // Use native Android UI automation
      console.log('Looking for login elements in native context...')
      
      // Try to find login elements by text or accessibility
      const emailField = await driver.$('~Email') // accessibility label
      if (await emailField.isDisplayed()) {
        console.log('Found email field')
        await emailField.setValue(email)
        
        const passwordField = await driver.$('~Password')
        if (await passwordField.isDisplayed()) {
          await passwordField.setValue(password)
          
          const signInButton = await driver.$('~Sign In')
          if (await signInButton.isDisplayed()) {
            await signInButton.click()
            console.log('Login submitted via native automation')
          }
        }
      } else {
        console.log('Could not find login elements in native context')
        throw new Error('Login elements not found in native context')
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message)
    // Take screenshot for debugging
    try {
      await driver.saveScreenshot('./test-error.png')
      console.log('Screenshot saved as test-error.png')
    } catch (screenshotError) {
      console.log('Could not save screenshot:', screenshotError.message)
    }
    throw error
  } finally {
    await driver.deleteSession().catch(()=>{})
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})


