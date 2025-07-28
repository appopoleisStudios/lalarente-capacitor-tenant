import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sa-green': {
          50: '#f0fdf4',
          500: '#006633',
          600: '#005429',
          700: '#004220',
        },
        'sa-gold': {
          50: '#fffbeb',
          500: '#FFB612',
          600: '#e6a510',
          700: '#cc940e',
        },
        'sa-blue': {
          50: '#eff6ff',
          500: '#001489',
          600: '#001174',
          700: '#000e5f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
