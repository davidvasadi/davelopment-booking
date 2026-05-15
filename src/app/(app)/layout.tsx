import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bookly - Online Időpontfoglaló',
  description: 'Egyszerű, modern időpontfoglaló rendszer kis vállalkozásoknak',
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
        </ThemeProvider>
      </body>
    </html>
  )
}
