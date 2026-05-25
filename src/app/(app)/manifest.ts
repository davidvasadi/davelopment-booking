import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Schedulio',
    short_name: 'Schedulio',
    description: 'Étterem- és szalonfoglaló — offline vázlat módban is működik',
    start_url: '/restaurant/bookings',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#09090b',
    icons: [
      { src: '/favico_light.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
