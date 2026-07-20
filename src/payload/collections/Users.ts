import { CollectionConfig } from 'payload'
import type { SelectFieldSingleValidation, Where } from 'payload'
import { BRAND_NAME } from '@/lib/brand'
import { emailLayout, COLORS } from '@/lib/emailLayout'

export const Users: CollectionConfig = {
  slug: 'users',
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // A salons/restaurants.owner_id NOT NULL + FK ON DELETE SET NULL → a user közvetlen
        // törlése elbukna (null nem megengedett). Ezért előbb töröljük a user szalonjait és
        // éttermeit; azok saját beforeDelete hookja kaszkádol az üzlet-adatokra
        // (foglalások, szolgáltatások, asztalok stb.).
        const salons = await req.payload.find({
          collection: 'salons',
          where: { owner: { equals: id } },
          limit: 100,
          overrideAccess: true,
          req,
        })
        for (const salon of salons.docs) {
          await req.payload.delete({ collection: 'salons', id: salon.id, overrideAccess: true, req })
        }
        const restaurants = await req.payload.find({
          collection: 'restaurants',
          where: { owner: { equals: id } },
          limit: 100,
          overrideAccess: true,
          req,
        })
        for (const restaurant of restaurants.docs) {
          await req.payload.delete({ collection: 'restaurants', id: restaurant.id, overrideAccess: true, req })
        }
        // FIÓK-szintű előfizetés: az account-subscription átállás óta a `subscriptions` rekord
        // az USERHEZ tartozik (owner=userId), NEM az üzlethez. Ezért az üzlet-törlés NEM viszi
        // el — kézzel kell törölni, különben árva subscription-rekord marad a DB-ben (és a
        // törölt user újraregisztrációjakor összezavarhatja a fiók-előfizetést).
        const subs = await req.payload.find({
          collection: 'subscriptions',
          where: { owner: { equals: id } },
          limit: 100,
          overrideAccess: true,
          req,
        })
        for (const sub of subs.docs) {
          // Invoices have subscription_id NOT NULL — delete them before the subscription
          await req.payload.delete({
            collection: 'invoices',
            where: { subscription: { equals: sub.id } },
            overrideAccess: true,
            req,
          })
          await req.payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true, req })
        }
      },
    ],
  },
  auth: {
    useSessions: false,
    // A bejelentkezés 7 napig él (Payload default 2 óra lenne) — egész napos pultos
    // használatnál a felhasználó nem esik ki műszak közben, de a token-kitettség ablaka
    // ésszerű. Egységes a saját kiállítású tokennel (auth.ts TOKEN_TTL_SECONDS = 7 nap).
    tokenExpiration: 60 * 60 * 24 * 7,
    // Brute-force védelem: 5 hibás jelszó után a fiók 10 percre zárol. A valódi
    // biztonságot ez adja (a támadót célozza), nem a rövid session.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      generateEmailSubject: () => `Jelszó visszaállítás — ${BRAND_NAME}`,
      generateEmailHTML: (args?: { token?: string }) => {
        const token = args?.token ?? ''
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const resetUrl = `${appUrl}/reset-password?token=${token}`

        // Lakat-ikonos hero (Crextio: 56px lekerekített arany-badge, vékony cím).
        const lockSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${COLORS.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
        const hero = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 4px;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px">
        <tr><td style="width:56px;height:56px;border-radius:18px;background:rgba(255,216,95,0.32);text-align:center;vertical-align:middle">${lockSvg}</td></tr>
      </table>
      <h1 style="margin:0 0 7px;font-size:27px;font-weight:300;color:${COLORS.text};letter-spacing:-0.6px;line-height:1.1">Jelszó visszaállítás</h1>
      <p style="margin:0 auto;max-width:340px;color:${COLORS.textFaint};font-size:14px;line-height:1.55">Kattints az alábbi gombra az új jelszó beállításához.</p>
    </td>
  </tr>`

        // Arany CTA-gomb (mint a calendarBlock) + lejárat-figyelmeztetés.
        const cta = `<tr>
    <td style="background:${COLORS.surface};padding:24px 32px 4px;text-align:center">
      <a href="${resetUrl}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:14px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:999px;letter-spacing:-0.1px">Jelszó visszaállítása</a>
    </td>
  </tr>
  <tr>
    <td style="background:${COLORS.surface};padding:16px 32px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.</p>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`

        return emailLayout({
          brandName: BRAND_NAME,
          header: hero,
          content: cta,
        })
      },
    },
  },
  labels: { singular: 'Felhasználó', plural: 'Felhasználók' },
  admin: {
    group: 'Rendszer',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'place'],
  },
  access: {
    create: () => true,
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    update: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Teljes név',
    },
    {
      // A felhasználó profilképének URL-je. Google-belépéskor a Google `picture`
      // töltődik ide (a finalize route), e-mailes regisztrálók a Beállításokban
      // adhatják meg. Üresnél a felületen monogramos fallback jelenik meg.
      name: 'avatar_url',
      type: 'text',
      label: 'Profilkép URL',
    },
    // ── Tulajdonos személyes adatlapja (fiók-szintű) — a tulajnak NINCS membershipje, ezért
    //    a saját adatai (telefon, szül.nap stb.) itt, a User-fiókon élnek. A HiringView adatlap
    //    ugyanúgy szerkeszti, mint a munkatársakét, csak a PATCH /api/user/profile-ra megy.
    //    Bér/borravaló a tulajnál SOHA (azt a membershipek hordozzák).
    { name: 'phone', type: 'text', label: 'Telefon' },
    { name: 'birthday', type: 'date', label: 'Születésnap', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } } },
    { name: 'join_date', type: 'date', label: 'Belépés / alapítás', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } } },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'tax_id', type: 'text', label: 'TAJ / adóazonosító' },
    { name: 'emergency_contact', type: 'text', label: 'Vészhelyzeti kontakt' },
    { name: 'weekly_hours', type: 'number', label: 'Heti óraszám' },
    { name: 'bio', type: 'textarea', label: 'Megjegyzés / bemutatkozás' },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Szalon tulajdonos', value: 'salon_owner' },
        { label: 'Étterem tulajdonos', value: 'restaurant_owner' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: 'salon_owner',
      required: true,
      saveToJWT: true,
      access: {
        // Regisztrációkor (nincs bejelentkezett user) a jelentkező beállíthatja a saját role-ját.
        // Bejelentkezve csak admin módosíthat role-t. Az 'admin' role-t soha nem lehet
        // önregisztrációval felvenni (lásd validate alább).
        create: ({ req }) => !req.user || req.user.role === 'admin',
        update: ({ req }) => req.user?.role === 'admin',
      },
      validate: ((value, { req }) => {
        // Önregisztrációkor (nincs admin) tilos admin role-t kérni
        if (value === 'admin' && req.user?.role !== 'admin') {
          return 'Admin fiók nem hozható létre regisztrációval.'
        }
        return true
      }) as SelectFieldSingleValidation,
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      label: 'Szalon',
      admin: {
        condition: (data) => data?.role === 'salon_owner',
      },
    },
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      hasMany: false,
      label: 'Étterem',
      admin: {
        condition: (data) => data?.role === 'restaurant_owner',
      },
    },
    {
      // Virtuális, csak megjelenítésre szolgáló oszlop: a role-tól függően a szalon VAGY
      // az étterem nevét mutatja, így a Felhasználók listában sosem jelenik meg "No salon".
      // Nem tárolódik az adatbázisban, csak olvasáskor töltődik fel.
      name: 'place',
      type: 'text',
      virtual: true,
      label: 'Hely',
      admin: {
        readOnly: true,
        // A szerkesztő (edit) nézetben elrejtjük, mert a salon/restaurant mező már ott van;
        // a `condition: () => false` csak a form-mezőt rejti, a listaoszlop megmarad.
        condition: () => false,
      },
      hooks: {
        afterRead: [
          async ({ data, req }) => {
            try {
              if (data?.role === 'salon_owner' && data?.salon) {
                const id = typeof data.salon === 'object' ? data.salon.id : data.salon
                const doc = await req.payload.findByID({ collection: 'salons', id, depth: 0, overrideAccess: true, req })
                return doc?.name ?? null
              }
              if (data?.role === 'restaurant_owner' && data?.restaurant) {
                const id = typeof data.restaurant === 'object' ? data.restaurant.id : data.restaurant
                const doc = await req.payload.findByID({ collection: 'restaurants', id, depth: 0, overrideAccess: true, req })
                return doc?.name ?? null
              }
            } catch {
              return null
            }
            return null
          },
        ],
      },
    },
    {
      // Több-üzlet (multi-tenant): az utoljára aktívan használt üzlet azonosítója
      // `"<type>:<id>"` formában (pl. "restaurant:12" vagy "salon:3"). Az aktív üzlet
      // feloldása: cookie → ez a mező → első üzlet (lásd src/lib/activeBusiness.ts).
      // Tartós, eszközfüggetlen forrás; a switch-route a cookie mellett ezt is írja.
      name: 'last_active_business',
      type: 'text',
      label: 'Utolsó aktív üzlet',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      // Több-üzlet (multi-tenant) ÁTTEKINTŐ: a felhasználó ÖSSZES üzlete + mindegyik
      // előfizetésének státusza/díja, alul az összesített havidíj. Read-only, virtuális
      // (nem tárolódik) — csak az admin-szerkesztőben ad gyors képet, hogy egy fiókhoz
      // mi tartozik (különben szét van szórva a Salons/Restaurants/Subscriptions közt).
      name: 'businesses_summary',
      type: 'textarea',
      virtual: true,
      label: 'Üzletek és előfizetések',
      admin: {
        readOnly: true,
        rows: 6,
        description: 'A fiókhoz tartozó összes üzlet és előfizetés (automatikus összegzés).',
      },
      hooks: {
        afterRead: [
          async ({ data, req }) => {
            try {
              if (!data?.id) return null
              const [salons, restaurants] = await Promise.all([
                req.payload.find({ collection: 'salons', where: { owner: { equals: data.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
                req.payload.find({ collection: 'restaurants', where: { owner: { equals: data.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
              ])
              const salonIds = salons.docs.map((d) => d.id)
              const restaurantIds = restaurants.docs.map((d) => d.id)
              if (!salonIds.length && !restaurantIds.length) return '— Nincs üzlet ehhez a fiókhoz —'

              const orClauses: Where[] = []
              if (salonIds.length) orClauses.push({ salon: { in: salonIds } })
              if (restaurantIds.length) orClauses.push({ restaurant: { in: restaurantIds } })
              const subs = await req.payload.find({
                collection: 'subscriptions',
                where: { or: orClauses },
                limit: 200,
                depth: 0,
                overrideAccess: true,
                req,
              })

              const STATUS: Record<string, string> = { trialing: 'Próbaidő', active: 'Aktív', past_due: 'Fizetés esedékes', canceled: 'Megszűnt', paused: 'Szüneteltetve' }
              // Csak az aktív (fizető) előfizetés számít bele a havidíjba.
              let total = 0
              const lines: string[] = []

              const subForSalon = (sid: number | string) => subs.docs.find((s) => (typeof s.salon === 'object' ? s.salon?.id : s.salon) === sid)
              const subForRest = (rid: number | string) => subs.docs.find((s) => (typeof s.restaurant === 'object' ? s.restaurant?.id : s.restaurant) === rid)

              for (const s of salons.docs) {
                const sub = subForSalon(s.id)
                const status = sub ? (STATUS[sub.status] ?? sub.status) : '—'
                const fee = sub?.status === 'active' ? (sub.amount_huf ?? 0) : 0
                if (fee) total += fee
                lines.push(`Szalon: ${s.name} · ${status}${fee ? ` · ${fee.toLocaleString('hu-HU')} Ft/hó` : ''}`)
              }
              for (const r of restaurants.docs) {
                const sub = subForRest(r.id)
                const status = sub ? (STATUS[sub.status] ?? sub.status) : '—'
                const fee = sub?.status === 'active' ? (sub.amount_huf ?? 0) : 0
                if (fee) total += fee
                lines.push(`Étterem: ${r.name} · ${status}${fee ? ` · ${fee.toLocaleString('hu-HU')} Ft/hó` : ''}`)
              }
              lines.push(`──────────`)
              lines.push(`Összesen: ${total.toLocaleString('hu-HU')} Ft/hó (${lines.length - 1} üzlet)`)
              return lines.join('\n')
            } catch {
              return null
            }
          },
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Aktív', value: 'active' },
        { label: 'Deaktivált', value: 'inactive' },
      ],
      defaultValue: 'active',
    },
  ],
}
