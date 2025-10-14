/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === 'true' || process.env.NEXT_OUTPUT === 'export'

const nextConfig = {
  // Enable static export only when explicitly requested (dynamic routes otherwise fail)
  ...(isStaticExport ? { output: 'export' } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Mobile-optimized settings
  compress: false,
  poweredByHeader: false
}

module.exports = nextConfig
