/**
 * Az Audit-napló sorai emberi nyelven (Beállítások › Audit-napló, design 16.19). A naplóban technikai adat van
 * (collection-név, mezőnév, nyers érték: `seated`, `cover_focal_x`, `2026-11-03`) — ebből lesz egy rövid esemény
 * („Asztalfoglalás: leültetve”), egy tárgy („Horváth Anna · Nov. 3. 14:00”) és a változások olvasható sorai.
 * Tiszta függvények (kliensen és szerveren is fut); a régi bejegyzésekre is működik (a tárolt összegzésből dolgozik).
 */

export type AuditAction = 'create' | 'update' | 'delete'
export type AuditChange = { field: string; from: string | number | boolean | null; to: string | number | boolean | null }
export type AuditLine = { label: string; from?: string; to?: string; text?: string }
export type AuditView = { event: string; tone: 'ok' | 'bad' | 'warn' | 'pending' | 'neutral'; title: string; lines: AuditLine[] }

/** a napló entitás-neve (collection-felirat) → a mondatban használt főnév */
const NOUN: Record<string, string> = {
  'Foglalás': 'Foglalás', 'Asztalfoglalás': 'Asztalfoglalás', 'Ajándékutalvány': 'Ajándékutalvány', 'Ajándékutalvány-típus': 'Utalvány-típus',
  'Asztal': 'Asztal', 'Terem': 'Terem', 'Beosztás': 'Műszak', 'Csapattag': 'Csapattag', 'Munkatárs': 'Munkatárs',
  'Nyitvatartás': 'Nyitvatartás', 'Nyitvatartási kivétel': 'Nyitvatartási kivétel', 'Szolgáltatás': 'Szolgáltatás',
  'Vendég-rekord': 'Vendég', 'Várólista-bejegyzés': 'Várólista', 'Értékelés': 'Értékelés',
  'Szalon beállítás': 'Beállítások', 'Étterem beállítás': 'Beállítások',
}
const SETTINGS = new Set(['Szalon beállítás', 'Étterem beállítás'])

const STATUS: Record<string, string> = {
  pending: 'Függőben', confirmed: 'Megerősítve', seated: 'Leültetve', completed: 'Befejezve', cancelled: 'Lemondva',
  no_show: 'Nem jött el', rejected: 'Elutasítva', waiting: 'Várakozik', notified: 'Értesítve', converted: 'Foglalás lett',
  expired: 'Lejárt', active: 'Aktív', redeemed: 'Beváltva', paid: 'Fizetve', refunded: 'Visszatérítve', invited: 'Meghívva',
  failed: 'Sikertelen', storno: 'Sztornózva', issued: 'Kiállítva',
}
const STATUS_TONE: Record<string, AuditView['tone']> = { confirmed: 'ok', seated: 'ok', completed: 'ok', redeemed: 'ok', paid: 'ok', cancelled: 'bad', no_show: 'bad', rejected: 'bad', expired: 'bad' }

const LABEL: Record<string, string> = {
  status: 'Állapot', date: 'Nap', start_time: 'Kezdés', end_time: 'Vége', time: 'Időpont', pax: 'Létszám', party_size: 'Létszám',
  customer_name: 'Vendég neve', customer_phone: 'Telefon', customer_email: 'E-mail', notes: 'Vendég megjegyzése', internal_notes: 'Belső megjegyzés',
  role: 'Szerep', position: 'Pozíció', pay_rate: 'Bér', pay_type: 'Bér típusa', name: 'Név', email: 'E-mail', phone: 'Telefon',
  is_birthday: 'Születésnap', tip_eligible: 'Borravalóra jogosult', weekly_hours: 'Heti óraszám', title: 'Megnevezés', price: 'Ár',
  duration_minutes: 'Időtartam', source: 'Forrás', address: 'Cím', city: 'Város', postal_code: 'Irányítószám', occasion: 'Alkalom',
  join_date: 'Belépés', birthday: 'Születésnap', bio: 'Bemutatkozás', note: 'Jegyzet', description: 'Bemutatkozás', website: 'Weboldal',
  slug: 'Foglalási link', capacity: 'Férőhely', is_active: 'Aktív', active: 'Aktív', is_open: 'Nyitva', open_time: 'Nyitás', close_time: 'Zárás',
  is_available: 'Nyitva', online_bookable: 'Online foglalható', online_visible: 'Látszik a foglalóoldalon', min_online_pax: 'Legkisebb online létszám',
  max_online_pax: 'Legnagyobb online létszám', online_capacity_pct: 'Online kiadható férőhely', label: 'Megnevezés', start_date: 'Kezdőnap',
  end_date: 'Utolsó nap', is_closed: 'Zárva', exception_date: 'Nap', comment: 'Vélemény', rating: 'Értékelés', reply: 'Válasz',
  amount: 'Összeg', amount_huf: 'Összeg', deposit_amount_huf: 'Előleg', expires_at: 'Lejárat', code: 'Kód', blocked: 'Tiltólistán',
  block_reason: 'Tiltás oka', marketing_consent: 'Hírlevél-feliratkozás', booking_window_days: 'Előre foglalható napok', booking_window_end: 'Foglalható eddig',
  booking_window_periodic: 'Időszakos foglalási ablak', booking_window_auto_renew: 'Ablak automatikus megújítása', booking_buffer_minutes: 'Szünet foglalások között',
  turn_duration_minutes: 'Alap asztal-idő', last_booking_buffer_minutes: 'Utolsó kezdés zárás előtt', last_seating_buffer_minutes: 'Utolsó leültetés zárás előtt',
  lead_time_hours: 'Minimum foglalási idő', require_phone: 'Kötelező telefonszám', supported_locales: 'Nyelvek', timezone: 'Időzóna',
  google_review_url: 'Google értékelő link', legal_name: 'Hivatalos cégnév', tax_number: 'Adószám', billing_name: 'Számlázási név',
  billing_email: 'Számlázási e-mail', webhook_url: 'Webhook', ga4_id: 'Google Analytics', fb_pixel_id: 'Facebook Pixel', table: 'Asztal',
  room: 'Terem', staff: 'Munkatárs', service: 'Szolgáltatás', customer: 'Vendég', logo: 'Logó', cover_image: 'Borítókép', avatar: 'Profilkép',
  image: 'Kép', category: 'Kategória', sort_order: 'Sorrend', seats: 'Férőhely', min_seats: 'Legkevesebb fő', max_seats: 'Legtöbb fő',
  shape: 'Forma', group_tag: 'Címke', recipient_name: 'Megajándékozott', purchaser_name: 'Vásárló', message: 'Üzenet', type_name: 'Típus',
  annual_leave_days: 'Éves szabadság', visit_count: 'Látogatások', cancellation_reason: 'Lemondás oka', voucher_code: 'Utalvány-kód',
}
/** csak „megváltozott” — az érték (azonosító / kép) semmit sem mondana */
const REF = new Set(['table', 'room', 'staff', 'service', 'customer', 'logo', 'cover_image', 'avatar', 'image', 'category', 'voucher_type', 'booking', 'reservation', 'user', 'role'])
/** egy sorba összevonva, érték nélkül */
const GROUPS: [RegExp, string][] = [[/^cover_(focal|zoom)/, 'Borítókép igazítása'], [/^(theme|accent|card_style|page_style)/, 'Oldal kinézete']]
/** belső / zaj mezők — kimaradnak */
const SKIP = /^(match_index|external_id|cancellation_token|.*_token|.*_snapshot|price_snapshot|qr_code_url|position_history|google_.*_id|stripe_.*|.*_count)$/
const LONG = new Set(['description', 'bio', 'notes', 'internal_notes', 'comment', 'reply', 'message', 'note', 'block_reason'])
const MONEY = /(^|_)(price|amount|amount_huf|deposit_amount_huf|pay_rate|salary)$/
const MINUTES = /(_minutes|^duration_minutes)$/

const MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const fmtDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); const sameYear = y === new Date().getFullYear(); return `${sameYear ? '' : `${y}. `}${MONTHS[m - 1]} ${d}.` }

function fmt(field: string, v: AuditChange['from']): string {
  if (v === true) return field.startsWith('is_') || field === 'active' || field === 'blocked' ? 'Igen' : 'Be'
  if (v === false) return field.startsWith('is_') || field === 'active' || field === 'blocked' ? 'Nem' : 'Ki'
  if (v == null || v === '') return '—'
  if (field === 'status' && typeof v === 'string') return STATUS[v] ?? v
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) return fmtDate(s.slice(0, 10))
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5).replace(/^0(\d)/, '$1')
  if (MONEY.test(field) && !Number.isNaN(Number(s))) return `${Number(s).toLocaleString('hu-HU')} Ft`
  if (MINUTES.test(field) && !Number.isNaN(Number(s))) return `${s} perc`
  if (field.endsWith('_pct')) return `${s}%`
  if (field.endsWith('_days')) return `${s} nap`
  if (field.endsWith('_hours')) return `${s} óra`
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

const labelOf = (field: string) => LABEL[field] ?? (field.charAt(0).toUpperCase() + field.slice(1)).replace(/_/g, ' ')

/** A változások olvasható sorai (összevonva, zaj nélkül). */
export function auditLines(changes: AuditChange[] = []): AuditLine[] {
  const out: AuditLine[] = []
  const grouped = new Set<string>()
  for (const c of changes) {
    if (SKIP.test(c.field)) continue
    const g = GROUPS.find(([re]) => re.test(c.field))
    if (g) { if (!grouped.has(g[1])) { grouped.add(g[1]); out.push({ label: g[1], text: 'módosítva' }) } continue }
    const from = fmt(c.field, c.from), to = fmt(c.field, c.to)
    if (from === to) continue
    const label = labelOf(c.field)
    if (REF.has(c.field)) out.push({ label, text: c.to == null || c.to === '' ? 'eltávolítva' : c.from == null || c.from === '' ? 'megadva' : 'lecserélve' })
    else if (LONG.has(c.field)) out.push({ label, text: c.to == null || c.to === '' ? 'törölve' : `„${to}”` })
    else out.push({ label, from, to })
  }
  return out
}

/** Egy napló-bejegyzés emberi formában. `summary` a tárolt összegzés („Asztalfoglalás módosítva — Horváth Anna · 2026-11-03 14:00”). */
export function auditView(e: { action: AuditAction; collection: string; summary: string; changes?: AuditChange[] }): AuditView {
  const entity = e.collection || e.summary.split(/ (létrehozva|módosítva|törölve)/)[0] || 'Elem'
  const noun = NOUN[entity] ?? entity
  const tail = e.summary.includes(' — ') ? e.summary.split(' — ').slice(1).join(' — ') : ''
  // a tárgy: név · dátum idő (a dátum magyarul)
  const title = tail
    .split(' · ')
    .map((p) => p.replace(/^(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?(?: (\d{2}:\d{2})(?::\d{2})?)?$/, (_m, d: string, t?: string) => `${fmtDate(d)}${t ? ` ${t.replace(/^0(\d)/, '$1')}` : ''}`))
    .join(' · ')
  const lines = auditLines(e.changes)
  const st = (e.changes ?? []).find((c) => c.field === 'status')
  if (e.action === 'update' && st && typeof st.to === 'string') {
    return { event: `${noun}: ${(STATUS[st.to] ?? st.to).toLowerCase()}`, tone: STATUS_TONE[st.to] ?? 'neutral', title: title || noun, lines: lines.filter((l) => l.label !== 'Állapot' || lines.length > 1) }
  }
  const settings = SETTINGS.has(entity)
  const event = e.action === 'create' ? `Új ${noun.toLowerCase()}` : e.action === 'delete' ? `${noun} törölve` : settings ? 'Beállítások módosítva' : `${noun} módosítva`
  const fallback = settings ? (lines.length ? lines.map((l) => l.label).slice(0, 3).join(', ') : 'Beállítások') : noun
  return { event, tone: e.action === 'create' ? 'ok' : e.action === 'delete' ? 'bad' : e.action === 'update' ? (lines.some((l) => l.label === 'Ár') ? 'pending' : 'warn') : 'neutral', title: settings ? fallback : title || fallback, lines: settings && lines.every((l) => l.text === 'módosítva') && lines.length <= 3 ? [] : lines }
}
