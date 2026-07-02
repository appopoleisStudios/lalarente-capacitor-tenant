/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7f0',
          100: '#ccefe1',
          200: '#99dfc3',
          300: '#66cfa5',
          400: '#33bf87',
          500: '#007A4D', // SA Flag Green
          600: '#00623d',
          700: '#004a2e',
          800: '#00311e',
          900: '#00190f',
        },
        secondary: {
          50: '#fffbf0',
          100: '#fff7e0',
          200: '#ffefc2',
          300: '#ffe7a3',
          400: '#ffdf85',
          500: '#FFB81C', // SA Flag Gold
          600: '#cc9316',
          700: '#996e11',
          800: '#66490b',
          900: '#332506',
        },
        success: {
          50: '#e6f7f0',
          500: '#007A4D',
          600: '#00623d',
          700: '#004a2e',
        },
        error: {
          50: '#fef2f2',
          500: '#DE3831',
          600: '#b82d27',
          700: '#92241e',
        },
        warning: {
          50: '#fffbf0',
          500: '#FFB81C',
          600: '#cc9316',
          700: '#996e11',
        },
        info: {
          50: '#e6ebf5',
          500: '#002395',
          600: '#001c77',
          700: '#001559',
        },
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
      },
      fontFamily: {
        regular: ['Inter-Regular', 'sans-serif'],
        medium: ['Inter-Medium', 'sans-serif'],
        semibold: ['Inter-SemiBold', 'sans-serif'],
        bold: ['Inter-Bold', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
