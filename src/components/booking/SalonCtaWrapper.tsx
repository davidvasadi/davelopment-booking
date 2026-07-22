'use client'

import type { ReactNode } from 'react'

/**
 * Capture-fázisban elfogja a kattintást a gyerek Link/gomb előtt,
 * megakadályozza a navigációt és helyette a ProfileCard services nézetét nyitja
 * (`schedulio:openServices` custom DOM event).
 */
export function SalonCtaWrapper({ children }: { children: ReactNode }) {
  return (
    <div
      onClickCapture={e => {
        e.preventDefault()
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('schedulio:openServices'))
      }}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </div>
  )
}
