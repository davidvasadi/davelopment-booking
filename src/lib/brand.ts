/**
 * Központi márka- és domain-konfiguráció.
 *
 * Ez az EGYETLEN hely, ahol a termék neve, domainje és kapcsolati adatai
 * definiálva vannak. A domain (booking.davelopment.hu) és a márkanév (davelopment booking)
 * kizárólag itt vagy a hozzá tartozó env-változókban módosítható.
 *
 * A publikus (kliensbe is kerülő) értékek NEXT_PUBLIC_ env-változóból olvashatók,
 * hogy környezetenként (dev/prod) felülírhatók legyenek build nélkül.
 */

/** Megjelenő márkanév (UI, e-mail feladó, copyright). */
export const BRAND_NAME = 'davelopment booking'

/** A rendszer-levelek feladóneve a levelezőben (Dave kérése, 2026-11-08) — az üzletek levelei az üzlet nevén mennek. */
export const EMAIL_SENDER_NAME = '[davelopment]© Booking'

/** A publikus app-URL. Prod: https://booking.davelopment.hu */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
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

/** Ügyfélszolgálati telefonszám (megjelenítés + tel: link) — a /kapcsolat, a főoldali
 *  kapcsolat-szekció és a strukturált adat (contactPoint) is innen olvassa. */
export const CONTACT_PHONE = '+36 30 362 8377'
export const CONTACT_PHONE_TEL = '+36303628377'

/** Ügyfélszolgálati idő — szövegként és schema.org-formában (hétfő–péntek). */
export const SUPPORT_HOURS_TEXT = 'Hétfőtől péntekig, 10:00–15:00'
export const SUPPORT_HOURS = { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '15:00' }

/** A válaszidő, ahogy kommunikáljuk. */
export const SUPPORT_RESPONSE_TEXT = 'Munkaidőben jellemzően néhány órán belül válaszolunk.'
