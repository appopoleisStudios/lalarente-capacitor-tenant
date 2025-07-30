/**
 * Accessibility utilities and helpers
 * This file contains common accessibility patterns and utilities
 */

/**
 * Common ARIA labels for better screen reader support
 */
export const ARIA_LABELS = {
  // Navigation
  NAVIGATION: 'Main navigation',
  QUICK_ACTIONS: 'Quick actions',
  BREADCRUMB: 'Breadcrumb navigation',
  
  // Content sections
  DOCUMENTS: 'Document grid',
  MAINTENANCE: 'Maintenance requests',
  ACTIVITY: 'Recent activity feed',
  PROPERTIES: 'Property listings',
  
  // Actions
  VIEW_ALL: 'View all items',
  SEE_ALL: 'See all items',
  OPEN_DOCUMENT: 'Open document',
  CREATE_REQUEST: 'Create new request',
  EDIT_ITEM: 'Edit item',
  DELETE_ITEM: 'Delete item',
  
  // Status
  LOADING: 'Loading content',
  ERROR: 'Error occurred',
  SUCCESS: 'Operation successful',
  NO_RESULTS: 'No results found',
  
  // Forms
  SEARCH: 'Search',
  SUBMIT: 'Submit form',
  CANCEL: 'Cancel action',
  SAVE: 'Save changes',
  
  // Interactive elements
  TOGGLE: 'Toggle',
  EXPAND: 'Expand section',
  COLLAPSE: 'Collapse section',
  CLOSE: 'Close',
  MENU: 'Menu',
  DROPDOWN: 'Dropdown menu',
} as const

/**
 * Common focus styles for consistent accessibility
 */
export const FOCUS_STYLES = {
  DEFAULT: 'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
  BUTTON: 'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
  INPUT: 'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
  LINK: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
} as const

/**
 * Text size utilities for better readability
 */
export const TEXT_SIZES = {
  SMALL: 'text-sm',      // 14px - Minimum recommended for body text
  MEDIUM: 'text-base',   // 16px - Standard body text
  LARGE: 'text-lg',      // 18px - Enhanced readability
  EXTRA_LARGE: 'text-xl', // 20px - For important content
} as const

/**
 * Color contrast utilities for better visibility
 */
export const CONTRAST_COLORS = {
  PRIMARY: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    hover: 'hover:bg-emerald-200',
  },
  SECONDARY: {
    text: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-200',
  },
  SUCCESS: {
    text: 'text-green-700',
    bg: 'bg-green-100',
    border: 'border-green-200',
    hover: 'hover:bg-green-200',
  },
  WARNING: {
    text: 'text-orange-700',
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    hover: 'hover:bg-orange-200',
  },
  ERROR: {
    text: 'text-red-700',
    bg: 'bg-red-100',
    border: 'border-red-200',
    hover: 'hover:bg-red-200',
  },
} as const

/**
 * Generate accessible button props
 */
export function getAccessibleButtonProps(
  label: string,
  onClick?: () => void,
  disabled = false,
  variant: 'primary' | 'secondary' | 'danger' = 'primary'
) {
  return {
    'aria-label': label,
    'aria-disabled': disabled,
    onClick: disabled ? undefined : onClick,
    className: `${FOCUS_STYLES.BUTTON} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`,
    role: 'button',
    tabIndex: disabled ? -1 : 0,
  }
}

/**
 * Generate accessible link props
 */
export function getAccessibleLinkProps(
  label: string,
  href: string,
  external = false
) {
  return {
    'aria-label': label,
    href,
    target: external ? '_blank' : undefined,
    rel: external ? 'noopener noreferrer' : undefined,
    className: FOCUS_STYLES.LINK,
  }
}

/**
 * Generate accessible input props
 */
export function getAccessibleInputProps(
  label: string,
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' = 'text',
  required = false,
  placeholder?: string
) {
  return {
    'aria-label': label,
    'aria-required': required,
    type,
    placeholder,
    className: FOCUS_STYLES.INPUT,
  }
}

/**
 * Generate accessible status message props
 */
export function getAccessibleStatusProps(
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
  return {
    'aria-live': 'polite',
    'aria-atomic': true,
    role: 'status',
    className: `text-${type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'orange' : 'blue'}-600`,
  }
}

/**
 * Generate accessible list props
 */
export function getAccessibleListProps(
  label: string,
  itemCount: number
) {
  return {
    role: 'list',
    'aria-label': `${label} (${itemCount} items)`,
  }
}

/**
 * Generate accessible list item props
 */
export function getAccessibleListItemProps(
  index: number,
  total: number
) {
  return {
    role: 'listitem',
    'aria-posinset': index + 1,
    'aria-setsize': total,
  }
}

/**
 * Check if element should be hidden from screen readers
 */
export function shouldHideFromScreenReader(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return style.display === 'none' || style.visibility === 'hidden'
}

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Trap focus within a container
   */
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }
    
    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  },
  
  /**
   * Focus first focusable element in container
   */
  focusFirst: (container: HTMLElement) => {
    const firstElement = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement
    
    if (firstElement) {
      firstElement.focus()
    }
  },
  
  /**
   * Focus last focusable element in container
   */
  focusLast: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    if (lastElement) {
      lastElement.focus()
    }
  },
}

/**
 * Skip link component props
 */
export function getSkipLinkProps(targetId: string) {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-emerald-600 text-white px-4 py-2 rounded z-50',
    'aria-label': 'Skip to main content',
  }
}

/**
 * Loading state accessibility
 */
export function getLoadingProps(message = 'Loading content') {
  return {
    'aria-live': 'polite',
    'aria-busy': true,
    role: 'status',
    'aria-label': message,
  }
}

/**
 * Error state accessibility
 */
export function getErrorProps(message: string) {
  return {
    'aria-live': 'assertive',
    role: 'alert',
    'aria-label': `Error: ${message}`,
  }
} 