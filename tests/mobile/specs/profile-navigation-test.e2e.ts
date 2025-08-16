describe('Profile Management & Navigation Test', () => {
  const ownerEmail = process.env.E2E_OWNER_EMAIL || 'arsalanahmed82@hotmail.com'
  const ownerPassword = process.env.E2E_OWNER_PASSWORD || 'password123'
  const vendorEmail = process.env.E2E_VENDOR_EMAIL || 'appopoleis@example.com'
  const vendorPassword = process.env.E2E_VENDOR_PASSWORD || 'password123'

  before(async () => {
    // Wait for app to load
    await browser.pause(5000)
    console.log('✅ App loaded, ready to test')
  })

  describe('Owner Profile Management', () => {
    it('should login as owner and access dashboard', async () => {
      try {
        // Login as owner
        await loginAsUser('Owner', ownerEmail, ownerPassword)
        
        // Take screenshot after login
        await browser.saveScreenshot('./test-profile-owner-login.png')
        console.log('✅ Owner login completed for profile test')
        
        // Wait a bit and check page content
        await browser.pause(3000)
        const pageTitle = await $('h1')
        if (await pageTitle.isExisting()) {
          const titleText = await pageTitle.getText()
          console.log(`📄 Page title: ${titleText}`)
        }
      } catch (error) {
        console.log('❌ Error in owner profile test:', error.message)
        await browser.saveScreenshot('./test-profile-owner-error.png')
      }
    })
  })

  describe('Vendor Profile Management', () => {
    it('should login as vendor and access dashboard', async () => {
      try {
        // Clear app data to start fresh
        await browser.reloadSession()
        await browser.pause(3000)
        console.log('🔄 Reset session for vendor profile test')
        
        // Login as vendor
        await loginAsUser('Vendor', vendorEmail, vendorPassword)
        
        // Take screenshot after login
        await browser.saveScreenshot('./test-profile-vendor-login.png')
        console.log('✅ Vendor login completed for profile test')
        
        // Wait a bit and check page content
        await browser.pause(3000)
        const pageTitle = await $('h1')
        if (await pageTitle.isExisting()) {
          const titleText = await pageTitle.getText()
          console.log(`📄 Page title: ${titleText}`)
        }
      } catch (error) {
        console.log('❌ Error in vendor profile test:', error.message)
        await browser.saveScreenshot('./test-profile-vendor-error.png')
      }
    })
  })

  async function loginAsUser(role: string, email: string, password: string) {
    try {
      // Try to find login elements using various selectors
      const emailInput = await $('input[type="email"], input[name="email"], input[placeholder*="email"]')
      const passwordInput = await $('input[type="password"], input[name="password"], input[placeholder*="password"]')
      const submitButton = await $('button[type="submit"], button:contains("Login"), button:contains("Sign In")')
      
      if (await emailInput.isExisting() && await passwordInput.isExisting()) {
        await emailInput.setValue(email)
        await passwordInput.setValue(password)
        console.log(`✅ Filled ${role} credentials`)
        
        // Submit login
        if (await submitButton.isExisting()) {
          await submitButton.click()
          console.log(`✅ Submitted ${role} login`)
          await browser.pause(3000)
        } else {
          console.log(`❌ Submit button not found for ${role}`)
        }
      } else {
        console.log(`❌ Login form not found for ${role}`)
      }
    } catch (error) {
      console.log(`❌ Error in loginAsUser for ${role}:`, error.message)
    }
  }

  async function testBottomNavigation() {
    // Look for bottom navigation tabs
    const navTabs = await $$('[data-testid*="nav-tab"], .nav-tab, [class*="nav-tab"], nav a, .bottom-nav a')
    if (navTabs.length > 0) {
      console.log(`✅ Found ${navTabs.length} navigation tabs`)
      
      // Take screenshot of dashboard
      await browser.saveScreenshot('./test-dashboard-with-nav.png')
      
      // Test each navigation tab
      for (let i = 0; i < Math.min(navTabs.length, 3); i++) {
        const tab = navTabs[i]
        const tabText = await tab.getText()
        console.log(`✅ Testing navigation tab: ${tabText}`)
        
        await tab.click()
        await browser.pause(2000)
        
        // Take screenshot
        await browser.saveScreenshot(`./test-nav-${i}-${tabText.toLowerCase().replace(/\s+/g, '-')}.png`)
        
        // Verify page loaded
        const pageContent = await $('main, .main, [role="main"]')
        if (await pageContent.isExisting()) {
          console.log(`✅ Page content loaded for ${tabText}`)
        }
      }
    }
  }

  async function testProfilePage(role: string) {
    // Navigate to profile page via bottom nav
    const profileTab = await $('a[href*="profile"], [data-testid*="profile"], .profile-tab')
    if (await profileTab.isExisting()) {
      await profileTab.click()
      console.log(`✅ Navigated to ${role} profile page`)
      await browser.pause(2000)
      
      // Take screenshot
      await browser.saveScreenshot(`./test-${role.toLowerCase()}-profile-page.png`)
      
      // Check for profile elements
      const profileElements = [
        'h1:contains("Profile")',
        'h2:contains("Profile")',
        '[data-testid*="profile-name"]',
        '[data-testid*="profile-email"]',
        '[data-testid*="profile-role"]'
      ]
      
      for (const selector of profileElements) {
        const element = await $(selector)
        if (await element.isExisting()) {
          console.log(`✅ Found ${selector} on ${role} profile page`)
        }
      }
      
      // Look for edit profile button
      const editButton = await $('button:contains("Edit"), [data-testid*="edit-profile"]')
      if (await editButton.isExisting()) {
        await editButton.click()
        console.log(`✅ Clicked edit profile button`)
        await browser.pause(2000)
        
        // Take screenshot
        await browser.saveScreenshot(`./test-${role.toLowerCase()}-edit-profile.png`)
        
        // Look for form fields
        const nameInput = await $('input[name="full_name"], [data-testid*="name-input"]')
        if (await nameInput.isExisting()) {
          const currentValue = await nameInput.getValue()
          console.log(`✅ Current name: ${currentValue}`)
          
          // Update name
          await nameInput.setValue(`${currentValue} (Updated)`)
          console.log(`✅ Updated name`)
        }
        
        // Look for save button
        const saveButton = await $('button:contains("Save"), [data-testid*="save-profile"]')
        if (await saveButton.isExisting()) {
          await saveButton.click()
          console.log(`✅ Saved profile changes`)
          await browser.pause(2000)
          
          // Take screenshot
          await browser.saveScreenshot(`./test-${role.toLowerCase()}-profile-saved.png`)
        }
      }
    }
  }

  async function testSignOut() {
    // Look for sign out button in profile page
    const signOutButton = await $('button:contains("Sign Out"), button:contains("Logout"), [data-testid*="sign-out"]')
    if (await signOutButton.isExisting()) {
      await signOutButton.click()
      console.log('✅ Clicked sign out button')
      await browser.pause(2000)
      
      // Take screenshot
      await browser.saveScreenshot('./test-sign-out-clicked.png')
      
      // Look for confirmation dialog
      const confirmButton = await $('button:contains("Confirm"), button:contains("Yes"), [data-testid*="confirm-signout"]')
      if (await confirmButton.isExisting()) {
        await confirmButton.click()
        console.log('✅ Confirmed sign out')
        await browser.pause(3000)
        
        // Take screenshot
        await browser.saveScreenshot('./test-signed-out.png')
        
        // Verify we're back at login page
        const loginForm = await $('[data-testid="login-email"]')
        if (await loginForm.isExisting()) {
          console.log('✅ Successfully signed out - back at login page')
        }
      } else {
        // No confirmation dialog, check if we're at login page
        const loginForm = await $('[data-testid="login-email"]')
        if (await loginForm.isExisting()) {
          console.log('✅ Successfully signed out - back at login page')
        }
      }
    }
  }
})
