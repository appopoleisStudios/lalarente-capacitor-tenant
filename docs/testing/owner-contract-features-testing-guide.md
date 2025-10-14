# 🧪 **Owner Contract Features - Comprehensive Testing Guide**

## 📋 **Overview**
This guide provides step-by-step testing instructions for the newly implemented owner contract management features, including enhanced contract list, contract actions, and navigation improvements.

---

## 🎯 **Prerequisites**

### **Development Environment Setup**
```bash
# 1. Start development server
npm run dev

# 2. Type check for errors
npm run type-check

# 3. Lint check
npm run lint

# 4. Mobile testing (optional)
npm run build
npx cap sync android
npx cap open android
```

### **Test Data Requirements**
- Owner account logged in
- At least one service contract with assigned vendor
- At least one tenancy contract
- Test properties and tenants in database

---

## 🧪 **Testing Flow 1: Enhanced Owner Contract List**

### **Step 1: Access Owner Dashboard**
1. Navigate to: `http://localhost:3000/dashboard/owner`
2. **Expected Result:** Owner dashboard loads with:
   - ✅ Portfolio summary section
   - ✅ Quick action buttons (Contracts, My Vendors, Maintenance)
   - ✅ Bottom navigation tabs (Home, Properties, Tenants, Income, Profile)

### **Step 2: Access Contracts Page**
1. **Method 1:** Click "Contracts" quick action button
2. **Method 2:** Navigate directly to: `http://localhost:3000/dashboard/owner/contracts`
3. **Expected Result:** Enhanced contract list page loads with:
   - ✅ **Search bar** at the top with magnifying glass icon
   - ✅ **Filter dropdowns** (Status, Type, Priority)
   - ✅ **Sort dropdown** (Created Date, Contract Value, Renewal Date, Priority)
   - ✅ **"Create Tenancy" button** in header
   - ✅ **Rich contract cards** with detailed information

### **Step 3: Test Search Functionality**
1. **Type in search bar:** Try searching by:
   - Contract title (e.g., "Plumbing", "Maintenance")
   - Property name (e.g., "Test Property", "Building A")
   - Vendor name (e.g., "Appopoleis", "Vendor Name")
   - Tenant name (e.g., "John", "Tenant Name")
2. **Expected Result:** 
   - ✅ Contracts filter in real-time as you type
   - ✅ Search is case-insensitive
   - ✅ Results update immediately

### **Step 4: Test Filtering**
1. **Status Filter:** Select different statuses:
   - `draft` - Should show only draft contracts
   - `pending_signatures` - Should show only pending contracts
   - `active` - Should show only active contracts
   - `completed` - Should show only completed contracts
   - `terminated` - Should show only terminated contracts
   - `expired` - Should show only expired contracts
   - `all` - Should show all contracts

2. **Type Filter:** Select different types:
   - `maintenance` - Service maintenance contracts
   - `retainer` - Retainer service contracts
   - `project` - Project-based contracts
   - `emergency` - Emergency service contracts
   - `tenancy` - Tenancy contracts
   - `all` - All contract types

3. **Priority Filter:** Select different priorities:
   - `low` - Low priority contracts
   - `medium` - Medium priority contracts
   - `high` - High priority contracts
   - `urgent` - Urgent priority contracts
   - `all` - All priorities

4. **Expected Result:** 
   - ✅ Only contracts matching selected filters display
   - ✅ Filter combinations work correctly
   - ✅ Results count updates appropriately

### **Step 5: Test Sorting**
1. **Click Sort dropdown** and try different options:
   - **Created Date** (newest/oldest first)
   - **Contract Value** (highest/lowest first)
   - **Renewal Date** (soonest/latest first)
   - **Priority** (urgent to low)
2. **Expected Result:** 
   - ✅ Contracts reorder based on selected criteria
   - ✅ Sort direction works correctly
   - ✅ Empty/null values handled properly

### **Step 6: Test Contract Cards**
1. **Examine each contract card** for:
   - ✅ **Contract title** and basic info
   - ✅ **Status badges** (color-coded: blue=active, yellow=pending, green=completed, red=terminated)
   - ✅ **Type badges** (color-coded by contract type)
   - ✅ **Priority badges** (for service contracts only)
   - ✅ **Contract value** (formatted as currency: R 1,234.56)
   - ✅ **SLA hours** (for service contracts: "24h", "48h")
   - ✅ **Renewal date** (with warning if <30 days: "Renewal: 15 days")
   - ✅ **Vendor rating** (for service contracts: "4.5/5")
   - ✅ **Document count** ("3 documents")
   - ✅ **Notification count** (red badge if >0: "2")
   - ✅ **Action buttons** (Message, Request Changes, Update Status)

### **Step 7: Test Create Tenancy Form**
1. **Click "Create Tenancy" button**
2. **Expected Result:** Collapsible form appears with:
   - ✅ **Template dropdown** (if templates exist)
   - ✅ **Title input field** (dark text, visible placeholder)
   - ✅ **Property dropdown** (populated with owner properties)
   - ✅ **Tenant search section** (input + resolve button)
   - ✅ **Action buttons** (Create Tenancy Contract, Cancel)

3. **Fill the form:**
   - Enter title: "New Tenancy Contract"
   - Select property from dropdown
   - Enter tenant name: "John Doe"
   - Click "Resolve" button
   - Verify tenant is found and selected

4. **Click "Create Tenancy Contract"**
5. **Expected Result:** 
   - ✅ New tenancy contract created
   - ✅ Contract appears in the list
   - ✅ Form collapses
   - ✅ Success message displayed

---

## 🧪 **Testing Flow 2: Owner Contract Actions**

### **Step 8: Test Message Vendor Action**
1. **Find a service contract** with an assigned vendor
2. **Click "Message" button** on the contract card
3. **Expected Result:** Navigates to: `/dashboard/owner/contracts/{id}/message`
4. **Test the messaging interface:**
   - ✅ **Contract details** displayed at the top
   - ✅ **Message history** loads (if any messages exist)
   - ✅ **Message input field** present with send button
   - ✅ **Auto-scroll** to latest messages

5. **Send a test message:**
   - Type: "Hello vendor, this is a test message from owner"
   - Click "Send" button
6. **Expected Result:** 
   - ✅ Message appears in chat immediately
   - ✅ Notification sent to vendor
   - ✅ Event logged in audit trail
   - ✅ Message persists after page refresh

### **Step 9: Test Request Changes Action**
1. **Click "Request Changes" button** on any contract card
2. **Expected Result:** Navigates to: `/dashboard/owner/contracts/{id}/request-changes`
3. **Test the request changes interface:**
   - ✅ **Contract details** displayed
   - ✅ **Change request form** present with fields:
     - Title (required)
     - Description (required)
     - Type dropdown (timeline, scope, cost, quality)
     - Priority dropdown (low, medium, high, urgent)
   - ✅ **Existing change requests** list (if any)

4. **Submit a change request:**
   - **Title:** "Request for timeline adjustment"
   - **Description:** "Please extend the completion date by 2 weeks"
   - **Type:** Select "timeline"
   - **Priority:** Select "medium"
   - Click "Submit Request"
5. **Expected Result:**
   - ✅ Change request created successfully
   - ✅ Notification sent to vendor
   - ✅ Event logged in audit trail
   - ✅ Request appears in the list
   - ✅ Status shows as "pending"

### **Step 10: Test Update Status Action**
1. **Click "Update Status" button** on any contract card
2. **Expected Result:** Navigates to: `/dashboard/owner/contracts/{id}/update-status`
3. **Test the status update interface:**
   - ✅ **Contract details** displayed
   - ✅ **Status update form** present with:
     - New Status dropdown (draft, pending_signatures, active, completed, terminated, expired)
     - Notes textarea
   - ✅ **Status history** list (if any)

4. **Update contract status:**
   - **New Status:** Select "active" (or any other status)
   - **Notes:** "Contract is now active and work can begin"
   - Click "Update Status"
5. **Expected Result:**
   - ✅ Contract status updated in database
   - ✅ Notification sent to vendor
   - ✅ Event logged in audit trail
   - ✅ Status update appears in history
   - ✅ If status is "completed", completion date automatically set

---

## 🧪 **Testing Flow 3: Contract Detail View**

### **Step 11: Test Contract Detail Navigation**
1. **Click on any contract card** (not the action buttons)
2. **Expected Result:** Navigates to: `/contracts?id={contract_id}`
3. **Test the generic contract detail page:**
   - ✅ **Contract information** displayed comprehensively
   - ✅ **Timeline** shows contract events
   - ✅ **Role-specific actions** available for owner
   - ✅ **Documents section** present
   - ⚠️ **Messages section** - Currently missing (needs implementation)

---

## 🧪 **Testing Flow 4: Mobile Responsiveness**

### **Step 12: Test Mobile View**
1. **Open browser dev tools** (F12)
2. **Toggle device toolbar** (mobile view)
3. **Test on different screen sizes:**
   - iPhone SE (375px)
   - iPhone 12 (390px)
   - Samsung Galaxy (412px)
4. **Expected Result:**
   - ✅ **All elements properly sized** for mobile
   - ✅ **Touch targets large enough** (minimum 44px)
   - ✅ **No horizontal scrolling**
   - ✅ **Action buttons easily tappable**
   - ✅ **Form inputs accessible on mobile**

---

## 🧪 **Testing Flow 5: Error Handling**

### **Step 13: Test Error Scenarios**
1. **Test with no contracts:**
   - If no contracts exist, should see "No contracts found" message
2. **Test network errors:**
   - Disconnect internet temporarily
   - Try to load contracts
   - **Expected Result:** Appropriate error message displayed
3. **Test invalid contract IDs:**
   - Manually navigate to invalid contract action URLs
   - **Expected Result:** "Contract not found" or redirect to contracts list
4. **Test form validation:**
   - Try to submit forms with missing required fields
   - **Expected Result:** Validation errors displayed

---

## 🧪 **Testing Flow 6: Data Persistence**

### **Step 14: Verify Data Changes**
1. **After testing all actions, refresh the page**
2. **Expected Result:**
   - ✅ **All changes persist** in database
   - ✅ **New messages still visible** in chat
   - ✅ **Change requests still listed** in history
   - ✅ **Status updates still applied** to contracts
   - ✅ **Contract status reflects changes** correctly

---

## 🔍 **What to Look For During Testing**

### **✅ Success Indicators:**
- **Smooth navigation** between pages
- **Real-time updates** when sending messages
- **Proper notifications** being sent to vendors
- **Event logging** working correctly
- **Mobile responsiveness** on all screen sizes
- **Data persistence** after page refreshes
- **Proper error handling** for edge cases
- **Form validation** working correctly

### **❌ Potential Issues to Watch For:**
- **TypeScript errors** in console
- **Network request failures**
- **RLS policy violations**
- **Missing data** in contract cards
- **Broken navigation** links
- **Mobile layout issues**
- **Performance problems** with large contract lists
- **Form input text visibility** (should be dark and readable)

---

## 📋 **Testing Checklist**

### **Enhanced Contract List**
- [ ] **Enhanced Contract List loads correctly**
- [ ] **Search functionality works** (title, property, vendor, tenant)
- [ ] **Filters work properly** (status, type, priority)
- [ ] **Sorting works correctly** (all sort options)
- [ ] **Contract cards display all information** (badges, values, dates)
- [ ] **Create Tenancy form works** (all fields, validation, submission)

### **Contract Actions**
- [ ] **Message Vendor action works** (navigation, interface, sending)
- [ ] **Request Changes action works** (navigation, form, submission)
- [ ] **Update Status action works** (navigation, form, submission)
- [ ] **Contract detail navigation works** (clicking card, loading details)

### **Technical & UX**
- [ ] **Mobile responsiveness is good** (all screen sizes)
- [ ] **Error handling works** (network errors, validation)
- [ ] **Data persistence is maintained** (after refresh)
- [ ] **No console errors** (TypeScript, JavaScript)
- [ ] **No TypeScript errors** (type checking passes)
- [ ] **Form input text is visible** (dark text, good contrast)

---

## 🚀 **Next Steps After Testing**

### **If All Tests Pass:**
1. ✅ **Feature parity achieved** for contract management actions
2. ✅ **Owner dashboard navigation** optimized and working
3. ✅ **Enhanced contract list** fully functional
4. ✅ **Contract actions** working correctly

### **If Issues Found:**
1. **Document specific issues** with screenshots and error messages
2. **Categorize issues** (UI, functionality, performance, mobile)
3. **Prioritize fixes** based on user impact
4. **Implement fixes** and retest

### **Ready for Next Phase:**
- **Quote Management System** implementation
- **Enhanced messaging** in contract detail page
- **Real-time notifications** implementation
- **Payment integration** features

---

## 🐛 **Known Issues & Solutions**

### **Issue 1: Create Tenancy Form Text Visibility**
- **Problem:** Input text too light to see
- **Solution:** Added `text-gray-900 placeholder-gray-600` classes
- **Status:** ✅ Fixed

### **Issue 2: Missing Messaging in Contract Detail**
- **Problem:** Generic contract detail page lacks messaging interface
- **Solution:** Need to add messaging section to `/contracts/page.tsx`
- **Status:** ⚠️ Pending implementation

### **Issue 3: Request Changes for Active Contracts**
- **Question:** Should active contracts allow change requests?
- **Recommendation:** YES, with restrictions (timeline, scope, cost, quality)
- **Status:** ⚠️ Needs validation logic implementation

---

## 📞 **Support & Troubleshooting**

### **Common Issues:**
1. **Contracts not loading:** Check RLS policies and user permissions
2. **Actions not working:** Verify user role is 'owner'
3. **Mobile layout issues:** Test on actual mobile devices
4. **Form submission errors:** Check browser console for details

### **Debug Commands:**
```bash
# Check for TypeScript errors
npm run type-check

# Check for lint errors
npm run lint

# Build for production
npm run build

# Test mobile build
npx cap sync android
npx cap open android
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-19  
**Tested Features:** Enhanced Owner Contract List, Contract Actions, Navigation Improvements
