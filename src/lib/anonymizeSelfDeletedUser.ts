import crypto from 'crypto'
import type { Payload } from 'payload'

/**
 * Self-delete (a user a SAJÁT fiókját törli, utolsó üzletként) — NEM tényleges `payload.delete`,
 * hanem anonymizálás: a bejelentkezéshez/azonosításhoz szükséges minden adat eltűnik (email
 * felszabadul újraregisztrációra, jelszó véletlenszerű, PII törölve), de a SOR megmarad
 * `deleted_at` időbélyeggel — csalás/próbaidő-visszaélés ellen (ld. `TrialLedger` is, ami az
 * emailt EZTŐL függetlenül, örökre megjegyzi). A backstage admin "végleges törlés" ezzel
 * szemben tényleg töröl (`Users.beforeDelete` → `cascadeDeleteUserBusinesses`).
 *
 * Az eredeti email NEM marad rajta a soron (különben blokkolná az újraregisztrációt ugyanazzal
 * a címmel) — helyette egy visszafejthetetlen, ütközésmentes placeholder kerül rá.
 */
export async function anonymizeSelfDeletedUser(payload: Payload, userId: number | string): Promise<void> {
  const placeholderEmail = `deleted-${userId}-${Date.now()}@deleted.davelopment.hu`
  const randomPassword = crypto.randomBytes(32).toString('base64url')

  await payload.update({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    data: {
      email: placeholderEmail,
      password: randomPassword,
      name: 'Törölt felhasználó',
      avatar_url: null,
      phone: null,
      birthday: null,
      address: null,
      tax_id: null,
      tax_number: null,
      emergency_contact: null,
      bio: null,
      role_title: null,
      salon: null,
      restaurant: null,
      last_active_business: null,
      _verified: false,
      deleted_at: new Date().toISOString(),
    },
  })
}
