import type { Metadata } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: { template: '%s — Bookly', default: 'Bookly' },
  description: 'Online időpontfoglaló szalonoknak',
}

export default function BooklyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  )
}
