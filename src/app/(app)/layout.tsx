import type { Metadata, Viewport } from 'next'
import { Inter, Geist, Martian_Mono, Onest } from 'next/font/google'
import { Toaster } from 'sonner'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
// A landing oldal saját tipográfiája (csak ott használjuk, CSS-változóként).
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const martianMono = Martian_Mono({ subsets: ['latin'], variable: '--font-martian' })
// davelopment-design tipográfia (Crextio "B"): Onest geometrikus groteszk.
const onest = Onest({ subsets: ['latin'], variable: '--font-onest' })

export const metadata: Metadata = {
  title: { template: '%s — Schedulio', default: 'Schedulio — Online Időpontfoglaló' },
  description: 'Egyszerű, modern időpontfoglaló rendszer kis vállalkozásoknak',
  icons: {
    icon: [
      { url: '/favico_light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/favico_dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body className={`${inter.className} ${geist.variable} ${martianMono.variable} ${onest.variable}`}>
        <ThemeProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <Toaster richColors position="top-right" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
