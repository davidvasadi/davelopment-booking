/**
 * Központi márka- és domain-konfiguráció.
 *
 * Ez az EGYETLEN hely, ahol a termék neve, domainje és kapcsolati adatai
 * definiálva vannak. A domain-/névcsere (pl. schedulio.hu → booking.davelopment.hu)
 * kizárólag itt vagy a hozzá tartozó env-változókban történik.
 *
 * A publikus (kliensbe is kerülő) értékek NEXT_PUBLIC_ env-változóból olvashatók,
 * hogy környezetenként (dev/prod) felülírhatók legyenek build nélkül.
 */

/** Megjelenő márkanév (UI, e-mail feladó, copyright). */
export const BRAND_NAME = 'davelopment booking'

/** A publikus app-URL. Prod: https://booking.davelopment.hu */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
).replace(/\/$/, '')

/** A publikus domain (protokoll nélkül), pl. booking.davelopment.hu. */
export const BRAND_DOMAIN =
  process.env.NEXT_PUBLIC_BRAND_DOMAIN || APP_URL.replace(/^https?:\/\//, '')

/** Kapcsolati e-mail cím (ügyfélszolgálat, jogi oldalak lábléce). */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@davelopment.hu'

/** Copyright-sor éve (statikus, hogy build-determinisztikus legyen). */
export const BRAND_YEAR = 2026

/** Kész copyright-string, pl. „©2026 davelopment booking". */
export const BRAND_COPYRIGHT = `©${BRAND_YEAR} ${BRAND_NAME}`
