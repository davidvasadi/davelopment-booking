import type { Metadata, Viewport } from 'next'
import { Inter, Geist, Martian_Mono, Onest } from 'next/font/google'
import { Toaster } from 'sonner'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MotionProvider } from '@/components/MotionProvider'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { BRAND_NAME } from '@/lib/brand'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
// A landing oldal saját tipográfiája (csak ott használjuk, CSS-változóként).
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const martianMono = Martian_Mono({ subsets: ['latin'], variable: '--font-martian' })
// davelopment-design tipográfia (Crextio "B"): Onest geometrikus groteszk.
const onest = Onest({ subsets: ['latin'], variable: '--font-onest' })

export const metadata: Metadata = {
  title: { template: `%s — ${BRAND_NAME}`, default: `${BRAND_NAME} — Online Időpontfoglaló` },
  description: 'Egyszerű, modern időpontfoglaló rendszer kis vállalkozásoknak',
  icons: {
    icon: [
      { url: '/icons/favico_light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/icons/favico_dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/icons/favicon-32.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ECECE8',
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
          <MotionProvider>
            <SmoothScroll>{children}</SmoothScroll>
            {/* Az app-palettához igazított toast (stílus: globals.css → .dav-toast). */}
            <Toaster
              position="top-right"
              gap={10}
              toastOptions={{ className: 'dav-toast', duration: 3600 }}
            />
            <ServiceWorkerRegister />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
