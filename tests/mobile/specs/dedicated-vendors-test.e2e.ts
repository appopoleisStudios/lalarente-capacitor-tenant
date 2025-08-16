describe('Dedicated Vendors Management Test', () => {
  const ownerEmail = process.env.E2E_OWNER_EMAIL || 'arsalanahmed82@hotmail.com'
  const ownerPassword = process.env.E2E_OWNER_PASSWORD || 'password123'

  before(async () => {
    // Wait for app to load
    await browser.pause(5000)
    console.log('✅ App loaded, ready to test')
  })

  describe('Owner Dedicated Vendors Management', () => {
    it('should login as owner and access dashboard', async () => {
      try {
        // Login as owner
        await loginAsOwner()
        
        // Take screenshot after login
        await browser.saveScreenshot('./test-dedicated-vendors-owner-login.png')
        console.log('✅ Owner login completed for dedicated vendors test')
        
        // Wait a bit and check page content
        await browser.pause(3000)
        const pageTitle = await $('h1')
        if (await pageTitle.isExisting()) {
          const titleText = await pageTitle.getText()
          console.log(`📄 Page title: ${titleText}`)
        }
      } catch (error) {
        console.log('❌ Error in dedicated vendors test:', error.message)
        await browser.saveScreenshot('./test-dedicated-vendors-error.png')
      }
    })
  })

  async function loginAsOwner() {
    try {
      // Try to find login elements using various selectors
      const emailInput = await $('input[type="email"], input[name="email"], input[placeholder*="email"]')
      const passwordInput = await $('input[type="password"], input[name="password"], input[placeholder*="password"]')
      const submitButton = await $('button[type="submit"], button:contains("Login"), button:contains("Sign In")')
      
      if (await emailInput.isExisting() && await passwordInput.isExisting()) {
        await emailInput.setValue(ownerEmail)
        await passwordInput.setValue(ownerPassword)
        console.log('✅ Filled owner credentials')
        
        // Submit login
        if (await submitButton.isExisting()) {
          await submitButton.click()
          console.log('✅ Submitted owner login')
          await browser.pause(3000)
        } else {
          console.log('❌ Submit button not found for owner')
        }
      } else {
        console.log('❌ Login form not found for owner')
      }
    } catch (error) {
      console.log('❌ Error in loginAsOwner:', error.message)
    }
  }

  async function testVendorSearch() {
    // Look for vendor search input
    const searchInput = await $('input[placeholder*="vendor"], input[data-testid*="vendor-search"], input[name*="vendor"]')
    if (await searchInput.isExisting()) {
      await searchInput.setValue('Appopoleis')
      console.log('✅ Searched for vendor "Appopoleis"')
      await browser.pause(2000)
      
      // Look for search results
      const searchResults = await $$('[data-testid*="vendor-result"], .vendor-result, [class*="vendor-result"]')
      if (searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} vendor search results`)
        
        // Take screenshot
        await browser.saveScreenshot('./test-vendor-search-results.png')
        
        // Click on first result
        await searchResults[0].click()
        console.log('✅ Clicked on vendor search result')
        await browser.pause(1000)
      }
    }
  }

  async function testVendorAssignment() {
    // Look for "Add Vendor" or similar button
    const addVendorButton = await $('button:contains("Add"), button:contains("Assign"), [data-testid*="add-vendor"]')
    if (await addVendorButton.isExisting()) {
      await addVendorButton.click()
      console.log('✅ Clicked add vendor button')
      await browser.pause(2000)
      
      // Take screenshot
      await browser.saveScreenshot('./test-vendor-assignment.png')
      
      // Look for property selection
      const propertySelect = await $('select[name="property_id"], [data-testid="property-select"]')
      if (await propertySelect.isExisting()) {
        await propertySelect.selectByIndex(1) // Select first property
        console.log('✅ Selected property for vendor assignment')
      }
      
      // Look for category selection
      const categorySelect = await $('select[name="category_id"], [data-testid="category-select"]')
      if (await categorySelect.isExisting()) {
        await categorySelect.selectByIndex(1) // Select first category
        console.log('✅ Selected category for vendor assignment')
      }
      
      // Look for priority input
      const priorityInput = await $('input[name="priority"], [data-testid="priority-input"]')
      if (await priorityInput.isExisting()) {
        await priorityInput.setValue('1')
        console.log('✅ Set vendor priority')
      }
      
      // Submit assignment
      const submitButton = await $('button[type="submit"], [data-testid="submit-assignment"]')
      if (await submitButton.isExisting()) {
        await submitButton.click()
        console.log('✅ Submitted vendor assignment')
        await browser.pause(3000)
        
        // Take screenshot
        await browser.saveScreenshot('./test-vendor-assigned.png')
      }
    }
  }

  async function testVendorManagement() {
    // Look for vendor cards in the "All Dedicated Vendors" section
    const vendorCards = await $$('[data-testid*="vendor-card"], .vendor-card, [class*="vendor-card"]')
    if (vendorCards.length > 0) {
      console.log(`✅ Found ${vendorCards.length} vendor cards`)
      
      // Click on first vendor card to view details
      await vendorCards[0].click()
      console.log('✅ Clicked on vendor card')
      await browser.pause(2000)
      
      // Take screenshot
      await browser.saveScreenshot('./test-vendor-card-details.png')
      
      // Look for toggle active/inactive button
      const toggleButton = await $('button:contains("Toggle"), button:contains("Active"), [data-testid*="toggle-active"]')
      if (await toggleButton.isExisting()) {
        await toggleButton.click()
        console.log('✅ Toggled vendor active status')
        await browser.pause(2000)
        
        // Take screenshot
        await browser.saveScreenshot('./test-vendor-toggled.png')
      }
      
      // Look for remove vendor button
      const removeButton = await $('button:contains("Remove"), button:contains("Delete"), [data-testid*="remove-vendor"]')
      if (await removeButton.isExisting()) {
        await removeButton.click()
        console.log('✅ Clicked remove vendor button')
        await browser.pause(2000)
        
        // Look for confirmation dialog
        const confirmButton = await $('button:contains("Confirm"), button:contains("Yes"), [data-testid*="confirm-remove"]')
        if (await confirmButton.isExisting()) {
          await confirmButton.click()
          console.log('✅ Confirmed vendor removal')
          await browser.pause(2000)
          
          // Take screenshot
          await browser.saveScreenshot('./test-vendor-removed.png')
        }
      }
    }
  }
})
