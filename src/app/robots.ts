import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/publicSeo'

/**
 * robots.txt: a publikus profil-oldalak (/[slug]) indexelhetők, a privát/admin és
 * interaktív útvonalak nem. A sitemap a publikus profilokat sorolja fel.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/restaurant/',
        '/login',
        '/register',
        '/register-restaurant',
        '/forgot-password',
        '/reset-password',
        '/team/',
        '/admin/', // Payload admin
        '/*/book', // a foglaló wizard (noindex is védi)
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
