/** A Statisztikák oldal (design 5.1–5.4) adatai — szalon és étterem közösen. A szerver (`statsView`) állítja elő. */

export type Share = { name: string; value: string; pct: number; lead?: string | null; img?: string | null }
export type DayBar = { d: string; v: number; peak?: boolean; closed?: boolean }
/** `weights`: az oszlopok szélessége arányosan (pl. a százalékok szerint); nélküle egyformák */
export type Strip = { cols: [string, string][]; blocks: { span: number; tone: 'hatch' | 'yellow' | 'dark' | 'off'; text: string }[]; weights?: number[] }

export interface StatsVM {
  restaurant: boolean
  /** ÉÉÉÉ-HH-NN */
  from: string
  to: string
  prevFrom: string
  prevTo: string
  days: number
  /** „Október 2. – November 1.” */
  label: string
  /** a fejléc csíkja: teljesített (étterem: megjelent) / függő / lemondva / no-show — %-ban */
  status: { done: number; pending: number; cancelled: number; noShow: number }
  kpis: { bookings: number; revenue: number; returningPct: number | null; guests: number; saturation: number | null }
  /** van-e egyáltalán foglalás az időszakban (üres állapot, 5.1.2) */
  empty: boolean

  week: { perWeek: number; days: DayBar[]; delta: number | null; byDay: { d: string; total: number; rows: { time: string; name: string; what: string; date: string }[] }[] }
  util: { pct: number | null; booked: number; open: number; delta: number | null; strip: Strip; parts: Share[]; staff: Share[] }
  hours: { hours: number[]; grid: number[][]; peak: string | null; created: Share[]; closedPct: number | null }
  source: { online: number; phone: number; walkIn: number; delta: number | null; leadDays: number | null; avgValue: number | null; cancelPct: number; tableTime: number | null }
  revenue: { total: number; delta: number | null; now: number[]; prev: number[]; ticks: string[]; points: string[]; parts: Share[] } | null
  /** étterem: a vendégszám (fő) alakulása — a szalon Bevétel-grafikonjának helyén, ugyanabban a formában */
  paxTrend: { total: number; delta: number | null; now: number[]; prev: number[]; ticks: string[]; points: string[]; parts: Share[] } | null
  top: { byCount: Share[]; byRevenue: Share[]; delta: number | null; pairs: { title: string; count: number }[] } | null
  noShow: { pct: number; count: number; deltaPt: number | null; repeat: { name: string; meta: string; count: number }[]; trend: { now: number[]; prev: number[]; ticks: string[]; points: string[] }; byDay: DayBar[]; bySource: Share[] }
  /** `trend`: az új vendégek (első látogatás) alakulása — most és az előző időszak */
  guests: { total: number; fresh: number; domestic: number; foreign: number; countries: Share[]; cities: Share[]; trend: { now: number[]; prev: number[]; ticks: string[]; points: string[] } }
  reviews: { avg: number | null; count: number; google: boolean; dist: number[]; fresh: number; delta: number | null; url: string | null }
  rest: {
    turns: number | null; tables: DayBar[]; tableTime: number | null; setTime: number; idle: number | null
    rooms: Share[]; avgParty: number | null; partyDelta: number | null; party: Strip
    partyRows: { title: string; meta: string; value: string; tone: 'yellow' | 'dark' | 'hatch' }[]
  } | null
}
