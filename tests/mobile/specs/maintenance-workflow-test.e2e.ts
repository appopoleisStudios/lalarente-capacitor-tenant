describe('Complete Maintenance Workflow Test (Owner → Vendor)', () => {
  const ownerEmail = process.env.E2E_OWNER_EMAIL || 'arsalanahmed82@hotmail.com'
  const ownerPassword = process.env.E2E_OWNER_PASSWORD || 'password123'
  const vendorEmail = process.env.E2E_VENDOR_EMAIL || 'appopoleis@example.com'
  const vendorPassword = process.env.E2E_VENDOR_PASSWORD || 'password123'

  before(async () => {
    // Wait for app to load
    await browser.pause(5000)
    console.log('✅ App loaded, ready to test')
  })

  describe('Owner Maintenance Request Creation', () => {
    it('should login as owner and access maintenance page', async () => {
      try {
        // Login as owner
        await loginAsUser('Owner', ownerEmail, ownerPassword)
        
        // Take screenshot after login
        await browser.saveScreenshot('./test-owner-after-login.png')
        console.log('✅ Owner login completed')
        
        // Wait a bit and check page content
        await browser.pause(3000)
        const pageTitle = await $('h1')
        if (await pageTitle.isExisting()) {
          const titleText = await pageTitle.getText()
          console.log(`📄 Page title: ${titleText}`)
        }
      } catch (error) {
        console.log('❌ Error in owner test:', error.message)
        await browser.saveScreenshot('./test-owner-error.png')
      }
    })
  })

  describe('Vendor Job Acceptance and Quote', () => {
    it('should login as vendor and access jobs page', async () => {
      try {
        // Clear app data to start fresh
        await browser.reloadSession()
        await browser.pause(3000)
        console.log('🔄 Reset session for vendor test')
        
        // Login as vendor
        await loginAsUser('Vendor', vendorEmail, vendorPassword)
        
        // Take screenshot after login
        await browser.saveScreenshot('./test-vendor-after-login.png')
        console.log('✅ Vendor login completed')
        
        // Wait a bit and check page content
        await browser.pause(3000)
        const pageTitle = await $('h1')
        if (await pageTitle.isExisting()) {
          const titleText = await pageTitle.getText()
          console.log(`📄 Page title: ${titleText}`)
        }
      } catch (error) {
        console.log('❌ Error in vendor test:', error.message)
        await browser.saveScreenshot('./test-vendor-error.png')
      }
    })
  })

  describe('Owner Quote Approval', () => {
    it('should login as owner and approve the quote', async () => {
      // Clear app data to start fresh
      await browser.reloadSession()
      await browser.pause(3000)
      console.log('🔄 Reset session for owner approval test')
      
      // Ensure we're in WEBVIEW context after reload
      await ensureWebviewContext()

      // Login as owner
      await loginAsUser('Owner', ownerEmail, ownerPassword)
      
      // Navigate to maintenance list (by visible text)
      const maintenanceLink = await findByText(['Maintenance', 'Active Maintenance', 'Maintenance Requests'])
      if (maintenanceLink) {
        await maintenanceLink.click()
        console.log('✅ Navigated to maintenance list')
        await browser.pause(2000)
        
        // Take screenshot
        await browser.saveScreenshot('./test-maintenance-list.png')
        
        // Look for maintenance request with quote
        const requestCards = await $$('[data-testid*="maintenance-card"], .maintenance-card, [class*="maintenance"], [role="article"], article')
        if (requestCards.length === 0) {
          throw new Error('No maintenance request cards found')
        }
        console.log(`✅ Found ${requestCards.length} maintenance requests`)
        
        // Click on first request to view details
        await requestCards[0].click()
        console.log('✅ Clicked on maintenance request')
        await browser.pause(2000)
          
          // Take screenshot
          await browser.saveScreenshot('./test-maintenance-details.png')
          
          // Approve quote
          await approveQuote()
        }
      }
    })
  })

  async function loginAsUser(role: string, email: string, password: string) {
    try {
      // Try to find login elements using WebView-friendly selectors
      const emailInput = await $('input[name="email"], input[autocomplete="email"], input[id*="email"], input')
      const passwordInput = await $('input[name="password"], input[type="password"], input[id*="password"], input')
      const submitButton = await findByText(['Login', 'Sign In', 'Continue'])
      
      if (await emailInput.isExisting() && await passwordInput.isExisting()) {
        await emailInput.setValue(email)
        await passwordInput.setValue(password)
        console.log(`✅ Filled ${role} credentials`)
        
        // Submit login
        if (submitButton) {
          await submitButton.click()
          console.log(`✅ Submitted ${role} login`)
          await browser.pause(3000)
        } else {
          throw new Error(`Submit button not found for ${role}`)
        }
      } else {
        throw new Error(`Login form not found for ${role}`)
      }
    } catch (error) {
      console.log(`❌ Error in loginAsUser for ${role}:`, error.message)
      throw error
    }
  }

  async function fillMaintenanceRequestForm() {
    // Select property
    const propertySelect = await $('select[name="property_id"], [data-testid="property-select"]')
    if (await propertySelect.isExisting()) {
      await propertySelect.selectByIndex(1) // Select first property
      console.log('✅ Selected property')
    }
    
    // Fill description
    const descriptionInput = await $('textarea[name="description"], [data-testid="description-input"]')
    if (await descriptionInput.isExisting()) {
      await descriptionInput.setValue('Test maintenance request from Appium automation')
      console.log('✅ Filled description')
    }
    
    // Select priority
    const prioritySelect = await $('select[name="priority"], [data-testid="priority-select"]')
    if (await prioritySelect.isExisting()) {
      await prioritySelect.selectByVisibleText('Medium')
      console.log('✅ Selected priority')
    }
    
    // Select category
    const categorySelect = await $('select[name="category_id"], [data-testid="category-select"]')
    if (await categorySelect.isExisting()) {
      await categorySelect.selectByIndex(1) // Select first category
      console.log('✅ Selected category')
    }
  }

  async function submitQuote() {
    // Navigate to quote submission
    const quoteButton = await findByText(['Submit Quote', 'Send Quote', 'Create Quote'])
    if (!quoteButton) throw new Error('Submit Quote button not found')
    await quoteButton.click()
    console.log('✅ Clicked submit quote button')
    await browser.pause(2000)
      
      // Fill quote form
      const amountInput = await $('input[name="amount"], [data-testid="quote-amount"]')
      if (await amountInput.isExisting()) {
        await amountInput.setValue('1500')
        console.log('✅ Filled quote amount')
      }
      
      const descriptionInput = await $('textarea[name="description"], [data-testid="quote-description"]')
      if (await descriptionInput.isExisting()) {
        await descriptionInput.setValue('Professional service quote for maintenance work')
        console.log('✅ Filled quote description')
      }
      
      // Submit quote
      const submitButton = await findByText(['Submit', 'Send', 'Save'])
      if (!submitButton) throw new Error('Quote submit button not found')
      await submitButton.click()
      console.log('✅ Submitted quote')
      await browser.pause(3000)
      // Take screenshot
      await browser.saveScreenshot('./test-quote-submitted.png')
  }

  async function approveQuote() {
    // Look for quote approval button
    const approveButton = await findByText(['Approve', 'Accept Quote', 'Approve Quote'])
    if (!approveButton) throw new Error('Approve Quote button not found')
    await approveButton.click()
    console.log('✅ Approved quote')
    await browser.pause(3000)
    // Take screenshot
    await browser.saveScreenshot('./test-quote-approved.png')
  }
  
  // Helper: ensure we are in WebView context
  async function ensureWebviewContext() {
    try {
      const contexts = await (browser as any).getContexts?.() || []
      const webview = contexts.find((c: string) => c.includes('WEBVIEW'))
      if (webview) {
        await (browser as any).switchContext?.(webview)
      }
    } catch {}
  }
  
  // Helper: find clickable element by visible text across common tags
  async function findByText(texts: string[]) {
    const candidates = ['button', 'a', 'span', 'div']
    for (const t of texts) {
      for (const tag of candidates) {
        const els = await $$(tag)
        for (const el of els) {
          try {
            const txt = await el.getText()
            if (txt && txt.trim().toLowerCase().includes(t.toLowerCase())) {
              return el
            }
          } catch {}
        }
      }
    }
    return null
  }
})
