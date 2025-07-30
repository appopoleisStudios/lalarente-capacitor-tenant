/**
 * Role validation utilities for type-safe role handling
 * This prevents unsafe type assertions and ensures runtime safety
 */

/**
 * Valid user roles that are supported by the frontend components
 */
export type ValidUserRole = 'tenant' | 'owner'

/**
 * All possible user roles from the database
 */
export type DatabaseUserRole = 'tenant' | 'owner' | 'vendor' | 'admin'

/**
 * Check if a role is a valid frontend role
 * @param role - The role to validate
 * @returns True if the role is valid for frontend use
 */
export function isValidUserRole(role: string | null | undefined): role is ValidUserRole {
  return role === 'tenant' || role === 'owner'
}

/**
 * Safely extract a valid user role from backend data
 * @param userRole - Explicitly provided user role
 * @param backendRole - Role from the backend/database
 * @returns A valid user role or undefined if invalid
 */
export function getValidUserRole(
  userRole?: ValidUserRole,
  backendRole?: string | null
): ValidUserRole | undefined {
  // If explicitly provided role is valid, use it
  if (userRole && isValidUserRole(userRole)) {
    return userRole
  }
  
  // If backend role is valid, use it
  if (backendRole && isValidUserRole(backendRole)) {
    return backendRole
  }
  
  // Neither role is valid
  return undefined
}

/**
 * Validate and transform a database role to a frontend role
 * @param databaseRole - Role from the database
 * @returns Valid frontend role or undefined
 */
export function validateDatabaseRole(databaseRole: DatabaseUserRole | null | undefined): ValidUserRole | undefined {
  if (!databaseRole) {
    return undefined
  }
  
  return isValidUserRole(databaseRole) ? databaseRole : undefined
}

/**
 * Get role display name for UI
 * @param role - Valid user role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: ValidUserRole): string {
  switch (role) {
    case 'tenant':
      return 'Tenant'
    case 'owner':
      return 'Property Owner'
    default:
      return 'User'
  }
}

/**
 * Check if a role has specific permissions
 * @param role - Valid user role
 * @param permission - Permission to check
 * @returns True if the role has the permission
 */
export function hasPermission(role: ValidUserRole, permission: string): boolean {
  const permissions: Record<ValidUserRole, string[]> = {
    tenant: [
      'view_own_properties',
      'submit_maintenance_requests',
      'view_own_payments',
      'upload_documents',
      'edit_profile'
    ],
    owner: [
      'view_own_properties',
      'manage_properties',
      'view_tenants',
      'manage_maintenance',
      'view_income',
      'edit_profile'
    ]
  }
  
  return permissions[role]?.includes(permission) ?? false
}

/**
 * Get available navigation items for a role
 * @param role - Valid user role
 * @returns Array of navigation items
 */
export function getNavigationItems(role: ValidUserRole) {
  const navigationItems = {
    tenant: [
      { id: 'home', label: 'Home', path: '/dashboard/tenant', icon: 'fas fa-home' },
      { id: 'search', label: 'Search', path: '/properties/search', icon: 'fas fa-search' },
      { id: 'payments', label: 'Payments', path: '/tenant/payments', icon: 'fas fa-credit-card' },
      { id: 'maintenance', label: 'Maintenance', path: '/tenant/maintenance', icon: 'fas fa-tools' },
      { id: 'profile', label: 'Profile', path: '/tenant/profile', icon: 'fas fa-user' }
    ],
    owner: [
      { id: 'home', label: 'Home', path: '/dashboard/owner', icon: 'fas fa-home' },
      { id: 'properties', label: 'Properties', path: '/owner/properties', icon: 'fas fa-building' },
      { id: 'tenants', label: 'Tenants', path: '/owner/tenants', icon: 'fas fa-users' },
      { id: 'income', label: 'Income', path: '/owner/income', icon: 'fas fa-chart-line' },
      { id: 'profile', label: 'Profile', path: '/owner/profile', icon: 'fas fa-user' }
    ]
  }
  
  return navigationItems[role] || []
}

/**
 * Type guard to check if a value is a valid user role
 * @param value - Value to check
 * @returns True if the value is a valid user role
 */
export function isUserRole(value: unknown): value is ValidUserRole {
  return typeof value === 'string' && isValidUserRole(value)
}

/**
 * Safely cast a string to a valid user role
 * @param value - String value to cast
 * @returns Valid user role or undefined
 */
export function safeCastToUserRole(value: string | null | undefined): ValidUserRole | undefined {
  return isValidUserRole(value) ? value : undefined
}

/**
 * Get role-specific color scheme
 * @param role - Valid user role
 * @returns Color scheme object
 */
export function getRoleColorScheme(role: ValidUserRole) {
  const colorSchemes = {
    tenant: {
      primary: 'emerald',
      secondary: 'green',
      accent: 'teal'
    },
    owner: {
      primary: 'blue',
      secondary: 'indigo',
      accent: 'cyan'
    }
  }
  
  return colorSchemes[role]
}

/**
 * Validate role-based access control
 * @param userRole - Current user's role
 * @param requiredRole - Role required for access
 * @returns True if access is allowed
 */
export function canAccess(userRole: ValidUserRole, requiredRole: ValidUserRole | ValidUserRole[]): boolean {
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(userRole)
  }
  
  return userRole === requiredRole
}

/**
 * Get role hierarchy level (for admin purposes)
 * @param role - Valid user role
 * @returns Hierarchy level (higher = more permissions)
 */
export function getRoleHierarchyLevel(role: ValidUserRole): number {
  const hierarchy = {
    tenant: 1,
    owner: 2
  }
  
  return hierarchy[role] || 0
} 