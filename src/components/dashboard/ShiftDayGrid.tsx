'use client'

import { Avatar, Meta, MarqueeText } from '@/components/ui-kit'
import { BlockLegend } from '@/components/blocks/booking'
import { ResourceGrid, type GridRow } from '@/components/shared/ResourceGrid'
import { TYPE_LABEL, absenceRun, fmtH, posOf, rangeLabel, shiftHours, shiftLabel, type ShiftVM, type StaffVM } from '@/lib/schedule'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'

type Seg = { id: string; shift: ShiftVM; start: number; end: number }

/**
 * A Naptár nap-nézete (design 11.2.1, étteremnél 11.8): a Foglalások idővonala (ResourceGrid), műszakokkal — soronként
 * egy munkatárs, a műszak sárga blokk (a szünetnél rés), a beteg sötét, a szabadság szürke (a teljes napon, a több napos
 * távollét időszakával), a szabad idő csíkos; „most” vonal. Szalonnál 8–20, étteremnél 14–24 óra (ha a műszakok
 * kilógnak, tágul). Az élő Naptár és a design oldal is ezt mutatja. `shifts`: az összes betöltött bejegyzés (a több
 * napos távollét felirata miatt); `onEdit`: sávra kattintva (élőben a nap-szerkesztő).
 */
export function ShiftDayGrid({ staff, shifts, date, restaurant = false, nowMin, closed = false, head, onEdit }: {
  staff: StaffVM[]
  shifts: ShiftVM[]
  date: string
  restaurant?: boolean
  nowMin: number | null
  closed?: boolean
  head?: React.ReactNode
  onEdit?: (s: ShiftVM) => void
}) {
  const own = shifts.filter((s) => s.date === date)
  const times = own.filter((s) => s.type === 'shift' && s.start_time && s.end_time).flatMap((s) => [hhmmToMinutes(s.start_time!), hhmmToMinutes(s.end_time!)])
  const h0 = Math.min(restaurant ? 14 * 60 : 8 * 60, ...times.map((t) => Math.floor(t / 60) * 60))
  const h1 = Math.max(restaurant ? 24 * 60 : 20 * 60, ...times.map((t) => Math.ceil(t / 60) * 60))
  const segsOf = (s: ShiftVM): Seg[] => {
    if (s.type === 'vacation') return []
    if (s.type !== 'shift' || !s.start_time || !s.end_time) return [{ id: s.id, shift: s, start: h0, end: h1 }]
    // a műszak a szünet(ek)nél megszakad (design: „a szünet rés benne”)
    const end = hhmmToMinutes(s.left_early_at ?? s.end_time)
    const cuts = [...s.breaks].filter((b) => b.start_time && b.end_time).sort((a, b) => a.start_time!.localeCompare(b.start_time!))
    const out: Seg[] = []
    let cur = hhmmToMinutes(s.start_time)
    cuts.forEach((b, i) => { const bs = hhmmToMinutes(b.start_time!), be = hhmmToMinutes(b.end_time!); if (bs > cur) out.push({ id: `${s.id}-${i}`, shift: s, start: cur, end: Math.min(bs, end) }); cur = Math.max(cur, be) })
    if (end > cur) out.push({ id: `${s.id}-end`, shift: s, start: cur, end })
    return out
  }
  const nameOf = (id: string) => staff.find((st) => st.id === id)?.name ?? ''
  const rows: GridRow<Seg>[] = staff.map((st) => {
    const mine = own.filter((s) => s.staffId === st.id)
    const h = mine.filter((s) => s.type === 'shift').reduce((a, s) => a + shiftHours(s), 0)
    const off = mine.find((s) => s.type === 'vacation')
    return {
      id: st.id, name: st.name,
      label: (
        <span className="flex items-center gap-2.5">
          <Avatar size="sm" src={st.avatarUrl ?? null} name={st.name} />
          <span className="min-w-0"><MarqueeText className="text-ui-body text-ui-text">{st.name}</MarqueeText><MarqueeText className="text-ui-label text-ui-muted">{[posOf(st), h ? fmtH(h) : off ? 'szabadnap' : null].filter(Boolean).join(' · ')}</MarqueeText></span>
        </span>
      ),
      items: mine.flatMap(segsOf),
    }
  })
  return (
    <ResourceGrid<Seg>
      head={head}
      groups={[{ key: 'staff', rows }]}
      access={{
        id: (x) => x.id,
        start: (x) => x.start,
        end: (x) => x.end,
        status: (x) => x.shift.type,
        tone: (x) => (x.shift.type === 'sick' ? 'bg-ui-dark text-white' : x.shift.type === 'leave' ? 'bg-ui-grey text-ui-dark' : 'bg-ui-yellow text-ui-dark'),
        dragLabel: (x) => nameOf(x.shift.staffId),
        block: (x) => {
          const run = x.shift.type === 'shift' ? null : absenceRun(shifts, x.shift)
          return {
            title: x.shift.type === 'shift' ? `${minutesToHHMM(x.start)}–${minutesToHHMM(x.end)}` : TYPE_LABEL[x.shift.type],
            sub: run ? rangeLabel(run.from, run.to) : 'Műszak',
            tooltip: `${nameOf(x.shift.staffId)} · ${shiftLabel(x.shift)}`,
          }
        },
      }}
      stack={(items) => items}
      openMin={h0}
      closeMin={h1}
      nowMin={nowMin}
      closed={closed}
      onEdit={(x) => onEdit?.(x.shift)}
      legend={<BlockLegend alerts={false} items={[['bg-ui-yellow', 'Műszak'], ['bg-ui-dark', 'Beteg'], ['bg-ui-grey', 'Szabadság'], ['ui-hatch', 'Szabad idő']]} />}
      empty={<Meta className="py-10 text-center">Nincs munkatárs.</Meta>}
    />
  )
}
