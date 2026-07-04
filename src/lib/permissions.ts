/**
 * KÖNNYŰ RBAC — defenzív szerep→képesség leképezés a CSAPAT & JOGOK funkcióhoz.
 *
 * FONTOS: ez NEM a hozzáférés-kapu. A tulaj-hozzáférést továbbra is az `owner` mező +
 * getOwnedSalon/Restaurant adja (az sértetlen). Ez a helper csak a UI-finomhangoláshoz és
 * a jövőbeli, fokozatos jogosultság-szűkítéshez ad egy tiszta, egy helyen tartott szabályt.
 * A tulaj (owner) MINDIG mindent tehet.
 */

export type TeamRole = 'owner' | 'manager' | 'staff'

export type Capability =
  | 'settings.billing' // Számlázás megtekintése/kezelése
  | 'settings.team' // Csapat kezelése (meghívás, szerep, eltávolítás)
  | 'settings.danger' // Veszélyzóna (üzlet törlése stb.)
  | 'settings.profile' // Üzlet-profil / foglalási szabályok szerkesztése
  | 'bookings.manage' // Foglalások kezelése

const MATRIX: Record<TeamRole, Capability[]> = {
  owner: ['settings.billing', 'settings.team', 'settings.danger', 'settings.profile', 'bookings.manage'],
  manager: ['settings.team', 'settings.profile', 'bookings.manage'],
  staff: ['bookings.manage'],
}

/** Megteheti-e az adott szerep a képességet? Ismeretlen szerep → csak a staff-jogok. */
export function can(role: TeamRole | null | undefined, capability: Capability): boolean {
  const caps = MATRIX[(role ?? 'staff') as TeamRole] ?? MATRIX.staff
  return caps.includes(capability)
}

/** Emberi felirat a szerephez (badge-ekhez). */
export function roleLabel(role: TeamRole | null | undefined): string {
  switch (role) {
    case 'owner':
      return 'Tulajdonos'
    case 'manager':
      return 'Menedzser'
    default:
      return 'Munkatárs'
  }
}
