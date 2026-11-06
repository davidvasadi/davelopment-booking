import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { loadGuests } from '@/lib/guestsData'

/**
 * GET /api/guests/export — a Vendégek export-ablaka (design 7.6), CSV-ben (Excelben megnyitható: UTF-8 BOM +
 * pontosvessző). Ugyanaz a vendég-aggregálás, mint a Vendégek oldalé (`loadGuests`).
 *   ?what=guests|bookings   mit (vendégek vagy foglalások)
 *   ?from&to=YYYY-MM-DD     időszak (nélküle minden) — vendégeknél: aki ebben az időszakban járt
 *   ?fields=name,phone,…    a mezők (vendégeknél: név, telefon…; foglalásoknál: dátum, idő…); a tiltott vendég mindig jelölve
 *   ?keys=k1|k2             csak a kijelölt vendégek
 *   ?count=1                csak a sorok száma (a gomb feliratához), JSON-ban
 * Jogosultság: vendégek → `guests.manage` (személyes adat); foglalások → `bookings.view` is elég (a Foglalások oldalon
 * ezeket eddig is látta és letölthette).
 */
const FIELDS = ['name', 'phone', 'email', 'visits', 'last', 'note', 'newsletter', 'tag'] as const
type Field = (typeof FIELDS)[number]
const FIELD_LABEL: Record<Field, string> = { name: 'Név', phone: 'Telefon', email: 'E-mail', visits: 'Látogatások', last: 'Utolsó látogatás', note: 'Megjegyzés', newsletter: 'Hírlevél-feliratkozás', tag: 'Címkék' }
const BOOKING_FIELDS = ['date', 'time', 'name', 'phone', 'email', 'what', 'status', 'note'] as const
type BookingField = (typeof BOOKING_FIELDS)[number]
const STATUS_LABEL: Record<string, string> = { pending: 'Függő', confirmed: 'Megerősített', seated: 'Bent', completed: 'Befejezett', cancelled: 'Lemondva', no_show: 'Nem jött' }

function cell(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })
  const sp = req.nextUrl.searchParams
  const what = sp.get('what') === 'bookings' ? 'bookings' : 'guests'
  const denied = (await assertCapability(user.id, active.type, active.id, 'guests.manage'))
    && (what === 'bookings' ? await assertCapability(user.id, active.type, active.id, 'bookings.view') : true)
  if (denied) return NextResponse.json({ error: typeof denied === 'object' ? denied.error : 'Ehhez nincs jogosultságod' }, { status: typeof denied === 'object' ? denied.status : 403 })
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)
  const keys = sp.get('keys') ? new Set(sp.get('keys')!.split('|')) : null
  const raw = (sp.get('fields') ?? '').split(',').filter(Boolean)
  const picked = raw.filter((f): f is Field => (FIELDS as readonly string[]).includes(f))
  const fields = picked.length ? picked : [...FIELDS]
  const bPicked = raw.filter((f): f is BookingField => (BOOKING_FIELDS as readonly string[]).includes(f))
  const bFields = bPicked.length ? bPicked : [...BOOKING_FIELDS]

  const bizId: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id
  const ctx = await loadGuests(active.type, bizId)

  let header: string[]
  let rows: (string | number | null)[][]
  if (what === 'bookings') {
    const list = ctx.bookingRows().filter((b) => inRange(b.date) && (!keys || keys.has(b.key))).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    const label: Record<BookingField, string> = { date: 'Dátum', time: 'Idő', name: 'Vendég', phone: 'Telefon', email: 'E-mail', what: active.type === 'restaurant' ? 'Asztal · létszám' : 'Szolgáltatás · munkatárs', status: 'Állapot', note: 'Megjegyzés' }
    header = bFields.map((f) => label[f])
    rows = list.map((b) => bFields.map((f) => (f === 'status' ? STATUS_LABEL[b.status] ?? b.status : b[f])))
  } else {
    const list = ctx.guests.filter((g) => (!keys || keys.has(g.key)) && (!from && !to ? true : (ctx.datesByKey.get(g.key) ?? []).some(inRange)))
    header = [...fields.map((f) => FIELD_LABEL[f]), 'Tiltva']
    rows = list.map((g) => {
      const c = ctx.customerOf(g)
      const val: Record<Field, string | number | null> = {
        name: g.name, phone: g.phone, email: g.email, visits: g.visits, last: g.lastVisit,
        note: c?.notes ?? null, newsletter: c?.marketing_consent ? 'igen' : 'nem', tag: c?.group_tag ?? null,
      }
      return [...fields.map((f) => val[f]), ctx.blockedOf(g) ? 'tiltva' : '']
    })
  }

  if (sp.get('count')) return NextResponse.json({ rows: rows.length })

  const csv = '﻿' + [header.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))].join('\r\n')
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${active.slug || 'uzlet'}-${what === 'bookings' ? 'foglalasok' : 'vendegek'}-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
