# Comprehensive Appium Test Suite for Lala Rente

This guide covers all the automated mobile tests for the Lala Rente application, testing every feature we've built so far.

## 🎯 **What We're Testing**

Based on our development logs, we've built and are testing:

### **✅ Core Features Built & Tested:**

1. **Authentication System**
   - Multi-role login (Owner, Vendor, Tenant, Admin)
   - Role-based dashboard access
   - Profile management and sign-out

2. **Vendor Dashboard**
   - Job overview with current jobs
   - All open jobs marketplace
   - Recent payments tracking
   - Service contracts management

3. **Owner Dashboard**
   - Portfolio summary with property metrics
   - Documents management (leases, POs, quotes)
   - Active maintenance requests
   - Recent activity tracking

4. **Maintenance Management System (MMS)**
   - Create maintenance requests
   - Property and category selection
   - Priority and description management
   - Vendor routing and invitations

5. **Dedicated Vendors Management**
   - Vendor search functionality
   - Property-specific vendor assignments
   - Category-based filtering
   - Priority management and active/inactive toggles

6. **Quote & Job Workflow**
   - Quote submission for maintenance requests
   - Quote approval by owners
   - Purchase order generation
   - Job execution tracking

7. **Profile & Navigation**
   - Bottom navigation testing
   - Profile page access and editing
   - Sign-out functionality
   - Role-specific UI elements

## 🚀 **Test Commands**

### **Individual Test Suites:**

```bash
# Basic app functionality test
npm run test:mobile:single

# Comprehensive authentication test (all roles)
npm run test:mobile:comprehensive

# Complete maintenance workflow test (Owner → Vendor)
npm run test:mobile:maintenance

# Dedicated vendors management test
npm run test:mobile:vendors

# Profile management and navigation test
npm run test:mobile:profile

# Run ALL tests in sequence
npm run test:mobile:all
```

### **Debug Mode:**
```bash
# Run with detailed logging
npm run test:mobile:debug
```

## 📋 **Prerequisites**

### **Environment Variables Required:**
Create a `.env.local` file in the project root with:

```bash
# Owner credentials
E2E_OWNER_EMAIL=your_owner_email@example.com
E2E_OWNER_PASSWORD=your_owner_password

# Vendor credentials  
E2E_VENDOR_EMAIL=your_vendor_email@example.com
E2E_VENDOR_PASSWORD=your_vendor_password

# Tenant credentials (optional)
E2E_TENANT_EMAIL=your_tenant_email@example.com
E2E_TENANT_PASSWORD=your_tenant_password

# Admin credentials (optional)
E2E_ADMIN_EMAIL=your_admin_email@example.com
E2E_ADMIN_PASSWORD=your_admin_password
```

### **Android Setup:**
1. **Android Studio & SDK** installed
2. **Emulator running** (Pixel_9 or similar)
3. **Environment variables set:**
   ```bash
   ANDROID_HOME=C:\Users\arsal\AppData\Local\Android\Sdk
   ANDROID_SDK_ROOT=C:\Users\arsal\AppData\Local\Android\Sdk
   JAVA_HOME=C:\Program Files\Java\jdk-17
   ```

### **Dependencies:**
```bash
npm install -g appium
npm install -g @wdio/cli
npm install chai
```

## 📸 **Screenshots Generated**

Each test generates screenshots for debugging:

- `test-owner-dashboard.png` - Owner dashboard view
- `test-vendor-dashboard.png` - Vendor dashboard view
- `test-maintenance-creation-page.png` - Maintenance request form
- `test-vendor-jobs-page.png` - Vendor jobs marketplace
- `test-dedicated-vendors-page.png` - Vendor management page
- `test-profile-page.png` - User profile page
- `test-sign-out.png` - Sign out confirmation

## 🔍 **What Each Test Validates**

### **1. Comprehensive Auth Test (`comprehensive-auth-test.e2e.ts`)**
- ✅ All user roles can login successfully
- ✅ Role-specific dashboards load correctly
- ✅ Dashboard elements match expected UI
- ✅ No authentication errors occur

### **2. Maintenance Workflow Test (`maintenance-workflow-test.e2e.ts`)**
- ✅ Owner can create maintenance requests
- ✅ Vendor can see new jobs in marketplace
- ✅ Vendor can submit quotes
- ✅ Owner can approve quotes
- ✅ Complete MMS flow works end-to-end

### **3. Dedicated Vendors Test (`dedicated-vendors-test.e2e.ts`)**
- ✅ Vendor search functionality works
- ✅ Owner can assign vendors to properties
- ✅ Vendor priority management works
- ✅ Active/inactive toggles function
- ✅ Vendor removal works

### **4. Profile Navigation Test (`profile-navigation-test.e2e.ts`)**
- ✅ Bottom navigation works for all tabs
- ✅ Profile page loads correctly
- ✅ Profile editing functionality works
- ✅ Sign-out process completes successfully
- ✅ Returns to login page after sign-out

## 🐛 **Troubleshooting**

### **Common Issues:**

1. **"No devices connected"**
   ```bash
   # Check emulator status
   /c/Users/arsal/AppData/Local/Android/Sdk/platform-tools/adb.exe devices
   
   # Start emulator if needed
   /c/Users/arsal/AppData/Local/Android/Sdk/emulator/emulator.exe -avd Pixel_9
   ```

2. **"ChromeDriver version mismatch"**
   - Appium auto-downloads correct version
   - Check `--allow-insecure chromedriver_autodownload` in config

3. **"WebView context not found"**
   - Wait longer for app to load (increase pause times)
   - Check if app is fully loaded before switching contexts

4. **"Element not found"**
   - Check screenshots to see actual UI state
   - Verify test selectors match actual UI elements
   - Check if app shows different screen than expected

### **Debug Commands:**
```bash
# Check Appium setup
npx appium-doctor --android

# Check emulator connection
/c/Users/arsal/AppData/Local/Android/Sdk/platform-tools/adb.exe devices

# Clear app data for fresh start
/c/Users/arsal/AppData/Local/Android/Sdk/platform-tools/adb.exe shell pm clear com.lalarente.app
```

## 📊 **Test Results Interpretation**

### **✅ Success Indicators:**
- All tests pass without errors
- Screenshots show expected UI states
- Console logs show successful interactions
- No authentication or navigation failures

### **❌ Failure Indicators:**
- Tests fail with element not found errors
- Screenshots show unexpected UI states
- Authentication failures
- Navigation doesn't work as expected

### **🔧 Partial Success:**
- Some tests pass, others fail
- UI elements found but interactions fail
- Navigation works but specific features don't

## 🎯 **Next Steps After Testing**

1. **Review all screenshots** to verify UI states
2. **Check console logs** for detailed interaction feedback
3. **Fix any failing tests** by updating selectors or UI
4. **Document any issues** found during testing
5. **Update test data** if needed for better coverage

## 📝 **Test Data Requirements**

The tests expect:
- **Owner account** with properties and maintenance requests
- **Vendor account** (Appopoleis) with service categories
- **Test properties** in the database
- **Service categories** for maintenance requests
- **Sample maintenance requests** for testing

## 🔄 **Continuous Testing**

For ongoing development:
1. Run `npm run test:mobile:all` after each major change
2. Review screenshots for UI regressions
3. Update test selectors if UI changes
4. Add new tests for new features

---

**Last Updated:** Based on development logs up to [2025-08-16]
**Test Coverage:** All major features from Phase 1-5 of project roadmap
**Mobile Platform:** Android (Capacitor APK)
**Testing Framework:** Appium + WebdriverIO + Mocha
