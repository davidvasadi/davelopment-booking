import { CollectionConfig, PayloadRequest, Access, Where } from 'payload'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'
import { capabilitiesForBusiness } from '@/lib/apiCapability'
import { can } from '@/lib/permissions'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { sseAfterChangeAny, sseAfterDeleteAny } from '../hooks/emitSseEvent'

/** Van-e a usernek `schedule.manage` capability-je a rekord üzletében (szalon VAGY étterem)? */
async function canManageShiftBusiness(
  req: PayloadRequest,
  salonId: number | string | undefined,
  restaurantId: number | string | undefined,
): Promise<boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const [type, businessId] = restaurantId ? (['restaurant', restaurantId] as const) : (['salon', salonId] as const)
  if (businessId == null) return false
  const caps = await capabilitiesForBusiness(req.user.id, type, businessId)
  return !!caps && can(caps, 'schedule.manage')
}

/**
 * BEOSZTÁS / HR — egy dolgozó egy naphoz kötött bejegyzése: műszak, szabadság,
 * betegszabadság vagy fizetett szabadság. A SZALON dashboard „Beosztás" moduljának
 * adatforrása (staff+salon), ÉS az ÉTTEREM „Beosztás" moduljáé (member+restaurant).
 * Egy műszak vagy (salon+staff) VAGY (restaurant+member).
 * Access: a tulaj/admin a SAJÁT szalonjaira/éttermeire; kívülálló semmit.
 */
export const Shifts: CollectionConfig = {
  slug: 'shifts',
  labels: { singular: 'Beosztás', plural: 'Beosztások' },
  hooks: {
    // élő frissítés: a beosztás változása (bárki menti — tulaj vagy a munkatárs a saját oldalán) azonnal frissíti az üzlet
    // nyitott oldalait (Naptár, Új beosztás előnézete, Munkatársak)
    afterChange: [auditAfterChange('Beosztás', 'auto'), sseAfterChangeAny()],
    afterDelete: [auditAfterDelete('Beosztás', 'auto'), sseAfterDeleteAny()],
  },
  admin: {
    group: 'Közös',
    useAsTitle: 'date',
    defaultColumns: ['staff', 'member', 'salon', 'restaurant', 'date', 'type', 'start_time', 'end_time'],
    hidden: true,
  },
  access: {
    read: (async (args) => {
      if (args.req.user?.role === 'admin') return true
      if (!args.req.user) return false
      const [salonWhere, restaurantWhere] = await Promise.all([
        capabilityScoped('salon', 'salon', 'schedule.manage')(args),
        capabilityScoped('restaurant', 'restaurant', 'schedule.manage')(args),
      ])
      const or: Where[] = []
      if (salonWhere && typeof salonWhere === 'object') or.push(salonWhere as Where)
      if (restaurantWhere && typeof restaurantWhere === 'object') or.push(restaurantWhere as Where)
      if (or.length === 0) return false
      return { or }
    }) as Access,
    create: (async (args) => {
      if (args.req.user?.role === 'admin') return true
      if (!args.req.user) return false
      if (args.data?.restaurant) return capabilityCreate('restaurant', 'restaurant', 'schedule.manage')(args)
      return capabilityCreate('salon', 'salon', 'schedule.manage')(args)
    }) as Access,
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      const doc = id
        ? ((await req.payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { salon?: number | string; restaurant?: number | string } | null)
        : null
      const salon = doc?.salon ?? (data?.salon as number | string | undefined)
      const restaurant = doc?.restaurant ?? (data?.restaurant as number | string | undefined)
      return canManageShiftBusiness(req, salon, restaurant)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = (await req.payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { salon?: number | string; restaurant?: number | string } | null
      return canManageShiftBusiness(req, doc?.salon, doc?.restaurant)
    },
  },
  fields: [
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: false,
      label: 'Dolgozó (szalon)',
      admin: { description: 'Szalon-műszakhoz kötelező; étterem-műszaknál üres.' },
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      label: 'Szalon',
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'memberships',
      hasMany: false,
      label: 'Csapattag (étterem)',
      admin: { description: 'Étterem-műszakhoz kötelező; szalon-műszaknál üres.' },
    },
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      hasMany: false,
      label: 'Étterem',
    },
    {
      name: 'date',
      index: true, // gyakori szűrő (sebesség — docs/audit/2026-11-05_1921)
      type: 'date',
      required: true,
      label: 'Nap',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'shift',
      label: 'Típus',
      options: [
        { label: 'Műszak', value: 'shift' },
        { label: 'Szabadság', value: 'leave' },
        { label: 'Betegszabadság', value: 'sick' },
        { label: 'Fizetett szabadság', value: 'vacation' },
      ],
    },
    {
      name: 'start_time',
      type: 'text',
      label: 'Kezdés (ÓÓ:PP)',
      admin: { placeholder: '09:00' },
    },
    {
      name: 'end_time',
      type: 'text',
      label: 'Vége (ÓÓ:PP)',
      admin: { placeholder: '17:00' },
    },
    {
      name: 'hours',
      type: 'number',
      label: 'Óraszám',
    },
    {
      // Egy nap TÖBB szünetet is tarthat (pl. ebéd + délutáni pihenő) — ezért lista, nem 2 sima
      // mező. A korábbi egyszeres `break_start`/`break_end` oszlopok az adatbázisban megmaradtak
      // (nem törölve, expand-contract minta), a meglévő adat egy 1-elemű tömbbé lett migrálva.
      name: 'breaks',
      type: 'json',
      label: 'Szünetek',
      admin: { description: 'Ezeken az időszakokon nem foglalható; a foglaló oldalon nem jelenik meg külön jelzésként.' },
    },
    {
      name: 'note',
      type: 'text',
      label: 'Megjegyzés',
    },
    {
      // Beteg / szabadság: fizetett-e (táppénz, fizetett szabadság) — a havi bér-exporthoz (design 11.5).
      name: 'paid',
      type: 'checkbox',
      defaultValue: false,
      label: 'Fizetett',
    },
    {
      // Betegnél a táppénzes papír (orvosi igazolás) — nem nyilvános tárolóban (SickNotes).
      name: 'sick_note',
      type: 'relationship',
      relationTo: 'sick-notes',
      hasMany: false,
      label: 'Táppénzes papír',
    },
    {
      // STÁTUSZVÁLTÁS a napon belül: a dolgozó a műszak vége előtt hazament (pl. délben beteg lett).
      // Egy soron marad (nincs duplázás) — a tényleges ledolgozott idő start→left_early_at.
      name: 'left_early_at',
      type: 'text',
      label: 'Korai távozás (ÓÓ:PP)',
      admin: { placeholder: '12:00', description: 'Ha a dolgozó a műszak vége előtt hazament.' },
    },
    {
      name: 'left_early_reason',
      type: 'select',
      label: 'Korai távozás oka',
      options: [
        { label: 'Beteg lett', value: 'sick' },
        { label: 'Hazament (egyéb)', value: 'personal' },
      ],
    },
    {
      // A TULAJ beosztása (étterem): nincs `member`, csak `restaurant` + ez a jelző. Kizárólag
      // beosztás-fedettség (ki dolgozik aznap) — a tulajra NINCS bér/borravaló-számítás.
      name: 'owner_shift',
      type: 'checkbox',
      defaultValue: false,
      label: 'Tulajdonos műszakja',
      admin: { description: 'A tulajdonos beosztása (member nélkül). Csak fedettség; nincs bér/borravaló.' },
    },
  ],
  timestamps: true,
}
