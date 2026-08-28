'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/adsTracking'

/**
 * Google Ads konverziós cél: "összes többi kattintás" a landing oldalon — a davelopment.hu
 * kimenő linknek (DavelopmentBanner) saját, külön eseménye van (ads_conversion_outbound_
 * davelopment), azt itt kihagyjuk, nehogy ugyanaz a kattintás duplán számítson. A figyelő
 * csak addig él, amíg ez a komponens mountolva van (a landing oldalon) — elnavigáláskor a
 * cleanup leveszi, tehát nem méri a landingon kívüli kattintásokat.
 */
export function LandingClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a, button')
      if (!target) return
      const href = target instanceof HTMLAnchorElement ? target.href : ''
      if (href.includes('davelopment.hu')) return
      trackEvent('ads_conversion_platform_clicks')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
