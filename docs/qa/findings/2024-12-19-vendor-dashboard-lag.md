# Finding: Vendor Dashboard Data Fetch Lag

## 📋 Finding Details
- **Date**: 2024-12-19
- **Tester**: Arsalan Shaikh
- **Device**: Samsung M33
- **App Version**: Debug Build
- **Severity**: Medium
- **Priority**: High
- **Status**: Open

## 🎯 Issue Description
**What happened**: When accessing the Vendor Dashboard, there is noticeable lag (1 second) when the page loads and fetches data from the database.

**Expected behavior**: Dashboard should load quickly with minimal delay (< 1 second).

**Actual behavior**: Dashboard takes 1 second to load, there is no loading spinner as well.

## 📍 Location & Steps to Reproduce
**Screen/Page**: `/dashboard/vendor`

**Steps to reproduce**:
1. Open the app on phone
2. Login as vendor user
3. Navigate to Vendor Dashboard
4. Observe loading time when data appears on cards

**Frequency**: 100% (happens every time)

## 🔍 Technical Details
- **Component**: `src/app/dashboard/vendor/page.tsx`
- **Data Source**: Supabase vendor related tables
- **Query**: Loading dashboard with related data on cards
- **Network**: Wifi

## 📊 Impact Assessment
- **User Experience**: Poor - users wait too long
- **Business Impact**: Users may abandon app due to slow performance
- **Affected Users**: All vendor users

## 💡 Suggested Solutions
**Long-term**: Optimize database queries and add caching

## 📸 Screenshots/Evidence
No screenshots its lag that cannot be captured on screenshot

## 🔗 Related Issues
- None identified yet

## 📝 Notes
- Issue occurs on every load
- May be related to large dataset or unoptimized queries

---
*Template: finding-template.md*
