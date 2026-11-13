import type { Where } from 'payload'

/**
 * Belépési e-mail (2026-11): egy fiókba az elsődleges címmel ÉS a megerősített másodlagos címmel (Saját profil › Belépés)
 * is be lehet lépni — kóddal és Google-lel is. A levelek (értesítők, számlák) mindig az elsődleges címre mennek.
 * Ez a szűrő minden olyan helyen kell, ahol e-mail alapján keresünk fiókot belépéshez / foglaltság-ellenőrzéshez.
 */
export function loginEmailWhere(email: string): Where {
  const e = email.trim().toLowerCase()
  return {
    or: [
      { email: { equals: e } },
      { and: [{ secondary_email: { equals: e } }, { secondary_email_verified_at: { exists: true } }] },
    ],
  }
}
