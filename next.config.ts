import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const CSP = [
  "default-src 'self'",
  // Marketing-követés (Beállítások → Integrációk): csak Google Analytics 4 + Facebook Pixel
  // konkrét, ismert domainjei — SZÁNDÉKOSAN nincs teljes Google Tag Manager, mert az utólag
  // tetszőleges más szkriptet is engedélyezne a saját felületén keresztül, ami ezt a szigorú
  // allowlistet érdemben feleslegessé tenné.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:*",
  "font-src 'self' data:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://nominatim.openstreetmap.org https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
  "frame-ancestors 'none'",
].join('; ')

// A beágyazható foglaló-widgethez (`?embed=1`) EZ a CSP kell — minden más direktíva
// változatlan, csak a frame-ancestors enged bármilyen külső oldalt iframe-ként.
// NINCS X-Frame-Options mellette (az elavult és nem támogat wildcardot).
const EMBED_CSP = CSP.replace("frame-ancestors 'none'", 'frame-ancestors *')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        missing: [{ type: 'query', key: 'embed', value: '1' }],
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      {
        // Csak a `?embed=1`-es publikus foglaló-nézet kap engedékenyebb keretezési szabályt —
        // minden más route (a teljes dashboard is) a fenti szigorú szabály alatt marad.
        source: '/(.*)',
        has: [{ type: 'query', key: 'embed', value: '1' }],
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: EMBED_CSP },
        ],
      },
    ]
  },
  ...(process.env.ALLOWED_DEV_ORIGINS
    ? { allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(',') }
    : {}),
  images: {
    remotePatterns: [
      // A Payload a médiafájlokat a saját `/api/media/file/...` REST-útvonalán szolgálja ki
      // (nem a `/uploads/...` statikus mappán keresztül közvetlenül) — a `next/image` a
      // `remotePatterns`-hez NEM illeszkedő URL-eket 400-zal utasítja el, ezért ennek pontosan
      // egyeznie kell a valós kiszolgálási útvonallal.
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/api/media/**',
      },
      {
        protocol: 'https',
        hostname: 'booking.davelopment.hu',
        pathname: '/api/media/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@radix-ui'],
  },
}

export default withPayload(nextConfig)
