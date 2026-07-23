export const colors = {
  // Primary palette - SA Green (Growth, Stability, Property)
  primary: {
    50: '#e6f7f0',
    100: '#ccefe1',
    200: '#99dfc3',
    300: '#66cfa5',
    400: '#33bf87',
    500: '#007A4D', // SA Flag Green - Main brand color
    600: '#00623d',
    700: '#004a2e',
    800: '#00311e',
    900: '#00190f',
  },
  
  // Secondary palette - SA Gold (Prosperity, Premium)
  secondary: {
    50: '#fffbf0',
    100: '#fff7e0',
    200: '#ffefc2',
    300: '#ffe7a3',
    400: '#ffdf85',
    500: '#FFB81C', // SA Flag Gold - Accent color
    600: '#cc9316',
    700: '#996e11',
    800: '#66490b',
    900: '#332506',
  },
  
  // Semantic colors
  success: {
    50: '#e6f7f0',
    500: '#007A4D', // Use SA Green for success
    600: '#00623d',
    700: '#004a2e',
  },
  
  error: {
    50: '#fef2f2',
    500: '#DE3831', // SA Flag Red - For errors/urgent
    600: '#b82d27',
    700: '#92241e',
  },
  
  warning: {
    50: '#fffbf0',
    500: '#FFB81C', // SA Gold for warnings
    600: '#cc9316',
    700: '#996e11',
  },
  
  info: {
    50: '#e6ebf5',
    500: '#002395', // SA Flag Blue - For information
    600: '#001c77',
    700: '#001559',
  },
  
  // Neutrals
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  
  // Text colors
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#a3a3a3',
    inverse: '#ffffff',
    disabled: '#d4d4d4',
  },
  
  // Background colors
  background: {
    default: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f5f5f5',
    inverse: '#171717',
  },
  
  // Border colors
  border: {
    default: '#e5e5e5',
    focus: '#007A4D', // SA Green for focus states
    error: '#DE3831', // SA Red for errors
  },
  
  // RSA Brand Colors (Direct access)
  rsa: {
    green: '#007A4D',   // SA Flag Green - Tenant primary
    gold: '#FFB81C',    // SA Flag Gold - Vendor primary
    blue: '#002395',    // SA Flag Blue - Owner primary
    red: '#DE3831',     // SA Flag Red - Errors/urgent
    white: '#FFFFFF',
    black: '#000000',
  },

  // Role-based theme colors — each role has its own primary/secondary from RSA flag
  role: {
    tenant: {
      primary: '#007A4D',    // RSA Green
      secondary: '#FFB81C',  // RSA Gold
      tertiary: '#002395',   // RSA Blue for info links on tenant
      background: '#e6f7f0', // Light green tint
    },
    owner: {
      primary: '#002395',    // RSA Blue
      secondary: '#007A4D',  // RSA Green
      tertiary: '#FFB81C',   // RSA Gold for accents on owner
      background: '#e6ebf5', // Light blue tint
    },
    vendor: {
      primary: '#FFB81C',    // RSA Gold
      secondary: '#007A4D',  // RSA Green
      tertiary: '#002395',   // RSA Blue for info links on vendor
      background: '#fffbf0', // Light gold tint
    },
  },
};
