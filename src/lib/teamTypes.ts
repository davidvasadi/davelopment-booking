/** A Munkatársak oldal (design 10.x) adatai — szalon és étterem közösen. A szerver (`teamRoster`) állítja elő. */

export type TeamStatus = 'active' | 'invited' | 'suspended'

export interface TeamDoc { label: string; fileId: number | null; url: string | null }

export interface TeamMemberVM {
  /** szalon: staff id · étterem: membership id · a még nem linkelt tulaj: 'owner' (fiók-szintű mentés) */
  id: string
  owner: boolean
  name: string
  img: string | null
  position: string
  email: string
  phone: string
  /** ÉÉÉÉ-HH-NN */
  joinDate: string | null
  /** a „Szerep” oszlop felirata (Tulajdonos / Vezető / Munkatárs / egyedi szerep neve) */
  role: string
  roleKey: 'owner' | 'manager' | 'staff' | null
  customRoleId: string | null
  /** a belépési jog (meghívó) — szalonnál e-mail alapján párosítva; nélküle nincs szerep, nincs meghívó */
  membershipId: string | null
  status: TeamStatus
  /** importált, még át nem nézett (szalon) */
  review: boolean
  /** online foglalható (szalon) */
  bookable: boolean
  /** e heti beosztott órák */
  weekHours: number
  /** szerződés szerinti heti óra */
  weeklyTarget: number | null
  /** szalon: e heti foglalt idő a beosztott idő %-ában (nincs beosztás → null) */
  weekUtil: number | null
  serviceIds: string[]
  bio: string
  socialLinks: string[]
  birthday: string | null
  address: string | null
  taxId: string | null
  taxNumber: string | null
  payType: 'daily' | 'hourly'
  payRate: number | null
  tipEligible: boolean
  buffer: number | null
  /** alap napi szünet(ek) — a munkaidő mellett látszik (szalon) */
  breaks: { start: string; end: string }[]
  minLead: number | null
  documents: TeamDoc[]
  month: {
    bookings: number; revenue: number; noShow: number; tips: number
    hours: number; hoursPrev: number; daysWorked: number; sickDays: number; vacationDays: number; shifts: number
    /** e hónap heti órái (1.–5. hét) — a ledolgozott órák trendje */
    weeks: number[]
    /** e hónap napról napra gyűlő órái a mai napig; `trendPrev`: az előző hónap ugyanígy, végig */
    trend: number[]
    trendPrev: number[]
  }
  /** az év 12 hónapja — szalon: foglalások, étterem: ledolgozott órák */
  series: number[]
}

export interface TeamRoleOption { id: string; label: string; desc: string; builtin?: 'manager' | 'staff' }
