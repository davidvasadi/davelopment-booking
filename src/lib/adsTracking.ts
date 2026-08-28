'use client'

/**
 * Google Ads konverziós események + sima GA4 esemény küldése — a `PlatformAnalytics` már
 * betöltötte a `gtag`-et (csak süti-elfogadás UTÁN), ezért itt csak best-effort hívunk rá,
 * ha épp elérhető (elutasított süti / még be nem töltött szkript esetén csendben nem csinál
 * semmit, nem dob hibát).
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag === 'function') gtag('event', eventName, params ?? {})
}
