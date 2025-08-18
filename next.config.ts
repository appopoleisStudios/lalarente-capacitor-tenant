/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mobile-only static export for Capacitor
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Mobile-optimized settings
  compress: false,
  poweredByHeader: false
}

module.exports = nextConfig
