import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'davelopment.hu',
        pathname: '/bookly/uploads/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@radix-ui'],
  },
}

export default withPayload(nextConfig)
