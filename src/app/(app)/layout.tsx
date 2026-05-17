import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <ThemeProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
