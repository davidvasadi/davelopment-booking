'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, Clock, Pencil, ArrowUpRight } from 'lucide-react'
import { DAY_LABELS_HU, DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { WheelTimePicker } from '@/components/ui/wheel-time-picker'
import { TimeSelect } from '@/components/ui/time-select'
import { OpeningHoursExceptions, type Exception } from '@/components/restaurant/OpeningHoursExceptions'
import { cn } from '@/lib/utils'

const DAY_ABBR: Record<DayOfWeek, string> = {
  monday: 'Hé', tuesday: 'Ke', wednesday: 'Sze', thursday: 'Csü', friday: 'Pé', saturday: 'Szo', sunday: 'Va',
}
/** Rövid nap-nevek a hőtérkép soraihoz. */
const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'Hét', tuesday: 'Kedd', wednesday: 'Sze', thursday: 'Csüt', friday: 'Pén', saturday: 'Szo', sunday: 'Vas',
}

type DayRow = {
  day_of_week: DayOfWeek
  id: number | string | null
  is_open: boolean
  open_time: string
  close_time: string
  dirty?: boolean
}

// ── Idővonal geometria (8:00 → 24:00, referencia toMin/mkBlock) ──
const W0 = 8 * 60
const W1 = 24 * 60
const SPAN = W1 - W0
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return W0
  return h * 60 + m
}
/** left% + width% egy nyitás→zárás intervallumra (24:00 = 00:00 kezelése). */
function blockGeo(open: string, close: string): { left: number; width: number } {
  const s = toMin(open)
  let e = toMin(close)
  if (e <= s) e = W1 // 00:00 vagy éjfél utáni zárás → 24:00-ig
  const left = ((s - W0) / SPAN) * 100
  const width = ((e - W0) / SPAN) * 100 - left
  return { left: Math.max(0, left), width: Math.max(0, Math.min(100 - Math.max(0, left), width)) }
}

export function AvailabilityView({
  restaurantId,
  days: initialDays,
  exceptions,
  turnMinutes,
  lastSeatingBuffer,
  bookingWindowDays,
  heat,
  heatTotal,
  heatStartHour,
}: {
  restaurantId: number | string
  days: DayRow[]
  exceptions: Exception[]
  turnMinutes: number | null
  lastSeatingBuffer: number | null
  bookingWindowDays: number | null
  heat: number[][]
  heatTotal: number
  heatStartHour: number
}) {
  const router = useRouter()
  const [days, setDays] = useState<DayRow[]>(initialDays)
  const [saving, setSaving] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [picker, setPicker] = useState<'open' | 'close' | null>(null)

  // Mai nap (Mon=0)
  const todayIdx = (new Date().getDay() + 6) % 7

  const dirtyCount = useMemo(() => days.filter((d) => d.dirty).length, [days])

  // A rendes heti nyitvatartás (nap → nyitva/idők) — az Eltérő napok ezzel dönti el, hogy egy
  // eltérés rövidített/hosszabbított-e, és hogy a rendessel megegyező eltérés törölhető-e.
  const weeklyHours = useMemo(
    () => Object.fromEntries(days.map((d) => [d.day_of_week, { is_open: d.is_open, open_time: d.open_time, close_time: d.close_time }])),
    [days],
  )

  const update = (idx: number, patch: Partial<DayRow>) =>
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch, dirty: true } : d)))

  // Ugyanaz a mentés-kontraktus mint a régi editorban: POST/PATCH /api/opening-hours
  const persist = async (d: DayRow): Promise<DayRow> => {
    const body = {
      restaurant: restaurantId,
      day_of_week: d.day_of_week,
      is_open: d.is_open,
      open_time: d.open_time,
      close_time: d.close_time,
    }
    const res = d.id
      ? await fetch(`/api/opening-hours/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
      : await fetch('/api/opening-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
    if (!res.ok) throw new Error()
    const json = await res.json()
    return { ...d, id: d.id ?? json.doc?.id ?? null, dirty: false }
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const next = [...days]
      for (let i = 0; i < next.length; i++) {
        if (next[i].dirty) next[i] = await persist(next[i])
      }
      setDays(next)
      router.refresh()
      toast.success('Minden módosítás mentve')
    } catch {
      toast.error('Néhány nap mentése nem sikerült')
    } finally {
      setSaving(false)
    }
  }

  // A fejléc „Mentés" gombja a nem mentett napokat menti (a meglévő mentés-akció).
  const saveHeader = async () => {
    if (dirtyCount === 0) { toast.success('Nincs mentendő módosítás'); return }
    await saveAll()
  }

  // Egy nap mentése a sheet-ből
  const saveDay = async () => {
    if (editIdx == null) return
    setSaving(true)
    try {
      const saved = await persist(days[editIdx])
      setDays((prev) => prev.map((x, i) => (i === editIdx ? saved : x)))
      router.refresh()
      toast.success('Mentve')
      setEditIdx(null)
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 lg:p-0">
      {/* FEJLÉC */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] lg:text-[42px] font-light leading-none tracking-[-0.02em] text-ink">Nyitvatartás</h1>
          <p className="mt-1.5 text-sm font-medium text-ink-soft">Heti rend, foglalási szabályok és eltérő napok</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-dav-pill border border-line bg-white/60 px-4 py-2.5 text-sm font-medium text-ink">
            <Clock className="h-[15px] w-[15px]" strokeWidth={1.7} />
            Időzóna: Budapest
          </span>
          <button
            type="button"
            onClick={saveHeader}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-dav-pill bg-ink-dark px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Check className="h-[15px] w-[15px] text-gold" strokeWidth={1.8} />
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-[5px] lg:grid-cols-[1.7fr_1fr] lg:items-start">
        {/* BAL OSZLOP */}
        <div className="flex flex-col gap-[5px]">
          {/* HETI REND — idővonal */}
          <div className="rounded-[26px] dav-card-glass px-4 pb-4 pt-1 sm:px-6 sm:pb-5">
            <div className="flex items-center justify-between border-b border-line py-4">
              <span className="text-[15px] font-semibold text-ink">Heti rend</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#26231F]" />
                Nyitva
              </span>
            </div>

            {/* óra-skála 8..24 */}
            <div className="flex items-center gap-3 pb-0.5 pt-2 sm:gap-3.5">
              <span className="w-[104px] shrink-0" />
              <div className="relative h-3.5 flex-1">
                <span className="absolute left-0 text-[10px] font-medium text-[#C2BDAD]">8</span>
                <span className="absolute left-1/4 text-[10px] font-medium text-[#C2BDAD]">12</span>
                <span className="absolute left-1/2 text-[10px] font-medium text-[#C2BDAD]">16</span>
                <span className="absolute left-3/4 text-[10px] font-medium text-[#C2BDAD]">20</span>
                <span className="absolute right-0 text-[10px] font-medium text-[#C2BDAD]">24</span>
              </div>
              <span className="w-[15px] shrink-0" />
            </div>

            {/* nap-sorok */}
            {days.map((d, idx) => {
              const isToday = idx === todayIdx
              const geo = d.is_open ? blockGeo(d.open_time, d.close_time) : null
              const showLabel = geo ? geo.width > 22 : false
              return (
                <button
                  key={d.day_of_week}
                  type="button"
                  onClick={() => setEditIdx(idx)}
                  className="flex w-full items-center gap-3 rounded-[13px] px-1.5 py-2.5 text-left transition-colors hover:bg-paper/50 sm:gap-3.5"
                  style={isToday ? { background: 'linear-gradient(90deg, rgba(241,206,69,.16), rgba(241,206,69,0))' } : undefined}
                >
                  <div className="flex w-[104px] shrink-0 items-center gap-1.5">
                    <span className={cn('whitespace-nowrap text-sm', isToday ? 'font-semibold' : 'font-medium', d.is_open ? 'text-ink' : 'text-ink-soft2')}>
                      {DAY_LABELS_HU[d.day_of_week]}
                    </span>
                    {isToday && (
                      <span className="rounded-[7px] bg-ink-dark px-1.5 py-0.5 text-[9px] font-semibold leading-none text-gold">MA</span>
                    )}
                  </div>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-[9px] bg-[#F1F0EB]">
                    <span className="absolute bottom-0 left-1/4 top-0 w-px bg-[rgba(120,110,70,.07)]" />
                    <span className="absolute bottom-0 left-1/2 top-0 w-px bg-[rgba(120,110,70,.07)]" />
                    <span className="absolute bottom-0 left-3/4 top-0 w-px bg-[rgba(120,110,70,.07)]" />
                    {d.is_open && geo ? (
                      <div
                        className="absolute bottom-1 top-1 flex items-center justify-center rounded-[7px] text-[10px] font-semibold text-white/90"
                        style={{
                          left: `${geo.left.toFixed(2)}%`,
                          width: `${geo.width.toFixed(2)}%`,
                          background: '#26231F',
                          boxShadow: '0 2px 6px rgba(40,35,15,.14)',
                        }}
                      >
                        {showLabel ? `${d.open_time} – ${d.close_time}` : ''}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center pl-3 text-xs font-medium italic text-[#C2BDAD]">
                        Zárva — pihenőnap
                      </div>
                    )}
                  </div>
                  <Pencil className={cn('h-[15px] w-[15px] shrink-0', d.is_open ? 'text-ink' : 'text-[#C2BDAD]')} strokeWidth={1.6} />
                </button>
              )
            })}
          </div>

          {/* FOGLALÁSI SZABÁLYOK — csak valós mezők */}
          <div className="rounded-[26px] dav-card-glass px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[15px] font-semibold text-ink">Foglalási szabályok</div>
              <Link
                href="/restaurant/settings"
                aria-label="Foglalási szabályok szerkesztése a Beállításokban"
                title="Szerkesztés a Beállításokban"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(80,70,30,.12)]"
              >
                <ArrowUpRight className="h-[15px] w-[15px] text-ink" strokeWidth={1.8} />
              </Link>
            </div>
            <RuleRow label="Foglalási időköz" value={turnMinutes != null ? `${turnMinutes} perc` : '—'} />
            <RuleRow label="Utolsó foglalás" value={lastSeatingBuffer != null ? `záráskor −${lastSeatingBuffer} perc` : '—'} />
            <RuleRow label="Max. előrefoglalás" value={bookingWindowDays != null ? `${bookingWindowDays} nap` : '—'} last />
          </div>
        </div>

        {/* JOBB OSZLOP */}
        <div className="flex flex-col gap-[5px]">
          {/* TIPIKUS TERHELÉS — a Statisztikák „Foglaltsági jelentés" hőtérkép-designja */}
          <HeatmapPanel heat={heat} heatTotal={heatTotal} startHour={heatStartHour} />

          {/* ELTÉRŐ NAPOK — meglévő CRUD, referencia tile-stílusra */}
          <OpeningHoursExceptions restaurantId={restaurantId} initial={exceptions} variant="tiles" weeklyHours={weeklyHours} />
        </div>
      </div>

      {/* ── Nap-szerkesztő sheet (a ceruzáról / sorról nyílik) ── */}
      <Sheet open={editIdx != null} onOpenChange={(o) => { if (!o) setEditIdx(null) }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[26px] border-t border-line bg-white">
          {editIdx != null && (
            <div>
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-[11px] font-bold text-ink-soft2">
                    {DAY_ABBR[days[editIdx].day_of_week]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{DAY_LABELS_HU[days[editIdx].day_of_week]}</p>
                    <p className="text-xs text-ink-soft">Heti nyitvatartás</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update(editIdx, { is_open: !days[editIdx].is_open })}
                  className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', days[editIdx].is_open ? 'bg-ink-dark' : 'bg-line-strong')}
                >
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', days[editIdx].is_open ? 'left-5' : 'left-1')} />
                </button>
              </div>

              {days[editIdx].is_open ? (
                <>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-soft2">Idősáv</p>
                  {/* Desktop: TimeSelect, mobil: wheel picker */}
                  <div className="mb-6 hidden items-center gap-3 lg:flex">
                    <TimeSelect value={days[editIdx].open_time} onChange={(v) => update(editIdx, { open_time: v })} className="w-[7rem]" />
                    <span className="text-sm text-ink-soft2">–</span>
                    <TimeSelect value={days[editIdx].close_time} onChange={(v) => update(editIdx, { close_time: v })} className="w-[7rem]" />
                  </div>
                  <div className="mb-6 flex items-center gap-3 lg:hidden">
                    <button type="button" onClick={() => setPicker('open')} className="h-12 flex-1 rounded-2xl bg-paper text-lg font-semibold tabular-nums text-ink">{days[editIdx].open_time}</button>
                    <span className="text-sm text-ink-soft2">–</span>
                    <button type="button" onClick={() => setPicker('close')} className="h-12 flex-1 rounded-2xl bg-paper text-lg font-semibold tabular-nums text-ink">{days[editIdx].close_time}</button>
                  </div>
                </>
              ) : (
                <p className="mb-6 text-sm text-ink-soft2">Ezen a napon zárva — nem fogadtok foglalást.</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setEditIdx(null)} className="h-11 flex-1 rounded-2xl border border-line-strong text-sm font-semibold text-ink-soft">Mégse</button>
                <button type="button" onClick={saveDay} disabled={saving} className="h-11 flex-1 rounded-2xl bg-ink-dark text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Mentés...' : 'Mentés'}</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editIdx != null && (
        <WheelTimePicker
          open={picker != null}
          onClose={() => setPicker(null)}
          title={picker === 'close' ? 'Záróra' : 'Nyitás'}
          subtitle={DAY_LABELS_HU[days[editIdx].day_of_week]}
          value={picker === 'close' ? days[editIdx].close_time : days[editIdx].open_time}
          onChange={(v) => editIdx != null && update(editIdx, picker === 'close' ? { close_time: v } : { open_time: v })}
          shorthands={picker === 'close' ? ['22:00', '22:30', '23:00', '00:00'] : ['08:00', '09:00', '10:00', '11:00']}
        />
      )}
    </div>
  )
}

function RuleRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-3.5', !last && 'border-b border-line')}>
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}

/** Sötét NAP×ÓRA pötty-hőtérkép — a Statisztikák oldal „Foglaltsági jelentés" kártyájával
 *  azonos kinézet: nagy szám + nyilak, kör-pötty rács 3 intenzitás-szinttel, csúcs + legenda. */
function heatColor(t: number): string {
  if (t >= 0.66) return '#F1CE45'
  if (t >= 0.33) return '#8f8330'
  return '#3a3934'
}
function HeatmapPanel({ heat, heatTotal, startHour }: { heat: number[][]; heatTotal: number; startHour: number }) {
  const count = heat[0]?.length ?? 12
  const hours = Array.from({ length: count }, (_, i) => startHour + i)
  // Teljes szélességet kitöltő oszlopok — a pötty a cellában középen, fix kis mérettel,
  // így SEM óriási nem lesz, SEM üres folt nem marad a kártya jobb szélén.
  const gridStyle = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }

  const flat = heat.flat()
  const max = Math.max(1, ...flat)
  const norm = heat.map((row) => row.map((v) => v / max))
  const activeCount = flat.filter((v) => v > max * 0.5).length
  const quietCount = flat.filter((v) => v > 0 && v <= max * 0.25).length

  let peakDay = 0, peakHi = 0, best = -1
  heat.forEach((row, di) => row.forEach((v, hi) => { if (v > best) { best = v; peakDay = di; peakHi = hi } }))

  const ticks = hours.map((h, i) => (i % 3 === 0 || i === count - 1 ? h : null))

  return (
    <div className="flex flex-col rounded-[26px] bg-ink-dark p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between">
        <span className="text-[15px] font-medium text-white">Tipikus terhelés</span>
      </div>

      {heatTotal === 0 ? (
        <>
          <div className="space-y-1 sm:space-y-1.5">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="flex items-center gap-1.5">
                <span className="w-6 shrink-0 text-[10px] font-medium text-white/40">{DAY_SHORT[day]}</span>
                <div className="grid flex-1 gap-1 sm:gap-1.5" style={gridStyle}>
                  {Array.from({ length: count }).map((_, k) => (
                    <span key={k} className="aspect-square w-full max-w-[20px] justify-self-center rounded-full" style={{ background: '#3a3934' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">Még nincs elég adat a terhelés kimutatásához.</p>
        </>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-5">
            <div className="flex items-center gap-1">
              <span className="text-[30px] font-light leading-none text-white">{activeCount}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[30px] font-light leading-none text-white/55">{quietCount}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e08a3c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" /></svg>
            </div>
          </div>

          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="w-6 shrink-0" />
            <div className="grid flex-1 gap-1 sm:gap-1.5" style={gridStyle}>
              {ticks.map((h, i) => (
                <span key={i} className="text-center text-[10px] font-medium text-white/40">{h ?? ''}</span>
              ))}
            </div>
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            {norm.map((row, di) => (
              <div key={di} className="flex items-center gap-1.5">
                <span className="w-6 shrink-0 text-[10px] font-medium text-white/40">{DAY_SHORT[DAYS_OF_WEEK[di]]}</span>
                <div className="grid flex-1 gap-1 sm:gap-1.5" style={gridStyle}>
                  {row.map((t, hi) => (
                    <span key={hi} className="aspect-square w-full max-w-[20px] justify-self-center rounded-full" style={{ background: heatColor(t) }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-gold">
              Csúcs · {DAY_SHORT[DAYS_OF_WEEK[peakDay]]} {String(hours[peakHi]).padStart(2, '0')}h
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/40">
              Kevesebb
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: '#3a3934' }} />
                <span className="h-2 w-2 rounded-full" style={{ background: '#8f8330' }} />
                <span className="h-2 w-2 rounded-full" style={{ background: '#F1CE45' }} />
              </span>
              Több
            </span>
          </div>
        </>
      )}
    </div>
  )
}
