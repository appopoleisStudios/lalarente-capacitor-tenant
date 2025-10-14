import { test, expect } from '@playwright/test'

test.describe('Owner Properties Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and sign in as owner
    await page.goto('/auth/login')
    
    // Fill in owner credentials (adjust based on your test data)
    await page.fill('[data-testid="email"]', 'owner@test.com')
    await page.fill('[data-testid="password"]', 'testpassword')
    await page.click('[data-testid="login-btn"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard/owner')
  })

  test('should create, view, and edit a property', async ({ page }) => {
    // Navigate to properties page
    await page.goto('/dashboard/owner/properties')
    await expect(page.locator('h1')).toContainText('My Properties')

    // Click Add Property button
    await page.click('[data-testid="add-property"]')
    await expect(page.locator('h1')).toContainText('Add Property')

    // Fill in required property details
    await page.fill('[data-testid="title"]', 'Test Property')
    await page.fill('[data-testid="address"]', '123 Test Street')
    await page.fill('[data-testid="city"]', 'Test City')
    await page.fill('[data-testid="province"]', 'Test Province')
    await page.fill('[data-testid="rent"]', '5000')

    // Fill in optional details
    await page.fill('[data-testid="description"]', 'A beautiful test property')
    await page.fill('[data-testid="bedrooms"]', '2')
    await page.fill('[data-testid="bathrooms"]', '1')
    await page.fill('[data-testid="deposit"]', '10000')

    // Create the property
    await page.click('[data-testid="create-property-btn"]')

    // Should redirect to property detail page
    await page.waitForURL(/\/dashboard\/owner\/properties\/[^\/]+$/)
    await expect(page.locator('h1')).toContainText('Property Details')
    await expect(page.locator('h2')).toContainText('Test Property')

    // Verify property details are displayed
    await expect(page.locator('text=123 Test Street')).toBeVisible()
    await expect(page.locator('text=Test City, Test Province')).toBeVisible()
    await expect(page.locator('text=R 5,000')).toBeVisible()
    await expect(page.locator('text=A beautiful test property')).toBeVisible()

    // Click Edit Property button
    await page.click('[data-testid="edit-property-btn"]')
    await expect(page.locator('h1')).toContainText('Edit Property')

    // Verify form is pre-populated
    await expect(page.locator('[data-testid="title"]')).toHaveValue('Test Property')
    await expect(page.locator('[data-testid="address"]')).toHaveValue('123 Test Street')
    await expect(page.locator('[data-testid="rent"]')).toHaveValue('5000')

    // Update property details
    await page.fill('[data-testid="title"]', 'Updated Test Property')
    await page.fill('[data-testid="rent"]', '5500')

    // Save changes
    await page.click('[data-testid="save-property-btn"]')

    // Should redirect back to property detail page
    await page.waitForURL(/\/dashboard\/owner\/properties\/[^\/]+$/)
    await expect(page.locator('h2')).toContainText('Updated Test Property')
    await expect(page.locator('text=R 5,500')).toBeVisible()

    // Go back to properties list
    await page.click('[data-testid="back-to-properties-btn"]')
    await expect(page.locator('h1')).toContainText('My Properties')

    // Verify property appears in list
    await expect(page.locator('text=Updated Test Property')).toBeVisible()
    await expect(page.locator('text=R 5,500')).toBeVisible()
  })

  test('should show empty state when no properties exist', async ({ page }) => {
    // This test assumes a clean state with no properties
    await page.goto('/dashboard/owner/properties')
    
    // Should show empty state
    await expect(page.locator('text=No properties yet')).toBeVisible()
    await expect(page.locator('text=Add your first property')).toBeVisible()
    
    // Add Property button should be present
    await expect(page.locator('[data-testid="add-property"]')).toBeVisible()
  })

  test('should filter and search properties', async ({ page }) => {
    // Navigate to properties page
    await page.goto('/dashboard/owner/properties')

    // Test search functionality
    await page.fill('[data-testid="search-input"]', 'Test')
    // Wait for search results to update
    await page.waitForTimeout(500)

    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'available')
    await page.waitForTimeout(500)

    // Test sort options
    await page.selectOption('[data-testid="sort-select"]', 'rent_desc')
    await page.waitForTimeout(500)
  })

  test('should display occupancy information for occupied properties', async ({ page }) => {
    // This test assumes there's an occupied property with lease data
    await page.goto('/dashboard/owner/properties')

    // Find and click on an occupied property
    const occupiedProperty = page.locator('[data-testid*="property-card-"]').filter({ hasText: 'occupied' }).first()
    if (await occupiedProperty.count() > 0) {
      await occupiedProperty.click()
      
      // Should show occupancy information
      await expect(page.locator('text=Current Occupancy')).toBeVisible()
      await expect(page.locator('text=Tenant')).toBeVisible()
      await expect(page.locator('text=Lease Start')).toBeVisible()
      await expect(page.locator('text=Lease End')).toBeVisible()
      
      // Should show Manage Lease button
      await expect(page.locator('[data-testid="manage-lease-btn"]')).toBeVisible()
    }
  })
})


