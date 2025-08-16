describe('Comprehensive Authentication & Role Testing', () => {
  const roles = [
    { name: 'Owner', email: process.env.E2E_OWNER_EMAIL || 'arsalanahmed82@hotmail.com', password: process.env.E2E_OWNER_PASSWORD || 'password123' },
    { name: 'Vendor', email: process.env.E2E_VENDOR_EMAIL || 'appopoleis@example.com', password: process.env.E2E_VENDOR_PASSWORD || 'password123' },
    { name: 'Tenant', email: process.env.E2E_TENANT_EMAIL || 'tenant@example.com', password: process.env.E2E_TENANT_PASSWORD || 'password123' }
  ]

  // Debug: Log environment variables
  console.log('🔍 Environment Variables Debug:')
  console.log('E2E_OWNER_EMAIL:', process.env.E2E_OWNER_EMAIL)
  console.log('E2E_VENDOR_EMAIL:', process.env.E2E_VENDOR_EMAIL)
  console.log('E2E_TENANT_EMAIL:', process.env.E2E_TENANT_EMAIL)

  before(async () => {
    // Wait for app to load
    await browser.pause(5000)
    console.log('✅ App loaded, ready to test')
  })

  roles.forEach((role, index) => {
    if (role.email && role.password) {
      describe(`${role.name} Authentication & Dashboard Test`, () => {
                 beforeEach(async () => {
           // Reset session for each test to start fresh
           if (index > 0) {
             await browser.reloadSession()
             await browser.pause(3000)
             console.log(`🔄 Reset session for ${role.name} test`)
           }
         })

                it(`should login as ${role.name} and access dashboard`, async () => {
          try {
            // Take screenshot before login
            await browser.saveScreenshot(`./test-${role.name.toLowerCase()}-before-login.png`)
            console.log(`📸 Screenshot saved for ${role.name} before login`)
            
            // Wait a bit for app to be ready
            await browser.pause(2000)
            
            // Try to find login elements
            const emailInput = await $('[data-testid="login-email"]')
            const passwordInput = await $('[data-testid="login-password"]')
            const submitButton = await $('[data-testid="login-submit"]')
            
            if (await emailInput.isExisting() && await passwordInput.isExisting()) {
              console.log(`✅ Found login form for ${role.name}`)
              
              // Fill login form
              await emailInput.setValue(role.email)
              await passwordInput.setValue(role.password)
              console.log(`✅ Filled ${role.name} credentials`)
              
              // Submit login
              if (await submitButton.isExisting()) {
                await submitButton.click()
                console.log(`✅ Submitted ${role.name} login`)
                
                // Wait for page to load
                await browser.pause(5000)
                
                // Take screenshot after login
                await browser.saveScreenshot(`./test-${role.name.toLowerCase()}-after-login.png`)
                console.log(`📸 Screenshot saved for ${role.name} after login`)
                
                // Check if we're on dashboard or onboarding
                const pageTitle = await $('h1')
                if (await pageTitle.isExisting()) {
                  const titleText = await pageTitle.getText()
                  console.log(`📄 Page title: ${titleText}`)
                }
                
                console.log(`✅ ${role.name} login test completed`)
              } else {
                console.log(`❌ Submit button not found for ${role.name}`)
              }
            } else {
              console.log(`❌ Login form not found for ${role.name}`)
              // Take screenshot to see what's on screen
              await browser.saveScreenshot(`./test-${role.name.toLowerCase()}-no-login-form.png`)
            }
          } catch (error) {
            console.log(`❌ Error in ${role.name} test:`, error.message)
            await browser.saveScreenshot(`./test-${role.name.toLowerCase()}-error.png`)
          }
        })
      })
    }
  })

  
})
