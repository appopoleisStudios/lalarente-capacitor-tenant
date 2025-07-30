# Role Validation Guide

This guide explains the role validation system implemented to prevent unsafe type assertions and ensure runtime safety.

## 🎯 Problem Statement

### **The Issue:**
```typescript
// ❌ UNSAFE - Type assertion bypasses compiler checks
const role = userRole || profile?.role
{role && <BottomNavbar userRole={role as 'tenant' | 'owner'} />}
```

### **Why It's Dangerous:**
- `profile?.role` could be any string from the backend (`'admin'`, `'vendor'`, `''`, etc.)
- Type assertion `as 'tenant' | 'owner'` bypasses TypeScript's type checking
- Runtime errors when invalid roles reach components
- Silent failures that are hard to debug

## ✅ Solution Implemented

### **Safe Role Validation:**
```typescript
// ✅ SAFE - Proper validation with type guards
const backendRole = profile?.role
const role: 'tenant' | 'owner' | undefined = 
  userRole ?? 
  (backendRole === 'tenant' || backendRole === 'owner' ? backendRole : undefined)

{role && <BottomNavbar userRole={role} />}
```

## 🛠️ Role Validation Utilities

### **Core Types:**
```typescript
// Valid roles for frontend components
export type ValidUserRole = 'tenant' | 'owner'

// All possible database roles
export type DatabaseUserRole = 'tenant' | 'owner' | 'vendor' | 'admin'
```

### **Key Functions:**

#### **1. `isValidUserRole(role)` - Type Guard**
```typescript
function isValidUserRole(role: string | null | undefined): role is ValidUserRole {
  return role === 'tenant' || role === 'owner'
}

// Usage
if (isValidUserRole(profile.role)) {
  // TypeScript knows profile.role is 'tenant' | 'owner'
  <BottomNavbar userRole={profile.role} />
}
```

#### **2. `getValidUserRole(userRole, backendRole)` - Safe Extraction**
```typescript
function getValidUserRole(
  userRole?: ValidUserRole,
  backendRole?: string | null
): ValidUserRole | undefined {
  if (userRole && isValidUserRole(userRole)) {
    return userRole
  }
  
  if (backendRole && isValidUserRole(backendRole)) {
    return backendRole
  }
  
  return undefined
}

// Usage
const role = getValidUserRole(userRole, profile?.role)
{role && <BottomNavbar userRole={role} />}
```

#### **3. `validateDatabaseRole(databaseRole)` - Database Validation**
```typescript
function validateDatabaseRole(databaseRole: DatabaseUserRole | null | undefined): ValidUserRole | undefined {
  if (!databaseRole) {
    return undefined
  }
  
  return isValidUserRole(databaseRole) ? databaseRole : undefined
}
```

## 🔧 Implementation Examples

### **1. DashboardLayout Component**
```typescript
// Before (UNSAFE)
export default function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const { profile } = useAuthStore()
  const role = userRole || profile?.role
  
  return (
    <div>
      {children}
      {role && <BottomNavbar userRole={role as 'tenant' | 'owner'} />}
    </div>
  )
}

// After (SAFE)
export default function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const { profile } = useAuthStore()
  
  // Safely extract and validate the role
  const backendRole = profile?.role
  const role: ValidUserRole | undefined = getValidUserRole(userRole, backendRole)

  return (
    <div>
      {children}
      {role && <BottomNavbar userRole={role} />}
    </div>
  )
}
```

### **2. ProtectedRoute Component**
```typescript
// Before (UNSAFE)
if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
  router.push('/unauthorized')
}

// After (SAFE)
if (allowedRoles && profile) {
  // Check if the profile role is valid for frontend use
  if (!isValidUserRole(profile.role)) {
    console.warn(`Unsupported role: ${profile.role}. Redirecting to unauthorized.`)
    router.push('/unauthorized')
    return
  }
  
  // Check if the user's role is in the allowed roles
  if (!allowedRoles.includes(profile.role)) {
    router.push('/unauthorized')
    return
  }
}
```

## 🎨 Additional Utilities

### **Role Display Names:**
```typescript
getRoleDisplayName('tenant') // Returns: 'Tenant'
getRoleDisplayName('owner')  // Returns: 'Property Owner'
```

### **Permission Checking:**
```typescript
hasPermission('tenant', 'submit_maintenance_requests') // true
hasPermission('owner', 'manage_properties')           // true
hasPermission('tenant', 'manage_properties')          // false
```

### **Navigation Items:**
```typescript
const tenantNav = getNavigationItems('tenant')
// Returns: [
//   { id: 'home', label: 'Home', path: '/dashboard/tenant', icon: 'fas fa-home' },
//   { id: 'search', label: 'Search', path: '/properties/search', icon: 'fas fa-search' },
//   // ... more items
// ]
```

### **Color Schemes:**
```typescript
const colors = getRoleColorScheme('tenant')
// Returns: { primary: 'emerald', secondary: 'green', accent: 'teal' }
```

### **Access Control:**
```typescript
canAccess('tenant', 'tenant')           // true
canAccess('owner', ['tenant', 'owner']) // true
canAccess('tenant', 'owner')            // false
```

## 🔍 Database Schema Alignment

### **Database Enum:**
```sql
CREATE TYPE user_role AS ENUM ('tenant', 'owner', 'vendor', 'admin');
```

### **TypeScript Types:**
```typescript
// Database type (all possible values)
type DatabaseUserRole = 'tenant' | 'owner' | 'vendor' | 'admin'

// Frontend type (only supported values)
type ValidUserRole = 'tenant' | 'owner'
```

### **Validation Strategy:**
1. **Accept** all database roles in data layer
2. **Validate** roles before using in UI components
3. **Handle** unsupported roles gracefully (redirect, warn, etc.)
4. **Type** components to expect only valid roles

## 🚨 Error Handling

### **Unsupported Roles:**
```typescript
// Log warning and redirect
if (!isValidUserRole(profile.role)) {
  console.warn(`Unsupported role: ${profile.role}. User: ${profile.id}`)
  router.push('/unauthorized')
  return
}
```

### **Missing Roles:**
```typescript
// Graceful fallback
const role = getValidUserRole(userRole, profile?.role)
if (!role) {
  // Handle missing/invalid role
  return <UnauthorizedPage />
}
```

### **Development Debugging:**
```typescript
// Add to development builds
if (process.env.NODE_ENV === 'development') {
  console.log('Role validation:', {
    userRole,
    backendRole: profile?.role,
    isValid: isValidUserRole(profile?.role),
    finalRole: role
  })
}
```

## 📋 Best Practices

### **1. Always Validate Before Use**
```typescript
// ❌ Don't do this
const role = profile?.role as ValidUserRole

// ✅ Do this
const role = getValidUserRole(undefined, profile?.role)
```

### **2. Use Type Guards**
```typescript
// ❌ Don't do this
if (profile?.role === 'tenant' || profile?.role === 'owner') {
  // TypeScript doesn't know the type is narrowed
}

// ✅ Do this
if (isValidUserRole(profile?.role)) {
  // TypeScript knows profile.role is ValidUserRole
}
```

### **3. Handle Edge Cases**
```typescript
// Always provide fallbacks
const role = getValidUserRole(userRole, profile?.role) || 'tenant' // Default fallback
```

### **4. Log Unsupported Roles**
```typescript
// Help with debugging and monitoring
if (profile?.role && !isValidUserRole(profile.role)) {
  console.warn(`Unsupported role encountered: ${profile.role}`)
}
```

## 🧪 Testing

### **Unit Tests:**
```typescript
describe('Role Validation', () => {
  it('should validate tenant role', () => {
    expect(isValidUserRole('tenant')).toBe(true)
  })
  
  it('should validate owner role', () => {
    expect(isValidUserRole('owner')).toBe(true)
  })
  
  it('should reject vendor role', () => {
    expect(isValidUserRole('vendor')).toBe(false)
  })
  
  it('should reject admin role', () => {
    expect(isValidUserRole('admin')).toBe(false)
  })
  
  it('should handle null/undefined', () => {
    expect(isValidUserRole(null)).toBe(false)
    expect(isValidUserRole(undefined)).toBe(false)
  })
})
```

### **Integration Tests:**
```typescript
describe('DashboardLayout', () => {
  it('should render BottomNavbar for valid roles', () => {
    render(<DashboardLayout userRole="tenant">Content</DashboardLayout>)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
  
  it('should not render BottomNavbar for invalid roles', () => {
    // Mock profile with invalid role
    mockProfile.role = 'vendor'
    render(<DashboardLayout>Content</DashboardLayout>)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
```

## 🔄 Migration Guide

### **Step 1: Replace Type Assertions**
```typescript
// Find all instances of:
role as 'tenant' | 'owner'

// Replace with:
getValidUserRole(userRole, backendRole)
```

### **Step 2: Update Component Props**
```typescript
// Update interfaces to use ValidUserRole
interface Props {
  userRole: ValidUserRole // Instead of 'tenant' | 'owner'
}
```

### **Step 3: Add Validation**
```typescript
// Add validation in data flow
const role = getValidUserRole(userRole, profile?.role)
if (!role) {
  // Handle invalid role
}
```

### **Step 4: Test Edge Cases**
```typescript
// Test with various role combinations
- Valid roles: 'tenant', 'owner'
- Invalid roles: 'vendor', 'admin', '', null, undefined
- Mixed scenarios: valid userRole + invalid backendRole
```

## 📚 Related Files

- `src/utils/roleValidation.ts` - Core validation utilities
- `src/components/DashboardLayout.tsx` - Updated to use safe validation
- `src/components/ProtectedRoute.tsx` - Enhanced role checking
- `src/components/BottomNavbar.tsx` - Expects only valid roles
- `src/types/supabase.ts` - Database type definitions

---

This role validation system ensures type safety, prevents runtime errors, and provides a robust foundation for handling user roles throughout the application. 