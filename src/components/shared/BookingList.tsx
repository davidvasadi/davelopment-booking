'use client'

import { ArrowUpRight, CalendarDays, Footprints, Globe as Globe2, HandCoins, Phone, Repeat } from 'lucide-react'
import { Avatar, Card, EmptyState, IconButton, ListRow, Pill, StatusPill, type Status } from '@/components/ui-kit'
import { hhmmToMinutes } from '@/lib/utils'

/** Egy sor a foglalás-listában — a hívó állítja elő (szalon: Booking, étterem: Reservation). */
export type ListItem = {
  id: string
  start: string
  title: string
  meta?: string
  who?: { name: string; img?: string | null }
  source?: string | null
  deposit?: 'paid' | 'failed' | null
  series?: boolean
  draft?: boolean
  occ?: React.ReactNode
  status: { tone: Status; label: string }
  cancelled?: boolean
  /** étterem: a létszám (a csoport-fejlécben összegezve) */
  pax?: number
  /** mobil csoport (étterem: a terem neve); nélküle napszak */
  group?: string
}

const SOURCE = { online: { icon: Globe2, l: 'online' }, phone: { icon: Phone, l: 'telefon' }, walk_in: { icon: Footprints, l: 'beeső' }, walk: { icon: Footprints, l: 'beeső' } } as const

/**
 * Foglalás-sor (a /design 6.2 / 6.7 / 6.11 / 6.14 — a design oldal is ezt mutatja): idő, vendég + szolgáltatás
 * (étteremnél asztal + létszám), opcionálisan munkatárs, forrás, előleg, alkalom, állapot-pill, ↗. A megnyitott sor sárga.
 */
export function BookingRow({ t, n, sv, status, who, src, dep, occ, open = false, arrow = false, draft = false, series = false, cancelled = false, onOpen }: {
  t: string
  n: string
  sv?: string
  status: { tone: Status; label: string }
  who?: { name: string; img?: string | null }
  src?: string | null
  dep?: 'paid' | 'failed' | null
  occ?: React.ReactNode
  open?: boolean
  arrow?: boolean
  draft?: boolean
  series?: boolean
  cancelled?: boolean
  onOpen?: () => void
}) {
  const Src = src ? SOURCE[src as keyof typeof SOURCE] : undefined
  const row = (
    <ListRow filled={!open} open={open}
      leading={<span className="w-11 shrink-0 text-ui-body text-ui-text">{t}</span>}
      title={draft || series || cancelled ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate ${cancelled ? 'line-through' : ''}`}>{n}</span>
          {draft && <Pill tone="yellow" size="sm">Vázlat</Pill>}
          {series && <Repeat className="h-3.5 w-3.5 shrink-0 text-ui-muted" aria-label="Sorozat" />}
        </span>
      ) : n}
      meta={sv}
      trailing={
        <span className="flex items-center gap-1.5">
          {who && <span className="hidden w-28 items-center gap-2 text-ui-meta text-ui-text md:flex"><Avatar size="xs" src={who.img ?? null} name={who.name} /><span className="truncate">{who.name}</span></span>}
          {Src && <Pill tone="white" size="sm" icon={Src.icon} className="max-sm:hidden">{Src.l}</Pill>}
          {dep && <Pill tone="white" size="sm" icon={HandCoins} className={`max-sm:hidden ${dep === 'failed' ? 'text-ui-bad' : ''}`}>{dep === 'paid' ? 'előleg' : 'sikertelen fizetés'}</Pill>}
          {occ}
          <StatusPill status={status.tone}>{status.label}</StatusPill>
          {arrow && <IconButton icon={ArrowUpRight} label="Megnyitás" variant="glass" size="sm" className="max-sm:hidden" />}
        </span>
      } />
  )
  if (!onOpen) return row
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }} className={`cursor-pointer rounded-ui-inner outline-none transition-[filter] hover:brightness-[.98] focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${cancelled ? 'opacity-60' : ''}`}>
      {row}
    </div>
  )
}

/** Csoport-fejléc a listában: desktopon sötét óra-pill, szaggatott vonal, a szám (étteremnél + fő); mobilon napszak
 *  (étteremnél terem) halvány címkével. */
export function BookingGroupHead({ h, count, pax, mobile = false }: { h: string; count: number; pax?: number; mobile?: boolean }) {
  if (mobile) return <div className="mb-1.5 flex items-center gap-2 text-ui-label text-ui-muted">{h}<span className="h-px flex-1 border-t border-dashed border-ui-divider" />{count}</div>
  return <div className="flex items-center gap-2 px-2 py-2"><Pill tone="dark" size="sm">{h}</Pill><span className="h-px flex-1 border-t border-dashed border-ui-divider" /><span className="text-ui-label text-ui-muted">{count} foglalás{pax != null ? ` · ${pax} fő` : ''}</span></div>
}

const daypart = (t: string) => { const m = hhmmToMinutes(t); return m < 12 * 60 ? 'Délelőtt' : m < 17 * 60 ? 'Délután' : 'Este' }

function groupBy(items: ListItem[], key: (x: ListItem) => string) {
  const groups: { h: string; items: ListItem[] }[] = []
  for (const x of items) {
    const h = key(x)
    const g = groups.find((y) => y.h === h)
    if (g) g.items.push(x)
    else groups.push({ h, items: [x] })
  }
  return groups
}

/**
 * A nap listában (design 6.2 / 6.14; mobilon 6.11 / 6.19): desktopon órák szerint csoportosítva, mobilon napszak
 * (étteremnél terem) szerint, fent a nap csíkjával (`mobileTop`). A sorra kattintva megnyílik a foglalás; a megnyitott sor
 * (`openId`) sárga.
 */
export function BookingList({ items, openId, onOpen, mobileTop }: { items: ListItem[]; openId?: string | null; onOpen: (id: string) => void; mobileTop?: React.ReactNode }) {
  const sorted = [...items].sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start))
  const restaurant = sorted.some((x) => x.pax != null)
  const row = (x: ListItem, desktop: boolean) => (
    <BookingRow key={x.id} t={x.start} n={x.title} sv={x.meta} status={x.status} who={desktop ? x.who : undefined} src={desktop ? x.source : undefined} dep={desktop ? x.deposit : undefined}
      occ={x.occ} open={x.id === openId} arrow={desktop} draft={x.draft} series={x.series} cancelled={x.cancelled} onOpen={() => onOpen(x.id)} />
  )
  const empty = <EmptyState icon={CalendarDays} title="Erre a napra nincs foglalás">A szűrők vagy a keresés mindent elrejthet — nézd meg a fejlécben.</EmptyState>

  return (
    <>
      <Card pad="sm" className="max-lg:hidden">
        {sorted.length === 0 ? empty : groupBy(sorted, (x) => `${x.start.slice(0, 2)}:00`).map((g) => (
          <div key={g.h} className="mb-2">
            <BookingGroupHead h={g.h} count={g.items.length} pax={restaurant ? g.items.reduce((a, x) => a + (x.pax ?? 0), 0) : undefined} />
            <div className="space-y-1">{g.items.map((x) => row(x, true))}</div>
          </div>
        ))}
      </Card>
      <Card className="lg:hidden">
        {mobileTop}
        {sorted.length === 0 ? <div className="mt-4">{empty}</div> : groupBy(sorted, (x) => x.group ?? daypart(x.start)).map((g) => (
          <div key={g.h} className="mt-4">
            <BookingGroupHead mobile h={g.h} count={g.items.length} />
            <div className="space-y-1">{g.items.map((x) => row(x, false))}</div>
          </div>
        ))}
      </Card>
    </>
  )
}

/** A foglalás állapota a kit pill-jén: függő sárga, megerősített sötét, bent zöld, befejezett szürke, lemondva / nem jött /
 *  késik piros. `lateMin`: ennyi perce késik (megerősített, a kezdés elmúlt, még nincs lezárva). */
export function statusOf(status: string, lateMin: number | null = null): ListItem['status'] {
  if (lateMin != null && lateMin > 0) return { tone: 'bad', label: `Késik ${lateMin} p` }
  const map: Record<string, ListItem['status']> = {
    pending: { tone: 'pending', label: 'Függő' },
    confirmed: { tone: 'confirmed', label: 'Megerősített' },
    seated: { tone: 'ok', label: 'Bent' },
    completed: { tone: 'neutral', label: 'Befejezett' },
    cancelled: { tone: 'bad', label: 'Lemondva' },
    no_show: { tone: 'bad', label: 'Nem jött' },
  }
  return map[status] ?? { tone: 'neutral', label: status }
}
