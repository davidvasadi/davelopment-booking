'use client'

import { useEffect } from 'react'

export function ForceLightTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    return () => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', dark)
    }
  }, [])

  return <>{children}</>
}
