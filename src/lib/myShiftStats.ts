import { format, subDays, addDays } from 'date-fns'
import { hu } from 'date-fns/locale'
import { getPayloadClient } from './payload'
import type { Shift, Membership, Restaurant } from '@/payload/payload-types'

/**
 * Saját (nem cégszintű) beosztás-statisztika egy éttermi taghoz — a `analytics.view.own`
 * capability étteremi megfelelője. Az étteremben a foglalás NINCS felszolgálóhoz rendelve
 * (asztalhoz van kötve), ezért itt nincs "saját bevétel/foglalás" — a reális saját adat a
 * beosztás (ledolgozott órák/napok, szabadság, betegszabadság, borravaló, bér). Ez a nézet
 * SAJÁT, önálló komponensbe töltődik (nem a céges `AnalyticsOverview`-ba) — lásd
 * `src/components/restaurant/StaffShiftStatsView.tsx`.
 */

export interface MyShiftDay {
  date: string
  label: string
  hours: number
  /** Volt-e szabadság/betegszabadság aznap (0/1) — a Bontások kattintható heti sorozataihoz. */
  leave: number
  sick: number
}
export interface MyShiftDowStat {
  day: string
  hours: number
}
export interface UpcomingShift {
  date: string
  label: string
  startTime: string | null
  endTime: string | null
}

export interface MyShiftStats {
  period: number
  periodHours: number
  periodHoursDiff: number
  workedDays: number
  workedDaysDiff: number
  /** Az ELŐZŐ (ugyanolyan hosszú) időszak ledolgozott napjainak/óráinak száma — a
   *  "Jelenlét" időszak-összevetés kártyához (nem csak a kerekített %-diff). */
  prevWorkedDays: number
  prevPeriodHours: number
  avgShiftHours: number
  sickDays: number
  leaveDays: number // szabadság + fizetett szabadság összesen
  upcomingShiftsCount: number
  /** A legközelebbi (max. 5) beütemezett műszak — a "Jelenlét" kártya helyén, konkrét
   *  dátum+időpont, NEM egy újabb Ledolgozva/Szabadság/Beteg-összesítés. */
  upcomingShifts: UpcomingShift[]
  trend: MyShiftDay[]
  byDayOfWeek: MyShiftDowStat[]
  /** Nap(Hét..Vas)×hét naptár-rács — kb. 30 napos ablak MÁHOZ KÉPEST (előző ~15 nap + következő
   *  ~15 nap, TELJES hetekre kerekítve — nincs "lyuk", minden cella valódi nap), FÜGGETLEN a
   *  lenti historikus `period`-től! Bináris: 0 = nincs beosztva, 1 = be van osztva (múltbeli
   *  napnál ez ledolgozva-t jelent). A -1 csak elméleti/üres-fallback állapot marad. */
  heatmap: { grid: number[][]; dates: (string | null)[][]; columnLabels: string[] }
  /** Borravaló a periódusra (Ft) — csak ha `tip_eligible` és van adat a napi közös összegből. */
  tipHuf: number | null
  /** Számolt bér a periódusra (Ft) — csak ha be van állítva órabér/napidíj. Napidíj:
   *  (ledolgozott + fizetett szabadság napok) × ráta; órabér: (órák + szabadság napok×8) × ráta. */
  wageHuf: number | null
  payLabel: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pctDiff(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function toMin(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

/** Ledolgozott óra egy műszakból — `left_early_at` felülírja a végét, ha korábban távozott. */
function shiftHours(sh: { start_time?: string | null; end_time?: string | null; left_early_at?: string | null }): number {
  const s = toMin(sh.start_time)
  const e = toMin(sh.left_early_at) ?? toMin(sh.end_time)
  if (s == null || e == null) return 0
  const span = e <= s ? e + 24 * 60 - s : e - s // éjfél utáni zárás
  return round2(span / 60)
}

function dayLabel(d: string, days: number): string {
  const date = new Date(d + 'T00:00:00')
  if (days <= 90) return format(date, 'MMM d.', { locale: hu })
  return format(date, 'MMM', { locale: hu })
}

const DOW = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

/** Az adott nap hetének hétfője (yyyy-MM-dd). */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return format(d, 'yyyy-MM-dd')
}

/** A Payload `date` mező teljes ISO-időbélyeget ad vissza — mindenhol yyyy-MM-dd-re kell
 *  normalizálni, különben az egyenlőség-alapú napi csoportosítás (trend, heti eloszlás)
 *  csendben semmit nem talál. */
const ymd = (d: string) => d.slice(0, 10)

export async function getMyShiftStats(
  restaurantId: string | number,
  memberId: string | number,
  days = 30,
  range?: { dateFrom?: string; dateTo?: string },
): Promise<MyShiftStats> {
  const payload = await getPayloadClient()

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const periodStartStr = range?.dateFrom ?? format(subDays(today, days - 1), 'yyyy-MM-dd')
  const periodEndStr = range?.dateTo ?? todayStr
  const rangeDays = Math.max(1, Math.round(
    (new Date(periodEndStr + 'T00:00:00').getTime() - new Date(periodStartStr + 'T00:00:00').getTime()) / 86400000,
  ) + 1)
  const prevPeriodStartStr = format(subDays(new Date(periodStartStr + 'T00:00:00'), rangeDays), 'yyyy-MM-dd')
  const prevPeriodEndStr = format(subDays(new Date(periodStartStr + 'T00:00:00'), 1), 'yyyy-MM-dd')

  // "Mikor dolgozom" naptár — kb. 30 napos ablak MÁHOZ KÉPEST (előző ~15 nap + következő ~15
  // nap), FÜGGETLEN a lenti historikus `period`-től. A rács TELJES hetekre van kerekítve (hétfőn
  // kezdődik, vasárnappal zár) — SZÁNDÉKOSAN nincs -1-es "lyuk"/kitöltő cella: minden kör valódi
  // napot mutat, ezért a tényleges ablak néhány nappal bővebb lehet a kerek 30-nál.
  const scheduleStartStr = mondayOf(format(subDays(today, 15), 'yyyy-MM-dd'))
  const scheduleEndStr = format(addDays(new Date(mondayOf(format(addDays(today, 14), 'yyyy-MM-dd')) + 'T00:00:00'), 6), 'yyyy-MM-dd')
  // +1 a NAPOK számához kell (a különbség még kizárja a záró napot), NEM a hét-számhoz —
  // különben egy pontosan hét-határra eső tartomány egy felesleges, teljesen üres sorral zárt.
  const scheduleGridDays = Math.round((new Date(scheduleEndStr + 'T00:00:00').getTime() - new Date(scheduleStartStr + 'T00:00:00').getTime()) / 86400000) + 1
  const scheduleWeeks = Math.round(scheduleGridDays / 7)

  const [membershipDoc, periodRes, upcomingRes, scheduleRes] = await Promise.all([
    payload.findByID({ collection: 'memberships', id: memberId, depth: 0, overrideAccess: true }).catch(() => null),
    payload.find({
      collection: 'shifts',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { member: { equals: memberId } },
          { date: { greater_than_equal: prevPeriodStartStr } },
          { date: { less_than_equal: periodEndStr } },
        ],
      },
      limit: 2000, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'shifts',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { member: { equals: memberId } },
          { type: { equals: 'shift' } },
          { date: { greater_than: todayStr } },
        ],
      },
      sort: 'date', limit: 5, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'shifts',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { member: { equals: memberId } },
          { type: { equals: 'shift' } },
          { date: { greater_than_equal: scheduleStartStr } },
          { date: { less_than_equal: scheduleEndStr } },
        ],
      },
      limit: 500, depth: 0, overrideAccess: true,
    }),
  ])

  const membership = membershipDoc as Membership | null

  const docs = (periodRes.docs as Shift[]).map((d) => ({ ...d, date: ymd(d.date) }))
  const periodDocs = docs.filter((d) => d.date >= periodStartStr && d.date <= periodEndStr)
  const prevDocs = docs.filter((d) => d.date >= prevPeriodStartStr && d.date <= prevPeriodEndStr)

  const workShiftsInPeriod = periodDocs.filter((d) => d.type === 'shift')
  const prevWorkShifts = prevDocs.filter((d) => d.type === 'shift')

  const periodHours = round2(workShiftsInPeriod.reduce((s, d) => s + shiftHours(d), 0))
  const prevHours = round2(prevWorkShifts.reduce((s, d) => s + shiftHours(d), 0))
  // Egy nap TÖBB műszak-sort is tartalmazhat — a "ledolgozott napok" a DISZTINKT dátumokat számolja.
  const workedDays = new Set(workShiftsInPeriod.map((d) => d.date)).size
  const prevWorkedDays = new Set(prevWorkShifts.map((d) => d.date)).size
  const avgShiftHours = workShiftsInPeriod.length > 0 ? round2(periodHours / workShiftsInPeriod.length) : 0

  const sickDays = new Set(periodDocs.filter((d) => d.type === 'sick').map((d) => d.date)).size
  const leaveDays = new Set(periodDocs.filter((d) => d.type === 'leave' || d.type === 'vacation').map((d) => d.date)).size
  const vacationDays = new Set(periodDocs.filter((d) => d.type === 'vacation').map((d) => d.date)).size

  const trend: MyShiftDay[] = Array.from({ length: rangeDays }, (_, i) => {
    const d = format(addDays(new Date(periodStartStr + 'T00:00:00'), i), 'yyyy-MM-dd')
    const dayDocs = periodDocs.filter((x) => x.date === d)
    const workDocs = dayDocs.filter((x) => x.type === 'shift')
    return {
      date: d, label: dayLabel(d, days),
      hours: round2(workDocs.reduce((s, x) => s + shiftHours(x), 0)),
      leave: dayDocs.some((x) => x.type === 'leave' || x.type === 'vacation') ? 1 : 0,
      sick: dayDocs.some((x) => x.type === 'sick') ? 1 : 0,
    }
  })

  const dowHours = [0, 0, 0, 0, 0, 0, 0]
  for (const d of workShiftsInPeriod) {
    const dow = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7
    dowHours[dow] += shiftHours(d)
  }
  const byDayOfWeek: MyShiftDowStat[] = DOW.map((day, i) => ({ day, hours: round2(dowHours[i]) }))

  // ── Naptár-hőtérkép: hét×nap rács, bináris (beosztva/nem) — lásd fenti komment: 30 nap, előző
  //    15 + következő 15 mához képest, NEM a lenti historikus periódus. ──
  const scheduledDateSet = new Set((scheduleRes.docs as Shift[]).map((d) => ymd(d.date)))
  const heatGrid: number[][] = Array.from({ length: 7 }, () => Array(scheduleWeeks).fill(-1))
  const heatDates: (string | null)[][] = Array.from({ length: 7 }, () => Array(scheduleWeeks).fill(null))
  const columnLabels: string[] = []
  for (let w = 0; w < scheduleWeeks; w++) {
    const weekStart = format(addDays(new Date(scheduleStartStr + 'T00:00:00'), w * 7), 'yyyy-MM-dd')
    columnLabels.push(format(new Date(weekStart + 'T00:00:00'), 'MMM d.', { locale: hu }))
    for (let dow = 0; dow < 7; dow++) {
      const date = format(addDays(new Date(weekStart + 'T00:00:00'), dow), 'yyyy-MM-dd')
      // Nincs kihagyás — a rács TELJES hetekre kerekítve, minden cella valódi nap (lásd fenti komment).
      heatGrid[dow][w] = scheduledDateSet.has(date) ? 1 : 0
      heatDates[dow][w] = date
    }
  }

  // ── Borravaló: napi KÖZPONTI összeg / az aznap dolgozó JOGOSULTAK száma, a periódusra összegezve
  //    (ugyanaz a képlet, mint a csapat-oldal `teamRoster.ts` havi nézete, csak tetszőleges
  //    időszakra általánosítva). ──
  let tipHuf: number | null = null
  if (membership?.tip_eligible) {
    const restaurant = await payload.findByID({ collection: 'restaurants', id: restaurantId, depth: 0, overrideAccess: true }).catch(() => null) as Restaurant | null
    const dailyTips: Record<string, number> = {}
    for (const t of restaurant?.daily_tips ?? []) {
      const d = (t.date ?? '').slice(0, 10)
      if (d && typeof t.amount === 'number') dailyTips[d] = t.amount
    }
    const tipDates = Object.keys(dailyTips).filter((d) => d >= periodStartStr && d <= periodEndStr)
    if (tipDates.length > 0) {
      const [eligibleMemRes, allShiftsRes] = await Promise.all([
        payload.find({
          collection: 'memberships',
          where: { and: [{ restaurant: { equals: restaurantId } }, { tip_eligible: { equals: true } }, { role: { not_equals: 'owner' } }] },
          limit: 200, depth: 0, overrideAccess: true,
        }),
        payload.find({
          collection: 'shifts',
          where: {
            and: [
              { restaurant: { equals: restaurantId } },
              { type: { equals: 'shift' } },
              { date: { greater_than_equal: periodStartStr } },
              { date: { less_than_equal: periodEndStr } },
            ],
          },
          limit: 5000, depth: 0, overrideAccess: true,
        }),
      ])
      const eligibleIds = new Set((eligibleMemRes.docs as Membership[]).map((m) => String(m.id)))
      const eligibleByDate: Record<string, Set<string>> = {}
      for (const sh of allShiftsRes.docs as Shift[]) {
        const pid = sh.member ? String(typeof sh.member === 'object' ? (sh.member as { id: string | number }).id : sh.member) : null
        if (!pid || !eligibleIds.has(pid)) continue
        const d = ymd(sh.date)
        ;(eligibleByDate[d] ??= new Set()).add(pid)
      }
      const myWorkDates = new Set(workShiftsInPeriod.map((d) => d.date))
      let sum = 0
      for (const d of tipDates) {
        if (!myWorkDates.has(d)) continue
        const amt = dailyTips[d]
        const cnt = eligibleByDate[d]?.size ?? 0
        if (amt && cnt > 0) sum += amt / cnt
      }
      tipHuf = Math.round(sum)
    } else {
      tipHuf = 0
    }
  }

  // ── Bér: csak ha be van állítva ráta. Napidíj → (ledolgozott + fizetett szabadság napok) ×
  //    ráta; órabér → (órák + szabadság napok×8) × ráta — lásd Memberships.ts `pay_type` mező
  //    kommentje, ez az első tényleges implementációja ennek a dokumentált képletnek. ──
  let wageHuf: number | null = null
  let payLabel: string | null = null
  if (membership?.pay_rate != null && membership.pay_rate > 0) {
    const rate = membership.pay_rate
    if (membership.pay_type === 'hourly') {
      wageHuf = Math.round((periodHours + vacationDays * 8) * rate)
      payLabel = `${rate.toLocaleString('hu-HU')} Ft/óra`
    } else {
      wageHuf = Math.round((workedDays + vacationDays) * rate)
      payLabel = `${rate.toLocaleString('hu-HU')} Ft/nap`
    }
  }

  return {
    period: rangeDays,
    periodHours,
    periodHoursDiff: pctDiff(periodHours, prevHours),
    workedDays,
    workedDaysDiff: pctDiff(workedDays, prevWorkedDays),
    prevWorkedDays,
    prevPeriodHours: prevHours,
    avgShiftHours,
    sickDays,
    leaveDays,
    upcomingShiftsCount: upcomingRes.totalDocs,
    upcomingShifts: (upcomingRes.docs as Shift[]).map((d) => ({
      date: ymd(d.date),
      label: format(new Date(ymd(d.date) + 'T00:00:00'), 'MMM d., EEEE', { locale: hu }),
      startTime: d.start_time ?? null,
      endTime: d.end_time ?? null,
    })),
    trend,
    byDayOfWeek,
    heatmap: { grid: heatGrid, dates: heatDates, columnLabels },
    tipHuf,
    wageHuf,
    payLabel,
  }
}
