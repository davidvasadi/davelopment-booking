/**
 * RBAC — képességek + szerepek. A `can(caps, capability)` az EGYETLEN jogosultság-forrás:
 * a UI-elrejtés, az oldal-hozzáférés ÉS az API-guard is ezt hívja.
 *
 * MODELL: az EGYETLEN beépített jog a TULAJDONOS (owner) — ő mindig mindent lát/kezel (örökölt).
 * Minden más tag jogai KIZÁRÓLAG az üzlet EGYEDI szerepeiből jönnek (a `roles` rekord saját
 * `capabilities` listája). Nincs beépített „Vezető"/„Dolgozó" jogkészlet: aki nem tulaj és nincs
 * egyedi szerepe, az csak az `overview.view` alap-küszöböt kapja (belép, de üres a felülete, amíg a
 * tulaj szerepet nem ad neki). A gating a HATÉKONY képesség-halmazon megy (`Capability[]`), ezért az
 * egyedi szerep csak adat: nincs kód-újraírás.
 */

// A membership DB-enumja történetileg 'owner'|'manager'|'staff'. Ma CSAK az `owner` bír önálló
// jelentéssel (örökölt teljes jog); a 'manager'/'staff' pusztán „nem-tulaj" jelölő, jog nélkül.
export type TeamRole = 'owner' | 'manager' | 'staff'

export type Capability =
  | 'overview.view'
  | 'bookings.view'
  | 'bookings.manage'
  | 'schedule.view.own'    // saját naptár megtekintése (olvasás, pl. éttermi felszolgáló)
  | 'schedule.manage.own'  // saját naptár szerkesztése (szalon-stylist: önálló időbeosztás)
  | 'schedule.manage'      // teljes csapat naptár kezelése
  | 'guests.view'
  | 'guests.manage'
  | 'catalog.view'         // szalon: szolgáltatások megtekintése
  | 'catalog.manage'       // szalon: szolgáltatások kezelése
  | 'tables.view'          // étterem: asztalok megtekintése
  | 'tables.manage'        // étterem: asztalok kezelése
  | 'staff.view'
  | 'staff.manage'
  | 'analytics.view'
  | 'tips.view'
  | 'notifications.view'
  | 'notifications.manage'
  | 'settings.own_profile'
  | 'settings.profile'
  | 'team.view'
  | 'team.manage'
  | 'billing.manage'
  | 'danger'
  | 'audit.view'

/** variant: melyik üzlettípusnál releváns a capability. undefined = mindkettőnél. */
export const CAPABILITY_META: {
  value: Capability
  label: string
  group: string
  variant?: 'salon' | 'restaurant'
}[] = [
  { value: 'overview.view',        label: 'Áttekintés (alap belépő)',           group: 'Alap' },
  { value: 'bookings.view',        label: 'Foglalások megtekintése',             group: 'Foglalás' },
  { value: 'bookings.manage',      label: 'Foglalások kezelése',                 group: 'Foglalás' },
  { value: 'schedule.view.own',    label: 'Saját naptár — csak megtekintés',     group: 'Naptár' },
  { value: 'schedule.manage.own',  label: 'Saját naptár — szerkesztés',          group: 'Naptár' },
  { value: 'schedule.manage',      label: 'Teljes csapatnaptár kezelése',        group: 'Naptár' },
  { value: 'guests.view',          label: 'Vendégek megtekintése',               group: 'Vendégek' },
  { value: 'guests.manage',        label: 'Vendégek kezelése',                   group: 'Vendégek' },
  { value: 'catalog.view',         label: 'Szolgáltatások megtekintése',         group: 'Szolgáltatások', variant: 'salon' },
  { value: 'catalog.manage',       label: 'Szolgáltatások kezelése',             group: 'Szolgáltatások', variant: 'salon' },
  { value: 'tables.view',          label: 'Asztalok megtekintése',               group: 'Asztalok',       variant: 'restaurant' },
  { value: 'tables.manage',        label: 'Asztalok kezelése',                   group: 'Asztalok',       variant: 'restaurant' },
  { value: 'staff.view',           label: 'Munkatársak megtekintése',            group: 'Munkatársak' },
  { value: 'staff.manage',         label: 'Munkatársak kezelése',                group: 'Munkatársak' },
  { value: 'analytics.view',        label: 'Statisztikák megtekintése',          group: 'Statisztika' },
  { value: 'tips.view',             label: 'Tippek és javaslatok',               group: 'Statisztika' },
  { value: 'notifications.view',    label: 'Értesítések fogadása',               group: 'Értesítések' },
  { value: 'notifications.manage',  label: 'Értesítési beállítások kezelése',    group: 'Értesítések' },
  { value: 'settings.own_profile', label: 'Saját profil szerkesztése',           group: 'Beállítások' },
  { value: 'settings.profile',     label: 'Üzleti beállítások (szabály / funkció)', group: 'Beállítások' },
  { value: 'team.view',            label: 'Csapat megtekintése',                 group: 'Csapat' },
  { value: 'team.manage',          label: 'Csapat kezelése (meghívás / szerep)', group: 'Csapat' },
  { value: 'billing.manage',       label: 'Számlázás / előfizetés',              group: 'Számlázás' },
  { value: 'danger',               label: 'Veszélyzóna (üzlet törlése)',         group: 'Veszélyzóna' },
  { value: 'audit.view',           label: 'Audit-napló',                         group: 'Audit' },
]

export const ALL_CAPABILITIES: Capability[] = CAPABILITY_META.map((c) => c.value)

// Az EGYETLEN beépített jogkészlet az owneré (minden). A 'manager'/'staff' NEM ad önálló jogot:
// aki nem tulaj, annak a jogai az egyedi szerepéből jönnek — beépített szerepként csak az
// `overview.view` alap-küszöböt kapja (belép, de üres a felülete, amíg a tulaj szerepet nem ad neki).
const OWNERLESS_FLOOR: Capability[] = ['overview.view']

/** Egy BEÉPÍTETT szerep hatékony képesség-halmaza. Csak az owner kap jogot; más → alap-küszöb. */
export function capabilitiesForRole(role: TeamRole | null | undefined): Capability[] {
  return role === 'owner' ? ALL_CAPABILITIES : OWNERLESS_FLOOR
}

/**
 * A hatékony képesség-halmaz feloldása. Owner → MINDEN. Egyébként az EGYEDI szerep (`customCaps`)
 * dönt; ha nincs egyedi szerep, csak az alap-küszöb (`overview.view`) — nincs beépített jogkészlet.
 */
export function effectiveCapabilities(
  role: TeamRole | null | undefined,
  customCaps?: Capability[] | null,
): Capability[] {
  if (role === 'owner') return ALL_CAPABILITIES
  if (customCaps && customCaps.length) {
    return customCaps.includes('overview.view') ? customCaps : ['overview.view', ...customCaps]
  }
  return OWNERLESS_FLOOR
}

/** Tartalmazza-e a képesség-halmaz a kért képességet? */
export function can(caps: Capability[] | null | undefined, capability: Capability): boolean {
  return !!caps && caps.includes(capability)
}

/**
 * Emberi felirat a beépített szerephez (badge-ekhez). CSAK a tulajnak van beépített neve; minden
 * más tag a saját EGYEDI szerepének nevét viseli — ha nincs, ez a semleges fallback jelenik meg.
 */
export function roleLabel(role: TeamRole | null | undefined): string {
  return role === 'owner' ? 'Tulajdonos' : 'Nincs szerep'
}
