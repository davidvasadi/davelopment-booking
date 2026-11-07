'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart3, CalendarDays, Clock, Download, Settings2, Globe as Globe2, Link2, Users, Wallet } from 'lucide-react'
import { Button, EmptyState, IconButton, Kpi, Meta, Modal, Note, PageHead, SegmentBar, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { PeriodPicker } from '@/components/blocks/calendar'
import {
  GuestsDetail, HoursDetail, NoShowDetail, RestPartyCard, RestPartyDetail, RevenueDetail, SourceDetail, StatDetailPanel,
  StatGuestsCard, StatHoursCard, StatNoShowCard, StatReviewsCard, StatRevenueCard, StatSourceCard, StatTopCard, StatUtilCard, StatWeekCard, TopDetail, UtilDetail, WeekDetail,
} from '@/components/blocks/stats'
import { MONTHS_SHORT } from '@/lib/schedule'
import type { StatsVM } from '@/lib/statsTypes'

type Detail = 'week' | 'revenue' | 'guests' | 'util' | 'noshow' | 'hours' | 'source' | 'top' | 'tables'
const PRESETS = [7, 30, 90, 365]
const PRESET_LABEL: Record<number, string> = { 7: '7 nap', 30: '30 nap', 90: 'Negyedév', 365: 'Év' }
const nf = (n: number) => n.toLocaleString('hu-HU')
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : String(n))
const dayLbl = (s: string) => { const [, m, d] = s.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${d}.` }

/**
 * Statisztikák (design 5.1–5.4): fejléc az időszakkal (7 nap / 30 nap / negyedév / év + egyedi), a csík és a nagy számok,
 * alatta a bento-rács; minden kártya kattintható → a részletes lap az egységes felugró ablakban. Az összevetés mindig az
 * előző, ugyanolyan hosszú időszakkal. Mobilon a kártyák egymás alatt. Szalon és étterem közös (5.4 eltérések).
 */
export function StatsView({ vm, preset, base, bizName, scope, canGuests = true, bookingUrl }: {
  vm: StatsVM
  /** a gyors-gomb napjai (7 / 30 / 90 / 365); egyedi időszaknál null */
  preset: number | null
  /** „/dashboard” vagy „/restaurant” */
  base: string
  bizName: string
  /** szalon: Üzlet ↔ Saját munka váltó (csak teljes joggal és saját munkatárs-profillal) */
  scope?: { own: boolean; canSwitch: boolean }
  canGuests?: boolean
  bookingUrl: string
}) {
  const router = useRouter()
  const r = vm.restaurant
  const go = (q: Record<string, string>) => {
    const p = new URLSearchParams({ ...q, ...(scope?.own ? { scope: 'own' } : {}) })
    router.push(`${base}/analytics?${p}`)
  }
  const pickPreset = (i: number) => go({ period: String(PRESETS[i]) })

  // ── részletes lap ──
  const [detail, setDetail] = useState<Detail | null>(null)
  const open = (d: Detail) => () => setDetail(d)

  // ── egyedi időszak (5.1.1) ──
  const [period, setPeriod] = useState<{ from: string; to: string; end: boolean; custom: boolean } | null>(null)
  const openPeriod = () => setPeriod({ from: vm.from, to: vm.to, end: false, custom: preset == null })
  const onPick = (d: string) => setPeriod((p) => {
    if (!p) return p
    if (!p.end) return { from: d, to: d, end: true, custom: true }
    return d < p.from ? { from: d, to: p.from, end: false, custom: true } : { ...p, to: d, end: false, custom: true }
  })
  const len = period ? Math.round((new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000) + 1 : 0
  const cmp = period ? (() => { const f = new Date(`${period.from}T12:00:00`); const pt = new Date(f); pt.setDate(pt.getDate() - 1); const pf = new Date(f); pf.setDate(pf.getDate() - len); const y = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return `${dayLbl(y(pf))} – ${dayLbl(y(pt))}` })() : ''

  // mobilon nincs fenti időszak-váltó — ott a gyors-gombok is az ablakba kerülnek
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // ── export: a többi oldal export-ablaka, a foglalásokra, erre az időszakra ──
  const [exp, setExp] = useState(false)
  // mobil fejléc-ikonok (DashboardNav): időszak, export
  useEffect(() => {
    const a = () => openPeriod(), b = () => setExp(true)
    window.addEventListener('davelopment:open-analytics-daterange', a)
    window.addEventListener('davelopment:open-analytics-csv', b)
    return () => { window.removeEventListener('davelopment:open-analytics-daterange', a); window.removeEventListener('davelopment:open-analytics-csv', b) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ url: bookingUrl })
      else { await navigator.clipboard.writeText(bookingUrl); toast.success('A foglalóoldal címe a vágólapon') }
    } catch { /* megszakítva */ }
  }

  // ── fejléc ──
  const st = vm.status
  const bar = (mobile = false) => <SegmentBar className={mobile ? 'mt-4' : undefined} segments={vm.empty
    ? [{ label: r ? 'Megjelent' : 'Teljesített', value: '0%', weight: 25, tone: 'dark' }, { label: 'Függő', value: '0%', weight: 25, tone: 'yellow' }, { label: 'Lemondva', value: '0%', weight: 25, tone: 'hatch' }, { label: 'No-show', value: '0%', weight: 25, tone: 'outline' }]
    : [
      { label: r ? 'Megjelent' : 'Teljesített', value: `${st.done}%`, weight: st.done || 2, tone: 'dark' },
      { label: 'Függő', value: `${st.pending}%`, weight: st.pending || 2, tone: 'yellow' },
      { label: 'Lemondva', value: `${st.cancelled}%`, weight: st.cancelled || 2, tone: 'hatch' },
      ...(mobile ? [] : [{ label: 'No-show', value: `${st.noShow}%`, weight: st.noShow || 2, tone: 'outline' as const }]),
    ]} />
  const kpis = (size?: 'sm') => r
    ? <><Kpi size={size} icon={CalendarDays} value={nf(vm.kpis.bookings)} label="Foglalás" /><Kpi size={size} icon={Users} value={nf(vm.kpis.guests)} label="Vendég (fő)" /><Kpi size={size} icon={Clock} value={vm.kpis.saturation == null ? '—' : `${vm.kpis.saturation}%`} label="Telítettség" /></>
    : <><Kpi size={size} icon={CalendarDays} value={nf(vm.kpis.bookings)} label="Foglalás" /><Kpi size={size} icon={Wallet} value={short(vm.kpis.revenue)} label="Bevétel (Ft)" /><Kpi size={size} icon={Users} value={vm.kpis.returningPct == null ? '—' : `${vm.kpis.returningPct}%`} label="Visszatérő" /></>
  const presetIdx = preset != null ? PRESETS.indexOf(preset) : -1
  const title = scope?.own ? 'Saját statisztika' : 'Statisztikák'
  const sub = `${vm.label} · ${scope?.own ? 'a saját foglalásaid' : bizName}`
  const actions = (
    <>
      {scope?.canSwitch && <Segmented options={['Üzlet', 'Saját munka']} active={scope.own ? 1 : 0} onSelect={(i) => router.push(`${base}/analytics?${new URLSearchParams({ ...(preset ? { period: String(preset) } : { from: vm.from, to: vm.to }), ...(i ? { scope: 'own' } : {}) })}`)} />}
      <Segmented options={['7 nap', '30 nap', 'Negyedév', 'Év']} active={presetIdx} onSelect={pickPreset} />
      <IconButton icon={Settings2} label="Egyedi időszak" onClick={openPeriod} variant={preset == null ? 'dark' : undefined} />
      <Button variant="glass" icon={Download} onClick={() => setExp(true)}>Export</Button>
    </>
  )

  // ── a kártyák (a desktop rács és a mobil sorrend ugyanaz) ──
  const cards = r ? (
    <>
      <StatWeekCard week={vm.week} onOpen={open('week')} className="lg:col-span-4" />
      <StatUtilCard restaurant util={vm.util} onOpen={open('util')} className="lg:col-span-4" />
      <StatHoursCard hours={vm.hours} onOpen={open('hours')} className="lg:col-span-4" />
      {/* 5.4: ugyanaz a rács, mint az 5.1 — a Bevétel helyén a vendégszám vonal-grafikonja, a Top szolgáltatás helyén a Létszám
          (az asztalok elemzése a Létszám lapján) */}
      <StatSourceCard restaurant source={vm.source} onOpen={open('source')} className="lg:col-span-3 lg:row-span-2" />
      {vm.paxTrend && <StatRevenueCard title="Vendégszám alakulása" unit="fő" revenue={vm.paxTrend} onOpen={open('revenue')} className="lg:col-span-6" />}
      {vm.rest && <RestPartyCard rest={vm.rest} onOpen={open('tables')} className="lg:col-span-3" />}
      <StatGuestsCard guests={vm.guests} onOpen={open('guests')} className="lg:col-span-3" />
      <StatNoShowCard noShow={vm.noShow} onOpen={open('noshow')} className="lg:col-span-3" />
      <StatReviewsCard reviews={vm.reviews} className="lg:col-span-3" />
    </>
  ) : (
    <>
      <StatWeekCard week={vm.week} onOpen={open('week')} className="lg:col-span-4" />
      <StatUtilCard util={vm.util} onOpen={open('util')} className="lg:col-span-4" />
      <StatHoursCard hours={vm.hours} onOpen={open('hours')} className="lg:col-span-4" />
      <StatSourceCard source={vm.source} onOpen={open('source')} className="lg:col-span-3 lg:row-span-2" />
      {vm.revenue && <StatRevenueCard revenue={vm.revenue} onOpen={open('revenue')} className="lg:col-span-6" />}
      {vm.top && <StatTopCard top={vm.top} onOpen={open('top')} className="lg:col-span-3" />}
      <StatGuestsCard guests={vm.guests} onOpen={open('guests')} className="lg:col-span-3" />
      <StatNoShowCard noShow={vm.noShow} onOpen={open('noshow')} className="lg:col-span-3" />
      <StatReviewsCard reviews={vm.reviews} className="lg:col-span-3" />
    </>
  )
  // mobil (5.3): a telefonok sorrendje — Heti eloszlás, Bevétel, Kihasználtság, Mikor foglalnak, Top, Vendégek, a többi utánuk
  const mobileCards = (
    <>
      <StatWeekCard week={vm.week} onOpen={open('week')} />
      {!r && vm.revenue && <StatRevenueCard revenue={vm.revenue} onOpen={open('revenue')} />}
      {r && vm.paxTrend && <StatRevenueCard title="Vendégszám alakulása" unit="fő" revenue={vm.paxTrend} onOpen={open('revenue')} />}
      <StatUtilCard restaurant={r} util={vm.util} onOpen={open('util')} />
      <StatHoursCard hours={vm.hours} onOpen={open('hours')} />
      {!r && vm.top && <StatTopCard top={vm.top} onOpen={open('top')} />}
      {r && vm.rest && <RestPartyCard rest={vm.rest} onOpen={open('tables')} />}
      <StatGuestsCard guests={vm.guests} onOpen={open('guests')} />
      <StatSourceCard restaurant={r} source={vm.source} onOpen={open('source')} />
      <StatNoShowCard noShow={vm.noShow} onOpen={open('noshow')} />
      <StatReviewsCard reviews={vm.reviews} />
    </>
  )
  const bookingsAt = (date: string) => router.push(`${base}/bookings?date=${date}`)
  const body: Record<Detail, React.ReactNode> = {
    week: <WeekDetail week={vm.week} onRow={bookingsAt} onAll={(i) => { const d = vm.week.byDay[i]?.rows[0]?.date; if (d) bookingsAt(d) }} />,
    revenue: vm.revenue ? <RevenueDetail revenue={vm.revenue} total={vm.revenue.total} /> : vm.paxTrend ? <RevenueDetail revenue={vm.paxTrend} total={vm.paxTrend.total} title="Vendégszám alakulása" unit="fő" partsTitle="Honnan jöttek" /> : null,
    guests: <GuestsDetail guests={vm.guests} />,
    util: <UtilDetail restaurant={r} util={vm.util} onOffer={() => router.push(`${base}/marketing`)} />,
    noshow: <NoShowDetail noShow={vm.noShow} onDeposit={() => router.push(`${base}/settings?tab=payments`)} />,
    hours: <HoursDetail hours={vm.hours} />,
    source: <SourceDetail restaurant={r} source={vm.source} />,
    top: vm.top ? <TopDetail top={vm.top} /> : null,
    tables: vm.rest ? <RestPartyDetail rest={vm.rest} onSettings={() => router.push(`${base}/settings`)} onTables={() => router.push(`${base}/tables`)} /> : null,
  }
  const metaLabel = `${title} · ${preset ? PRESET_LABEL[preset] : `${dayLbl(vm.from)} – ${dayLbl(vm.to)}`}`

  const empty = (
    <EmptyState icon={BarChart3} title="Az első foglalások után itt látod a számokat" action={<span className="flex flex-wrap justify-center gap-1.5"><Button icon={Link2} onClick={() => void share()}>Foglalóoldal megosztása</Button><Button variant="glass" icon={Globe2} href={`${base}/settings?tab=google`}>Google „Foglalj most”</Button></span>}>
      {r ? 'Telítettség, vendégszám, a legerősebb esték, asztalok forgása' : 'Kihasználtság, bevétel, visszatérő vendégek, a legerősebb napok'} — ahogy jönnek a foglalások, a grafikonok maguktól megtelnek. Az első héttől már látszik a trend.
    </EmptyState>
  )

  return (
    <div className="p-4 lg:p-0">
      {/* ── desktop (5.1) ── */}
      <div className="max-lg:hidden">
        <PageHead title={title} sub={sub} actions={actions} bar={bar()} kpis={kpis()} />
        {vm.empty ? empty : <div className="grid gap-[5px] lg:grid-cols-12">{cards}</div>}
      </div>

      {/* ── mobil (5.3): kompakt fejléc, a kártyák egymás alatt ── */}
      <div className="lg:hidden">
        <div className="text-ui-num font-light leading-none text-ui-text">{title}</div>
        <Meta className="mt-1">{sub}</Meta>
        {bar(true)}
        <div className="mt-5 flex justify-between gap-2 pr-6">{kpis('sm')}</div>
        <div className="mt-4 space-y-[5px]">{vm.empty ? empty : mobileCards}</div>
      </div>

      {/* ── ablakok ── */}
      <PopupModal side="right" open={!!detail && !!body[detail]} onClose={() => setDetail(null)} panel={detail ? <StatDetailPanel meta={metaLabel} onClose={() => setDetail(null)}>{body[detail]}</StatDetailPanel> : undefined} />
      <PopupModal open={!!period} onClose={() => setPeriod(null)} panel={period ? (
        <Modal size="sm" title="Időszak" onClose={() => setPeriod(null)}>
          {/* desktopon a gyors-gombok fent vannak, itt csak az egyedi időszak; mobilon (nincs fenti váltó) a gyors-gombok is */}
          <PeriodPicker presets={mobile ? ['7 nap', '30 nap', 'Negyedév', 'Év', 'Egyedi'] : ['Egyedi']} active={mobile ? (period.custom ? 4 : presetIdx >= 0 ? presetIdx : 4) : 0}
            live={{ from: period.from, to: period.to, onPick, onPreset: (i) => { if (mobile && i < 4) { setPeriod(null); pickPreset(i) } else setPeriod({ ...period, custom: true }) } }} />
          <Note tip className="mt-3">Összevetés: {cmp} (az előző {len} nap)</Note>
          <Button className="mt-4 w-full" onClick={() => { setPeriod(null); go({ from: period.from, to: period.to }) }}>Alkalmaz</Button>
        </Modal>
      ) : undefined} />
      {exp && <ExportDialog guests={canGuests} guestsTotal={vm.guests.total} initial={{ what: 'bookings', preset: 3, from: vm.from, to: vm.to }} onClose={() => setExp(false)} />}
    </div>
  )
}
