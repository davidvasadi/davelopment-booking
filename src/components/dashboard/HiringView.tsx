'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, animate, type Variants } from 'framer-motion'
import { MessageCircle, Phone, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown, Printer, PhoneCall, Search, SlidersHorizontal, X, Mail, Check, Pencil, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { popItem } from '@/lib/motion'

/** Felfüggesztett sávozott (hatch) minta — a lista sorával konzisztens. */
const SUSPEND_HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.6), rgba(255,255,255,.6) 7px, rgba(190,180,140,.16) 7px, rgba(190,180,140,.16) 14px)'

const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** CSAK a profilt nyomtatja: body-osztályt tesz fel (a print CSS e szerint mindent elrejt, kivéve a
 *  [data-print-root]-ot — a profil-kártyát), majd `afterprint`-nél leszedi. */
function printProfileNow() {
  document.body.classList.add('printing-profile')
  const cleanup = () => {
    document.body.classList.remove('printing-profile')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

type EditForm = {
  name: string; position: string; phone: string; birthday: string; address: string
  tax_id: string; emergency_contact: string; join_date: string; weekly_hours: string
  pay_type: 'daily' | 'hourly'; pay_rate: string; tip_eligible: boolean; bio: string
}
type HistEntry = { position: string; changed_at: string }

/** Adatlap SZERKESZTŐ-ŰRLAP (étterem-tag; tulaj/vezető). A bér csak akkor jelenik meg, ha `canEditSalary`. */
function ProfileEditForm({ initial, initialHistory, positionOptions = [], canEditSalary, isOwner = false, saving, onSave, onCancel }: {
  initial: EditForm; initialHistory: HistEntry[]; positionOptions?: string[]; canEditSalary: boolean; isOwner?: boolean; saving: boolean
  onSave: (form: EditForm, history: HistEntry[]) => void; onCancel: () => void
}) {
  const [f, setF] = useState<EditForm>(initial)
  const [history, setHistory] = useState<HistEntry[]>(initialHistory)
  const set = (k: keyof EditForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))
  const ic = 'h-11 w-full rounded-[12px] border border-line bg-[#EFEFEC] px-3 text-[14px] text-ink focus:outline-none focus:border-line-strong'
  const lc = 'mb-1 block text-[12px] font-semibold text-ink-soft'
  // Van kategória-készlet (étterem, owner-created) → válasszunk a MEGLÉVŐ pozíciókból; a jelenlegit is
  // felvesszük az opciók közé (hogy ne vesszen el, ha nincs a kategóriák közt). Készlet nélkül (szalon) marad a szabad szöveg.
  const hasCatalog = positionOptions.length > 0
  const posChoices = Array.from(new Set([...positionOptions, f.position].filter(Boolean)))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={lc}>Név</label><input value={f.name} onChange={set('name')} className={ic} /></div>
        {!isOwner && (
          <div>
            <label className={lc}>Pozíció (munkakör)</label>
            {hasCatalog ? (
              <div className="relative">
                <select value={f.position} onChange={set('position')} className={`${ic} cursor-pointer appearance-none pr-9`}>
                  {f.position === '' && <option value="">Válassz pozíciót…</option>}
                  {posChoices.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft2" strokeWidth={1.7} />
              </div>
            ) : (
              <input value={f.position} onChange={set('position')} placeholder="Felszolgáló…" className={ic} />
            )}
          </div>
        )}
        <div><label className={lc}>Telefon</label><input value={f.phone} onChange={set('phone')} className={ic} /></div>
        <div><label className={lc}>Születésnap</label><input type="date" value={f.birthday} onChange={set('birthday')} className={ic} /></div>
        <div><label className={lc}>Belépés</label><input type="date" value={f.join_date} onChange={set('join_date')} className={ic} /></div>
        <div><label className={lc}>Cím</label><input value={f.address} onChange={set('address')} className={ic} /></div>
        <div><label className={lc}>TAJ / adóazonosító</label><input value={f.tax_id} onChange={set('tax_id')} className={ic} /></div>
        <div><label className={lc}>Vészhelyzeti kontakt</label><input value={f.emergency_contact} onChange={set('emergency_contact')} className={ic} /></div>
        {canEditSalary && !isOwner && (
          <div className="sm:col-span-2">
            <label className={lc}>Bér <Lock className="inline h-3 w-3 align-[-1px]" strokeWidth={1.8} /> (a fizetés a naptárból számolódik)</label>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-[12px] bg-[#E4E4E1] p-0.5">
                {(['daily', 'hourly'] as const).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, pay_type: pt }))}
                    className="rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors"
                    style={f.pay_type === pt ? { background: '#1D1C19', color: '#fff' } : { color: '#5C5848' }}
                  >
                    {pt === 'daily' ? 'Napidíj' : 'Órabér'}
                  </button>
                ))}
              </div>
              <input type="number" value={f.pay_rate} onChange={set('pay_rate')} placeholder={f.pay_type === 'daily' ? 'Ft / nap' : 'Ft / óra'} className={`${ic} min-w-[120px] flex-1`} />
            </div>
          </div>
        )}
        {canEditSalary && !isOwner && (
          <div className="sm:col-span-2">
            <button type="button" onClick={() => setF((p) => ({ ...p, tip_eligible: !p.tip_eligible }))} className="flex items-center gap-2.5">
              <span className={`flex h-[22px] w-[38px] items-center rounded-full px-0.5 transition-colors ${f.tip_eligible ? 'justify-end bg-ink-dark' : 'justify-start bg-line-strong'}`}>
                <span className="h-[18px] w-[18px] rounded-full bg-white" />
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">Borravalóra jogosult <Lock className="h-3 w-3 text-ink-soft2" strokeWidth={1.8} /></span>
            </button>
            <p className="mt-1 text-[11px] text-ink-soft2">A napi borravaló-összeget a Naptárban adod meg; elosztódik az aznap dolgozó jogosultak közt.</p>
          </div>
        )}
      </div>
      <div><label className={lc}>Megjegyzés / bemutatkozás</label><textarea value={f.bio} onChange={set('bio')} rows={3} className="w-full rounded-[12px] border border-line bg-[#EFEFEC] px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-line-strong" /></div>
      {!isOwner && history.length > 0 && (
        <div>
          <label className={lc}>Pozíció-előzmény</label>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[12.5px] text-ink-soft">
                {h.position} · {fmtDate(h.changed_at)}
                <button type="button" onClick={() => setHistory((prev) => prev.filter((_, j) => j !== i))} className="text-ink-soft2 hover:text-[#C0453F]"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-soft2">Elírás? Töröld a rossz bejegyzést. Pozíció-váltáskor automatikusan új bejegyzés készül.</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={saving} onClick={() => onSave(f, history)} className="h-11 flex-1 rounded-dav-pill bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50">{saving ? 'Mentés…' : 'Mentés'}</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-dav-pill border border-line px-5 text-[14px] font-medium text-ink-soft">Mégse</button>
      </div>
    </div>
  )
}

/**
 * MUNKAVÁLLALÓK aloldal — Crextio „Hiring" design, de a tartalom NEM CV/toborzás, hanem a
 * MEGLÉVŐ csapat: ki milyen SZEREPET tölt be az étteremben (tulajdonos/manager/munkatárs),
 * milyen POZÍCIÓ (Séf, Pincér…), hány NAPOT dolgozott, hányszor volt BETEG / SZABADSÁGON,
 * plusz elérhetőség (email, telefon). A fő grafikon MINDIG az előző időszakhoz hasonlít
 * (aktuális hét vs. előző hét ledolgozott órái). Kiválasztáskor a jobb oldali adatlap
 * újra-animálódik (a diagramok újrarajzolódnak).
 *
 * Az adat MOCK (fallback), hogy a dizájn azonnal tesztelhető legyen. A fejléc `currentUser`-t is
 * kaphat (bejelentkezett felhasználó neve/avatarja/emailje) — Google OAuth élesítéskor onnan jön.
 * A nyomtatás ikon szándékosan nincs bekötve (a user szerint majd külön átbeszéljük).
 */

type Variant = 'salon' | 'restaurant'
type RoleTone = 'owner' | 'manager' | 'staff'

export interface CurrentUser {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

export interface Employee {
  id: string
  name: string
  avatarUrl?: string | null  // valós profilkép (media URL / Google avatar); null → monogram
  position: string           // pozíció az üzletben (Séf, Pincér, Fodrász…)
  roleTone: RoleTone         // szerep: tulajdonos / manager / munkatárs
  status?: 'active' | 'invited' | 'suspended' // tagság-státusz (étterem); a profilban állítható
  // Nyers, SZERKESZTHETŐ HR-adatok (étterem-tag) — az adatlap szerkesztő-módja ezekkel dolgozik.
  hr?: {
    birthday?: string | null
    address?: string | null
    tax_id?: string | null
    emergency_contact?: string | null
    weekly_hours?: number | null
    join_date?: string | null
    salary?: number | null
    pay_type?: 'daily' | 'hourly' | null
    pay_rate?: number | null
    tip_eligible?: boolean | null
    suspended_at?: string | null
    position_history?: { position: string; changed_at: string }[]
  }
  email: string
  phone: string
  since: string              // belépés dátuma
  contract: string           // foglalkoztatás típusa
  tags: string[]             // állomások / specializáció
  note: string               // rövid, üzleti megjegyzés (NEM CV)
  // — havi statisztikák —
  attendance: number         // jelenlét % (0–100)
  daysWorked: number         // ledolgozott napok
  vacationDays: number       // szabadság (nap)
  sickDays: number           // betegszabadság (nap)
  shifts: number             // műszakok száma
  hoursThisMonth: number     // havi órák
  hoursLastMonth: number     // előző havi órák (összehasonlításhoz)
  tipsThisMonth?: number     // havi borravaló (Ft) — a napi központi összegből, jogosultak közt elosztva
  // — heti grafikon (napi ledolgozott órák) —
  recent: number[]           // aktuális hét (H…V)
  previous: number[]         // előző hét ugyanezen napjai
  monthWeeks?: number[]      // e hónap heti óra-összegei (1.-5. hét)
  prevMonthWeeks?: number[]  // előző hónap heti óra-összegei
  calendar?: Record<string, 'shift' | 'leave' | 'sick' | 'vacation'> // dátum→típus (VALÓS havi naptárhoz)
  weeklyHours?: number       // e heti VALÓS órák (a naptárból számolva)
  onVacation?: boolean       // ma szabadságon/leave van-e → profil-jelző
}

const GRADS = [
  'linear-gradient(140deg,#EEBE8A,#DF9F61)',
  'linear-gradient(140deg,#B4C49A,#9DB07E)',
  'linear-gradient(140deg,#D2A6BE,#BE89A6)',
  'linear-gradient(140deg,#9FBAD1,#7E9EBE)',
]
const monogram = (n: string) => {
  const p = n.trim().split(/\s+/)
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
const WEEK = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const EASE = [0.22, 1, 0.36, 1] as const

const ROLE_LABEL: Record<RoleTone, string> = { owner: 'Tulajdonos', manager: 'Vezető', staff: 'Dolgozó' }
const ROLE_TONE: Record<RoleTone, { bg: string; fg: string }> = {
  owner: { bg: '#1D1C19', fg: '#ffffff' },
  manager: { bg: 'var(--dav-accent)', fg: '#1D1C19' },
  staff: { bg: '#EDE7DC', fg: '#57564f' },
}

const TAG_TONE: Record<string, { bg: string; fg: string }> = {
  a: { bg: '#EDE7FF', fg: '#5B4BC4' },
  b: { bg: '#FDE5D8', fg: '#C56A2C' },
  c: { bg: '#DDEBF9', fg: '#2C6BB0' },
  d: { bg: '#E3F0D8', fg: '#4A7A2A' },
}
const TAG_KEYS = ['a', 'b', 'c', 'd'] as const

/* ── Animáció-variánsok ─────────────────────────────────────────────────── */
const detailCol: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.07, delayChildren: 0.03, duration: 0.3 } },
}
const detailItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
}
const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}
const listItem: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 500, damping: 34 } },
}

/* ── Szám-felszámláló (count-up) ── */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const controls = animate(0, to, { duration: 0.9, ease: EASE, onUpdate: (v) => setN(v) })
    return () => controls.stop()
  }, [to])
  return <>{Math.round(n).toLocaleString('hu-HU')}</>
}

function mockData(variant: Variant): Employee[] {
  const restaurant: Employee[] = [
    {
      id: 'r1', name: 'Tóth Réka', position: 'Üzletvezető', roleTone: 'owner',
      email: 'toth.reka@example.com', phone: '+36 30 444 5566',
      since: '2019. márc.', contract: 'Teljes munkaidő',
      tags: ['Terem', 'Beszerzés', 'Ütemezés'],
      note: 'Napi műszak-szervezés, beszerzés és a csapat összehangolása.',
      attendance: 98, daysWorked: 22, vacationDays: 1, sickDays: 0, shifts: 24, hoursThisMonth: 176, hoursLastMonth: 168,
      recent: [8, 8, 9, 8, 8, 6, 0], previous: [8, 8, 8, 8, 9, 6, 0],
    },
    {
      id: 'r2', name: 'Molnár Dóra', position: 'Séf', roleTone: 'manager',
      email: 'molnar.dora@example.com', phone: '+36 30 111 2233',
      since: '2020. szept.', contract: 'Teljes munkaidő',
      tags: ['Konyha', 'Á la carte', 'HACCP'],
      note: 'Konyhavezetés, napi étlap és a konyhai csapat irányítása.',
      attendance: 95, daysWorked: 21, vacationDays: 2, sickDays: 1, shifts: 21, hoursThisMonth: 172, hoursLastMonth: 180,
      recent: [9, 9, 8, 10, 9, 7, 0], previous: [8, 9, 8, 9, 8, 8, 0],
    },
    {
      id: 'r3', name: 'Fekete Ádám', position: 'Pincér', roleTone: 'staff',
      email: 'fekete.adam@example.com', phone: '+36 30 222 3344',
      since: '2022. jún.', contract: 'Teljes munkaidő',
      tags: ['Terem', 'Bár', 'Felszolgálás'],
      note: 'Terem és bár, csúcsidőben is stabil vendégkezelés.',
      attendance: 91, daysWorked: 19, vacationDays: 0, sickDays: 2, shifts: 20, hoursThisMonth: 152, hoursLastMonth: 148,
      recent: [6, 8, 8, 0, 9, 10, 8], previous: [7, 7, 8, 0, 8, 9, 7],
    },
    {
      id: 'r4', name: 'Nagy Bence', position: 'Sommelier', roleTone: 'staff',
      email: 'nagy.bence@example.com', phone: '+36 30 333 4455',
      since: '2021. nov.', contract: 'Részmunkaidő',
      tags: ['Bár', 'Borlap', 'Tanácsadás'],
      note: 'Borpárosítás és a prémium tételek értékesítése esti műszakban.',
      attendance: 88, daysWorked: 14, vacationDays: 3, sickDays: 0, shifts: 15, hoursThisMonth: 96, hoursLastMonth: 104,
      recent: [0, 5, 6, 5, 7, 8, 6], previous: [0, 4, 5, 5, 6, 7, 6],
    },
  ]
  const salon: Employee[] = [
    {
      id: 's1', name: 'Vass Nóra', position: 'Szalonvezető', roleTone: 'owner',
      email: 'vass.nora@example.com', phone: '+36 30 444 5566',
      since: '2018. jan.', contract: 'Teljes munkaidő',
      tags: ['Vezetés', 'Ügyfélkezelés', 'Ütemezés'],
      note: 'Napi működés, beosztás-szervezés és a csapat motiválása.',
      attendance: 98, daysWorked: 22, vacationDays: 1, sickDays: 0, shifts: 22, hoursThisMonth: 176, hoursLastMonth: 170,
      recent: [8, 8, 9, 8, 8, 6, 0], previous: [8, 8, 8, 8, 9, 6, 0],
    },
    {
      id: 's2', name: 'Katona Fanni', position: 'Senior fodrász', roleTone: 'manager',
      email: 'katona.fanni@example.com', phone: '+36 30 111 2233',
      since: '2019. ápr.', contract: 'Teljes munkaidő',
      tags: ['Szín', 'Balayage', 'Konzultáció'],
      note: 'Színspecializáció és a junior kollégák mentorálása.',
      attendance: 95, daysWorked: 21, vacationDays: 2, sickDays: 1, shifts: 21, hoursThisMonth: 168, hoursLastMonth: 176,
      recent: [9, 9, 8, 10, 9, 7, 0], previous: [8, 9, 8, 9, 8, 8, 0],
    },
    {
      id: 's3', name: 'Kis Márton', position: 'Barber', roleTone: 'staff',
      email: 'kis.marton@example.com', phone: '+36 30 333 4455',
      since: '2021. szept.', contract: 'Teljes munkaidő',
      tags: ['Fade', 'Szakáll', 'Borotválás'],
      note: 'Klasszikus férfi fazonok, stabil visszatérő vendégkör.',
      attendance: 92, daysWorked: 20, vacationDays: 0, sickDays: 1, shifts: 20, hoursThisMonth: 160, hoursLastMonth: 156,
      recent: [6, 8, 8, 0, 9, 10, 8], previous: [7, 7, 8, 0, 8, 9, 7],
    },
    {
      id: 's4', name: 'Rácz Petra', position: 'Junior fodrász', roleTone: 'staff',
      email: 'racz.petra@example.com', phone: '+36 30 222 3344',
      since: '2023. febr.', contract: 'Részmunkaidő',
      tags: ['Vágás', 'Styling', 'Melír'],
      note: 'Gyorsan fejlődő csapattag, precíz kézimunkával.',
      attendance: 88, daysWorked: 15, vacationDays: 3, sickDays: 0, shifts: 15, hoursThisMonth: 104, hoursLastMonth: 112,
      recent: [0, 5, 6, 5, 7, 8, 6], previous: [0, 4, 5, 5, 6, 7, 6],
    },
  ]
  return variant === 'restaurant' ? restaurant : salon
}

/* ── Radiál mérő (jelenlét %) — animált ív + count-up ── */
function RadialGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.min(1, value / 100)
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(120,110,70,.14)" strokeWidth="14" />
        <motion.circle
          cx="65" cy="65" r={r} fill="none" stroke="var(--dav-accent)" strokeWidth="14" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink"><CountUp to={value} /><span className="text-[18px]">%</span></span>
        <span className="mt-1 text-[11px] font-medium text-ink-soft">{label}</span>
      </div>
    </div>
  )
}

/* ── Sparkline (havi órák trend) — animált rajz ── */
/** Sima (Catmull-Rom → cubic Bézier) görbe a pontokon — a referencia így rajzol (nem törtvonal).
 *  A kontrollpontok y-ját a pontok y-tartományába SZORÍTJUK → a görbe nem lő túl (nem lóg ki a plotból). */
function smoothPath(pts: readonly (readonly [number, number])[], tension = 0.16): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  const ys = pts.map((p) => p[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y))
  const d = [`M${pts[0][0]},${pts[0][1]}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) * tension
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) * tension)
    const c2x = p2[0] - (p3[0] - p1[0]) * tension
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) * tension)
    d.push(`C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`)
  }
  return d.join(' ')
}

function Spark({ data, stroke = '#1D1C19' }: { data: number[]; stroke?: string }) {
  const w = 240, h = 60, max = Math.max(...data), min = Math.min(...data)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4
    return [x, y] as const
  })
  const d = smoothPath(pts)
  return (
    <div
      className="relative"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const frac = (e.clientX - rect.left) / rect.width
        setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))))
      }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[60px] w-full" preserveAspectRatio="none">
        <motion.path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }} />
      </svg>
      {hoverIdx != null && (() => {
        const pt = pts[hoverIdx]
        const leftPct = (pt[0] / w) * 100
        return (
          <>
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100" style={{ left: `${leftPct}%`, top: `${(pt[1] / h) * 100}%`, width: 9, height: 9, background: stroke, border: '2px solid rgba(255,255,255,.7)' }} />
            <div className="pointer-events-none absolute transition-all duration-100" style={{ left: `${Math.max(12, Math.min(88, leftPct))}%`, top: `${(pt[1] / h) * 100}%`, transform: 'translate(-50%, calc(-100% - 10px))' }}>
              <span className="whitespace-nowrap rounded-full bg-ink-dark px-2 py-0.5 text-[10px] font-semibold text-white shadow-dav-card">{data[hoverIdx].toLocaleString('hu-HU')} ó</span>
            </div>
          </>
        )
      })()}
    </div>
  )
}

/* ── Munkaidő diagram: AKTUÁLIS hét vs ELŐZŐ hét (napi órák, min 0) — animált (terület + rajz + pontok) ── */
function WorkChart({ recent, previous, labels = WEEK }: { recent: number[]; previous: number[]; labels?: string[] }) {
  const w = 620, h = 200, pad = 10
  const maxVal = Math.max(...recent)
  const top = Math.max(2, Math.ceil(Math.max(...recent, ...previous, 1)))
  const xy = (arr: number[]) => arr.map((v, i) => {
    const x = pad + (i / (arr.length - 1)) * (w - pad * 2)
    const y = pad + (1 - v / top) * (h - pad * 2)
    return [x, y] as const
  })
  const line = (arr: number[]) => smoothPath(xy(arr))
  const rp = xy(recent)
  const hasData = maxVal > 0
  const peakIdx = hasData ? recent.indexOf(maxVal) : -1
  const hi = peakIdx >= 0 ? rp[peakIdx] : null
  const ticks = [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0]
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => pad + f * (h - pad * 2))
  // A pontokat/buborékot NEM az SVG-ben rajzoljuk (a preserveAspectRatio=none torzítaná a köröket),
  // hanem HTML-overlayként %-pozícióval → mindig tökéletes kör, szélességtől függetlenül.
  const posOf = (p: readonly [number, number]) => ({ left: `${(p[0] / w) * 100}%`, top: `${(p[1] / h) * 100}%` })
  const pp = xy(previous)
  // Hover: a kurzorhoz legközelebbi napra „ráakad" a jelölő + buborék (e hó vs. előző hó érték).
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const showPeak = hi && hoverIdx === null
  return (
    <div className="flex">
      {/* y-tengely (óra) */}
      <div className="hv-chart-h flex h-[200px] flex-col justify-between pr-2 text-[11px] text-ink-soft2">
        {ticks.map((v, i) => <span key={i}>{v}ó</span>)}
      </div>
      {/* chart-terület */}
      <div className="min-w-0 flex-1">
        <div
          className="hv-chart-h relative h-[200px]"
          onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const svgX = ((e.clientX - rect.left) / rect.width) * w
          const frac = (svgX - pad) / (w - pad * 2)
          setHoverIdx(Math.max(0, Math.min(recent.length - 1, Math.round(frac * (recent.length - 1)))))
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
          <svg viewBox={`0 0 ${w} ${h}`} className="hv-chart-h h-[200px] w-full" preserveAspectRatio="none">
            {/* halvány rács */}
            {gridYs.map((y, i) => (
              <motion.line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke="rgba(120,110,70,.10)" strokeWidth="1" vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }} />
            ))}
            {/* előző hét — sima, szaggatott (referencia: #c7c3b6, 2px, 5-5) */}
            <motion.path d={line(previous)} fill="none" stroke="#C7C3B6" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} />
            {/* aktuális hét — kirajzolódó SIMA vonal (referencia: arany, 2.6px) */}
            <motion.path d={line(recent)} fill="none" stroke="var(--dav-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE }} />
            {/* csúcsnap függőleges jelölő (csak ha van adat) */}
            {showPeak && (
              <motion.line x1={hi[0]} y1={hi[1]} x2={hi[0]} y2={h - pad} stroke="#1D1C19" strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.3 }} />
            )}
          </svg>

          {/* CSAK a csúcs-pont — HTML overlay (referencia: arany, sötét kerettel; tökéletes kör) */}
          {showPeak && (
            <motion.div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ ...posOf(hi), width: 11, height: 11, background: 'var(--dav-accent)', border: '2px solid #1D1C19' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.05, type: 'spring', stiffness: 440, damping: 18 }}
            />
          )}

          {/* csúcsnap buborék — bekorlátozva (nem lóg ki oldalt; a tető közelében alá kerül) */}
          {showPeak && (() => {
            const leftPct = Math.max(15, Math.min(85, (hi[0] / w) * 100))
            const topPct = (hi[1] / h) * 100
            const below = topPct < 20
            return (
              <motion.div className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${leftPct}%`, top: `${topPct}%`, marginTop: below ? 14 : -34 }}
                initial={{ opacity: 0, y: below ? -6 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.25 }}>
                <span className="whitespace-nowrap rounded-full bg-ink-dark px-2.5 py-1 text-[11px] font-semibold text-white">{recent[peakIdx].toLocaleString('hu-HU')} óra</span>
              </motion.div>
            )
          })()}

          {/* HOVER: függőleges kereszt + pont mindkét vonalon + összehasonlító buborék */}
          {hoverIdx != null && (() => {
            const cur = rp[hoverIdx]
            const prev = pp[hoverIdx]
            const leftPct = (cur[0] / w) * 100
            const tipLeft = Math.max(14, Math.min(86, leftPct))
            const below = (cur[1] / h) * 100 < 26
            return (
              <>
                <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-[rgba(29,28,25,.22)] transition-all duration-100" style={{ left: `${leftPct}%` }} />
                <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100" style={{ ...posOf(prev), width: 8, height: 8, background: '#C7C3B6', border: '2px solid #fff' }} />
                <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100" style={{ ...posOf(cur), width: 11, height: 11, background: 'var(--dav-accent)', border: '2px solid #1D1C19' }} />
                <div
                  className="pointer-events-none absolute -translate-x-1/2 transition-all duration-100"
                  style={{ left: `${tipLeft}%`, top: `${(cur[1] / h) * 100}%`, transform: below ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 14px))' }}
                >
                  <div className="whitespace-nowrap rounded-[12px] bg-ink-dark px-3 py-2 text-[10.5px] leading-tight text-white shadow-dav-container">
                    <div className="mb-1 font-semibold text-white/90">{labels[hoverIdx]}</div>
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold" />E hó: <b className="font-semibold">{recent[hoverIdx].toLocaleString('hu-HU')} ó</b></div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-[#C7C3B6]" />Előző: {previous[hoverIdx].toLocaleString('hu-HU')} ó</div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft2">
          {labels.map((d) => <span key={d}>{d}</span>)}
        </div>
      </div>
    </div>
  )
}

/* ── Mini havi naptár: VALÓS napok a shift-ekből (dátum→típus), hónapra vissza/előre léptethető ── */
const CAL_WEEK = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']
const pad2 = (n: number) => String(n).padStart(2, '0')
const DAY_STYLE: Record<string, { bg: string; color: string }> = {
  shift: { bg: 'var(--dav-accent)', color: '#1D1C19' },
  vacation: { bg: '#D9EAD3', color: '#3B6B4B' },
  leave: { bg: '#D9EAD3', color: '#3B6B4B' },
  sick: { bg: '#F3D9D6', color: '#B0453F' },
}
function MiniCalendar({ calendar }: { calendar: Record<string, 'shift' | 'leave' | 'sick' | 'vacation'> }) {
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const first = new Date(view.y, view.m, 1)
  const firstWeekday = (first.getDay() + 6) % 7 // hétfő = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const keyOf = (d: number) => `${view.y}-${pad2(view.m + 1)}-${pad2(d)}`
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const workedDays = Array.from({ length: daysInMonth }, (_, i) => calendar[keyOf(i + 1)] === 'shift').filter(Boolean).length
  const step = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const monthLabel = first.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
  return (
    <div data-print-card className="rounded-[22px] border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-ink">Naptár</p>
        <div className="flex items-center gap-1 print:hidden">
          <button type="button" onClick={() => step(-1)} aria-label="Előző hónap" className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[104px] text-center text-[12.5px] font-semibold text-ink">{monthLabel}</span>
          <button type="button" onClick={() => step(1)} aria-label="Következő hónap" className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {CAL_WEEK.map((d) => (
          <div key={d} className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft2">{d}</div>
        ))}
        {cells.map((c, i) => {
          if (c === null) return <div key={`b${i}`} />
          const t = calendar[keyOf(c)]
          const st = t ? DAY_STYLE[t] : { bg: '#F5F3EC', color: '#B7B2A4' }
          return (
            <motion.div
              key={`${view.y}-${view.m}-${c}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.02 + i * 0.008, type: 'spring', stiffness: 500, damping: 26 }}
              className="flex aspect-square items-center justify-center rounded-[9px] text-[11.5px] font-semibold"
              style={{ background: st.bg, color: st.color }}
            >
              {c}
            </motion.div>
          )
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: 'var(--dav-accent)' }} />Ledolgozott ({workedDays})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: '#D9EAD3' }} />Szabadság</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: '#F3D9D6' }} />Beteg</span>
      </div>
    </div>
  )
}

// A bal-lista lapozója: hány munkatárs egy oldalon. Lapozó CSAK akkor jelenik meg, ha ennél többen vannak.
const LIST_PER_PAGE = 8
// Valós oldalszám-ablak (ellipszissel), a lista méretéhez igazítva.
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, '…', total]
  if (current >= total - 2) return [1, '…', total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

export function HiringView({ variant, employees, positionOptions = [], currentUser = null, canManage = false, canEditSalary = false, statusById, onStatusChange, onProfileChange, onClose, initialIndex = 0 }: { variant: Variant; employees?: Employee[]; positionOptions?: { label: string; level: 'lead' | 'staff' }[]; currentUser?: CurrentUser | null; canManage?: boolean; canEditSalary?: boolean; statusById?: Record<string, 'active' | 'invited' | 'suspended'>; onStatusChange?: (id: string, status: 'active' | 'suspended') => void; onProfileChange?: (id: string, patch: Partial<Employee>) => void; onClose?: () => void; initialIndex?: number }) {
  // Valós adat, ha kaptunk (akár üres listát is tiszteletben tartunk); különben mock-fallback.
  const data = employees ?? mockData(variant)
  const startId = data.length ? (data[Math.min(Math.max(initialIndex, 0), data.length - 1)]?.id ?? data[0].id) : ''
  const [selId, setSelId] = useState(startId)
  // A megnyitott személy oldalán kezdünk (hogy a listában is ki legyen jelölve).
  const [page, setPage] = useState(() => Math.floor(Math.max(0, initialIndex) / LIST_PER_PAGE) + 1)
  const [query, setQuery] = useState('')
  const [posFilter, setPosFilter] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusOverride, setStatusOverride] = useState<Record<string, 'active' | 'suspended'>>({})
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedOverride, setSavedOverride] = useState<Record<string, Partial<Employee>>>({})

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-[15px] text-ink-soft">Még nincs munkatárs ennél az üzletnél.</p>
        {onClose && (
          <button onClick={onClose} className="rounded-dav-pill bg-ink-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink">Bezárás</button>
        )}
      </div>
    )
  }

  const positions = Array.from(new Set(data.map((d) => d.position)))
  // A profil-szerkesztőben választható pozíciók = az üzlet által létrehozott kategóriák (owner-created).
  const positionCatalog = Array.from(new Set(positionOptions.map((p) => p.label).filter(Boolean)))
  const sel = data.find((c) => c.id === selId) ?? data[0]
  const isOwnerRow = sel.id === 'owner' || sel.roleTone === 'owner'
  // Státusz a profilban — csak étterem + kezelő (tulaj/vezető) + valós tag (nem a tulaj-sor).
  const canEditStatus = canManage && variant === 'restaurant' && !isOwnerRow
  // Élő státusz: a lista (statusById) a forrás; a helyi override az azonnali visszajelzés; végül a roster-érték.
  const effStatus: 'active' | 'invited' | 'suspended' = statusOverride[sel.id] ?? statusById?.[sel.id] ?? sel.status ?? 'active'
  const changeStatus = async (status: 'active' | 'suspended') => {
    setStatusMenuOpen(false)
    if (!canEditStatus || effStatus === status) return
    setStatusBusy(true)
    try {
      const res = await fetch(`/api/team/members/${sel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setStatusOverride((prev) => ({ ...prev, [sel.id]: status }))
      // A felfüggesztés napja azonnal látsszon az adatlapon is (nem csak reload után).
      const today = new Date().toISOString().slice(0, 10)
      setSavedOverride((prev) => ({
        ...prev,
        [sel.id]: { ...prev[sel.id], hr: { ...(prev[sel.id]?.hr ?? sel.hr), suspended_at: status === 'suspended' ? today : null } },
      }))
      onStatusChange?.(sel.id, status) // a lista azonnal frissüljön (nem kell oldal-reload)
      toast.success(status === 'suspended' ? 'Felfüggesztve' : 'Visszaállítva aktívra')
    } catch {
      toast.error('A státusz módosítása sikertelen')
    } finally {
      setStatusBusy(false)
    }
  }

  // Profil-szerkesztés: a mentett override AZONNAL látszik az overlayen (nem kell reload).
  const savedP = savedOverride[sel.id]
  const eff: Employee = savedP ? { ...sel, ...savedP, hr: { ...sel.hr, ...savedP.hr } } : sel
  // Fizetés a NAPTÁRBÓL: napidíj → (ledolgozott + fiz. szabadság napok) × rate; órabér → (órák + szabadság×8) × rate.
  const payType: 'daily' | 'hourly' = eff.hr?.pay_type ?? 'daily'
  const payRate = eff.hr?.pay_rate ?? 0
  const payVacHours = eff.vacationDays * 8
  const payTotal = payType === 'daily' ? (eff.daysWorked + eff.vacationDays) * payRate : (eff.hoursThisMonth + payVacHours) * payRate
  // A TULAJ saját adatlapját csak a tulaj (canEditSalary) szerkesztheti; a többi tagét tulaj/vezető.
  const canEditProfile = variant === 'restaurant' && (isOwnerRow ? canEditSalary : canEditStatus)
  const saveProfile = async (form: EditForm, history: HistEntry[]) => {
    setSavingProfile(true)
    try {
      // ── A TULAJ saját adatlapja: FIÓK-szintre mentünk (nincs membership) — bér/pozíció/előzmény nélkül. ──
      if (isOwnerRow) {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone,
            birthday: form.birthday || null,
            join_date: form.join_date || null,
            address: form.address,
            tax_id: form.tax_id,
            emergency_contact: form.emergency_contact,
            weekly_hours: form.weekly_hours === '' ? null : Number(form.weekly_hours),
            bio: form.bio,
          }),
        })
        if (!res.ok) throw new Error()
        const patch: Partial<Employee> = {
          name: form.name.trim(),
          phone: form.phone,
          note: form.bio,
          hr: {
            ...eff.hr,
            birthday: form.birthday || null,
            join_date: form.join_date || null,
            address: form.address,
            tax_id: form.tax_id,
            emergency_contact: form.emergency_contact,
            weekly_hours: form.weekly_hours === '' ? null : Number(form.weekly_hours),
          },
        }
        setSavedOverride((prev) => ({ ...prev, [sel.id]: patch }))
        onProfileChange?.(sel.id, patch)
        setEditing(false)
        toast.success('Mentve')
        return
      }
      const trimmedPos = form.position.trim()
      // A pozíciót CSAK akkor küldjük (és naplózzuk), ha VALÓBAN változott. Így a megjelenített
      // szerep-fallback (üres pozíciónál 'Dolgozó'/'Vezető') nem íródik be valós pozícióként, és
      // nem keletkezik fantom előzmény-bejegyzés (a szerver ugyanígy a TÁROLT értékhez hasonlít).
      const posChanged = trimmedPos !== (eff.position ?? '').trim() && trimmedPos !== ''
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        ...(posChanged ? { position: trimmedPos } : {}),
        phone: form.phone,
        birthday: form.birthday || null,
        join_date: form.join_date || null,
        address: form.address,
        tax_id: form.tax_id,
        emergency_contact: form.emergency_contact,
        weekly_hours: form.weekly_hours === '' ? null : Number(form.weekly_hours),
        bio: form.bio,
        position_history: history,
        ...(canEditSalary ? { pay_type: form.pay_type, pay_rate: form.pay_rate === '' ? null : Number(form.pay_rate), tip_eligible: form.tip_eligible } : {}),
      }
      const res = await fetch(`/api/team/members/${sel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      // A szerver a pozíció-VÁLTÁSKOR auto-naplóz → tükrözzük helyben is (ugyanaz a posChanged).
      const newHistory = posChanged ? [...history, { position: trimmedPos, changed_at: new Date().toISOString().slice(0, 10) }] : history
      const patch: Partial<Employee> = {
        name: form.name.trim(),
        position: posChanged ? trimmedPos : eff.position,
        phone: form.phone,
        note: form.bio,
        hr: {
          birthday: form.birthday || null,
          join_date: form.join_date || null,
          address: form.address,
          tax_id: form.tax_id,
          emergency_contact: form.emergency_contact,
          weekly_hours: form.weekly_hours === '' ? null : Number(form.weekly_hours),
          pay_type: canEditSalary ? form.pay_type : eff.hr?.pay_type,
          pay_rate: canEditSalary ? (form.pay_rate === '' ? null : Number(form.pay_rate)) : eff.hr?.pay_rate,
          tip_eligible: canEditSalary ? form.tip_eligible : eff.hr?.tip_eligible,
          suspended_at: eff.hr?.suspended_at,
          position_history: newHistory,
        },
      }
      setSavedOverride((prev) => ({ ...prev, [sel.id]: patch }))
      onProfileChange?.(sel.id, patch)
      setEditing(false)
      toast.success('Mentve')
    } catch {
      toast.error('A mentés sikertelen')
    } finally {
      setSavingProfile(false)
    }
  }

  const filtered = data.filter((c) => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q)
    const matchPos = posFilter === 'all' || c.position === posFilter
    return matchQ && matchPos
  })
  // VALÓS lapozás: a szűrt listát vágjuk oldalakra; a lapozó csak akkor jelenik meg, ha 1-nél több oldal van.
  const pageCount = Math.max(1, Math.ceil(filtered.length / LIST_PER_PAGE))
  const curPage = Math.min(page, pageCount)
  const paged = filtered.slice((curPage - 1) * LIST_PER_PAGE, curPage * LIST_PER_PAGE)

  // A fejléc a bejelentkezett felhasználó adatával felülírható (Google OAuth élesítéskor); fallback a mock tag.
  const headName = currentUser?.name ?? eff.name
  const headAvatar = currentUser?.avatarUrl ?? sel.avatarUrl ?? null
  const headEmail = currentUser?.email ?? eff.email

  const hoursDelta = sel.hoursThisMonth - sel.hoursLastMonth
  const role = ROLE_TONE[sel.roleTone]

  // Havi napok szélesség-aránya a pillekhez: ARÁNYOS, de TOMPÍTOTT (fél-egyenlő + fél-arányos),
  // hogy a nagy „Ledolgozott" pill ne nyomja agyon a másik kettőt — különben a rövid pilleken
  // levágódik a felirat. A megjelenített szám továbbra is a valós érték.
  const dayVals = [sel.daysWorked, sel.vacationDays, sel.sickDays]
  const daySum = dayVals.reduce((a, b) => a + b, 0) || 1
  const dampenPct = (v: number) => 50 / dayVals.length + 0.5 * (v / daySum) * 100

  return (
    <div>
      {/* HEADER: cím + kereső + szűrő + (overlay) bezárás */}
      <motion.div variants={popItem} className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">{variant === 'restaurant' ? 'Éttermi csapat' : 'Szalon csapat'}</p>
          <h1 className="text-[26px] font-light tracking-[-0.02em] text-ink lg:text-[34px]">Munkavállalók</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-[200px] items-center gap-2.5 rounded-dav-pill border border-line bg-white px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keresés" className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none" />
          </div>
          {/* Szűrő gomb → meglévő pozíciók */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Szűrés pozícióra"
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${filterOpen || posFilter !== 'all' ? 'border-line-strong bg-ink-dark text-white' : 'border-line bg-white text-ink-soft hover:border-line-strong'}`}
            >
              <SlidersHorizontal className="h-[17px] w-[17px]" strokeWidth={1.7} />
              {posFilter !== 'all' && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white" />}
            </button>
            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    className="absolute right-0 top-[52px] z-20 w-56 rounded-[18px] border border-line bg-white p-1.5 shadow-dav-container"
                  >
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft2">Pozíció</p>
                    <button onClick={() => { setPosFilter('all'); setFilterOpen(false) }} className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper">
                      Minden pozíció {posFilter === 'all' && <Check className="h-4 w-4 text-ink" strokeWidth={2} />}
                    </button>
                    {positions.map((p) => (
                      <button key={p} onClick={() => { setPosFilter(p); setFilterOpen(false) }} className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper">
                        {p} {posFilter === p && <Check className="h-4 w-4 text-ink" strokeWidth={2} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Bezárás" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── BAL: csapat-lista ── */}
        <motion.div variants={popItem} className="flex flex-col print:hidden">
          <motion.div variants={listContainer} className="space-y-3">
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink-soft">Nincs találat.</p>}
            {paged.map((c) => {
              const active = c.id === selId
              return (
                <motion.button
                  key={c.id}
                  variants={listItem}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelId(c.id)}
                  className={`w-full rounded-[22px] p-4 text-left transition-colors ${active ? 'bg-white shadow-dav-card ring-1 ring-line' : 'bg-[var(--dav-glass)] hover:bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt={c.name} className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: GRADS[[...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % GRADS.length] }}>{monogram(c.name)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{c.name}</p>
                      <p className="truncate text-[12px] text-ink-soft">{c.position} · {ROLE_LABEL[c.roleTone]}</p>
                    </div>
                    <ArrowUpRight className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-ink' : 'text-ink-soft'}`} />
                  </div>
                  <div className="mt-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[11px] font-medium text-ink-soft">Jelenlét · {c.attendance}%</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(120,110,70,.14)]">
                        <motion.div className="h-full rounded-full" style={{ background: c.attendance >= 95 ? '#4A7A2A' : c.attendance >= 90 ? 'var(--dav-accent)' : '#E08A3C' }}
                          initial={{ width: 0 }} animate={{ width: `${c.attendance}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }} />
                      </div>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-dav-card"><MessageCircle className="h-[15px] w-[15px] text-ink-soft" strokeWidth={1.7} /></span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-dav-card"><Phone className="h-[15px] w-[15px] text-ink-soft" strokeWidth={1.7} /></span>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
          {/* Lapozó — VALÓS oldalszámok; csak akkor jelenik meg, ha 1-nél több oldal van. */}
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage === 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              {pageWindow(curPage, pageCount).map((n, idx) =>
                n === '…' ? (
                  <span key={`e${idx}`} className="px-1 text-ink-soft2">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${curPage === n ? 'bg-ink-dark text-white' : 'border border-line bg-white text-ink-soft hover:border-line-strong'}`}>{n}</button>
                ),
              )}
              <button onClick={() => setPage(Math.min(pageCount, curPage + 1))} disabled={curPage === pageCount} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </motion.div>

        {/* ── JOBB: adatlap (kiválasztáskor újra-animálódik) ── */}
        <motion.div variants={popItem} data-print-root className="rounded-[26px] dav-card-glass p-6 sm:p-8">
          <motion.div
            key={sel.id}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.02 } } }}
            className="hv-detail-grid grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8"
          >
            {/* Bal belső: fotó + Alapadatok + Havi órák */}
            <motion.div variants={detailCol} className="space-y-5">
              <motion.div variants={detailItem} className="relative h-[240px] overflow-hidden rounded-[22px]" style={{ background: GRADS[0] }}>
                {headAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headAvatar} alt={headName ?? ''} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[64px] font-light text-white/90">{monogram(headName ?? sel.name)}</div>
                )}
              </motion.div>

              {/* Mely napokon dolgozott — mini havi naptár (a kontakt-kártya helyén) */}
              <motion.div variants={detailItem}>
                <MiniCalendar calendar={eff.calendar ?? {}} />
              </motion.div>

              {/* Havi órák kártya (előző hónaphoz hasonlítva) */}
              <motion.div variants={detailItem} data-print-card className="rounded-[22px] p-6" style={{ background: 'var(--dav-accent)' }}>
                <p className="text-[14px] font-semibold text-ink-dark">Ledolgozott órák — e hó</p>
                <div className="mt-1.5"><Spark data={eff.monthWeeks ?? eff.recent} /></div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[36px] font-light leading-none tracking-[-0.02em] text-ink-dark"><CountUp to={sel.hoursThisMonth} /><span className="text-[17px]"> ó</span></span>
                  <span className="text-[12.5px] font-semibold" style={{ color: hoursDelta >= 0 ? '#3B6B4B' : '#B0453F' }}>{hoursDelta >= 0 ? '+' : '−'}{Math.abs(hoursDelta)} ó</span>
                </div>
                <p className="mt-1.5 text-[11.5px] font-medium text-ink-dark/65">Előző hónap: {sel.hoursLastMonth} ó</p>
              </motion.div>
            </motion.div>

            {/* Jobb belső: fejléc + szerep + állomások + megjegyzés + jelenlét, alul stat-ok + chart */}
            <motion.div variants={detailCol}>
              {editing ? (
                <ProfileEditForm
                  initial={{
                    name: eff.name,
                    position: eff.position,
                    phone: eff.phone,
                    birthday: (eff.hr?.birthday ?? '').slice(0, 10),
                    address: eff.hr?.address ?? '',
                    tax_id: eff.hr?.tax_id ?? '',
                    emergency_contact: eff.hr?.emergency_contact ?? '',
                    join_date: (eff.hr?.join_date ?? '').slice(0, 10),
                    weekly_hours: eff.hr?.weekly_hours != null ? String(eff.hr.weekly_hours) : '',
                    pay_type: (eff.hr?.pay_type ?? 'daily') as 'daily' | 'hourly',
                    pay_rate: eff.hr?.pay_rate != null ? String(eff.hr.pay_rate) : '',
                    tip_eligible: eff.hr?.tip_eligible ?? false,
                    bio: eff.note,
                  }}
                  initialHistory={eff.hr?.position_history ?? []}
                  positionOptions={positionCatalog}
                  canEditSalary={canEditSalary}
                  isOwner={isOwnerRow}
                  saving={savingProfile}
                  onSave={saveProfile}
                  onCancel={() => setEditing(false)}
                />
              ) : (
              <>
              <motion.div variants={detailItem} className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-[28px] font-semibold leading-tight text-ink">{headName}</h2>
                        <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: role.bg, color: role.fg }}>{ROLE_LABEL[sel.roleTone]}</span>
                        {eff.onVacation && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D9EAD3] px-3 py-1 text-[12px] font-semibold text-[#3B6B4B]"><span className="h-2 w-2 rounded-full bg-[#4F9E6A]" />Szabadságon</span>
                        )}
                        {canEditStatus && (
                          <div className="relative">
                            <button
                              type="button"
                              disabled={statusBusy}
                              onClick={() => setStatusMenuOpen((o) => !o)}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
                              style={effStatus === 'suspended' ? { background: SUSPEND_HATCH, color: '#8A8779', border: '1px solid var(--dav-line)' } : { background: '#E7F1E9', color: '#3B6B4B' }}
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: effStatus === 'suspended' ? '#B7B2A4' : '#4F9E6A' }} />
                              {effStatus === 'suspended' ? 'Felfüggesztett' : 'Aktív'}
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            </button>
                            {statusMenuOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                                <div className="absolute left-0 top-[34px] z-20 w-48 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                                  {(['active', 'suspended'] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => changeStatus(s)}
                                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                                    >
                                      <span className="h-2 w-2 rounded-full" style={{ background: s === 'suspended' ? '#B7B2A4' : '#4F9E6A' }} />
                                      {s === 'suspended' ? 'Felfüggesztett' : 'Aktív'}
                                      {effStatus === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 text-[16px] text-ink-soft">{eff.position}</p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                      {canEditProfile && (
                        <button type="button" onClick={() => setEditing(true)} title="Szerkesztés" className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"><Pencil className="h-[17px] w-[17px]" strokeWidth={1.7} /></button>
                      )}
                      <button type="button" onClick={printProfileNow} title="Profil nyomtatása" className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink print:hidden"><Printer className="h-[18px] w-[18px]" strokeWidth={1.7} /></button>
                      {eff.phone ? (
                        <a href={`tel:${eff.phone.replace(/\s+/g, '')}`} title="Hívás" className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"><PhoneCall className="h-[18px] w-[18px]" strokeWidth={1.7} /></a>
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft2 opacity-40"><PhoneCall className="h-[18px] w-[18px]" strokeWidth={1.7} /></span>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {sel.tags.map((s, i) => {
                      const t = TAG_TONE[TAG_KEYS[i % TAG_KEYS.length]]
                      return <span key={s} className="rounded-full px-4 py-2 text-[13px] font-semibold" style={{ background: t.bg, color: t.fg }}>{s}</span>
                    })}
                  </div>
                  {eff.note && <p className="mt-5 max-w-[520px] text-[15.5px] leading-relaxed text-ink-soft">{eff.note}</p>}
                  <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2.5 text-[14px] text-ink-soft">
                    {headEmail && <a href={`mailto:${headEmail}`} className="flex items-center gap-2.5 transition-colors hover:text-ink"><Mail className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.7} />{headEmail}</a>}
                    {eff.phone && <a href={`tel:${eff.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2.5 transition-colors hover:text-ink"><Phone className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.7} />{eff.phone}</a>}
                  </div>
                  {/* Belépés / heti óra / bér / felfüggesztés dátuma */}
                  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px] text-ink-soft">
                    {eff.hr?.join_date && <span>Belépés: <b className="font-semibold text-ink">{fmtDate(eff.hr.join_date)}</b></span>}
                    {eff.weeklyHours != null && <span>Heti óra (naptárból): <b className="font-semibold text-ink">{eff.weeklyHours} ó</b></span>}
                    {eff.hr?.address && <span>Cím: <b className="font-semibold text-ink">{eff.hr.address}</b></span>}
                    {effStatus === 'suspended' && eff.hr?.suspended_at && <span className="text-[#C0453F]">Felfüggesztve: <b className="font-semibold">{fmtDate(eff.hr.suspended_at)}</b></span>}
                  </div>
                  {eff.hr?.position_history && eff.hr.position_history.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft2">Pozíció-előzmény</p>
                      <div className="flex flex-wrap gap-2">
                        {eff.hr.position_history.map((h, i) => (
                          <span key={i} className="rounded-full bg-paper px-3 py-1 text-[12.5px] text-ink-soft">{h.position} · {fmtDate(h.changed_at)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {canEditSalary && payRate > 0 && (
                    <div data-print-card className="mt-4 rounded-[16px] border border-line bg-[#EFEFEC] p-4">
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft2">Fizetés — e hó <Lock className="h-3 w-3" strokeWidth={1.8} /></p>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-ink-soft">
                        {payType === 'daily' ? (
                          <>
                            <span>Ledolgozott: <b className="text-ink">{eff.daysWorked} nap</b></span>
                            <span>Fiz. szabadság: <b className="text-ink">{eff.vacationDays} nap</b></span>
                            <span>Napidíj: <b className="text-ink">{payRate.toLocaleString('hu-HU')} Ft</b></span>
                          </>
                        ) : (
                          <>
                            <span>Ledolgozott: <b className="text-ink">{eff.hoursThisMonth} ó</b></span>
                            <span>Fiz. szabadság: <b className="text-ink">{payVacHours} ó</b></span>
                            <span>Órabér: <b className="text-ink">{payRate.toLocaleString('hu-HU')} Ft</b></span>
                          </>
                        )}
                      </div>
                      <p className="mt-2 text-[19px] font-semibold text-ink">Összesen: {payTotal.toLocaleString('hu-HU')} Ft</p>
                    </div>
                  )}
                  {/* Havi borravaló — MINDENKI látja (nem owner-only, nincs lakat); a napi összeg a Naptárból. */}
                  {eff.hr?.tip_eligible && (
                    <div data-print-card className="mt-4 rounded-[16px] border border-line bg-[#EFEFEC] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft2">Havi borravaló</p>
                      <p className="mt-1 text-[19px] font-semibold text-ink">{(eff.tipsThisMonth ?? 0).toLocaleString('hu-HU')} Ft</p>
                      <p className="mt-1 text-[11.5px] text-ink-soft2">A napi borravalót a Naptárban adod meg; az aznap dolgozó jogosultak közt elosztva.</p>
                    </div>
                  )}
                </div>
                <RadialGauge value={sel.attendance} label="Jelenlét (hó)" />
              </motion.div>

              {/* Havi napok — ARÁNYOS pillek. A profilon SAJÁT, NAGYOBB belépő (a listaoldalak közös
                  StatusPills-jénél hangsúlyosabb): a kártya beúszása UTÁN, staggerelten, 0-ról nőnek ki
                  (scale-pop + fade + felszámoló szám). `key`-ben a sel.id → személyváltáskor újra lejátszódik. */}
              <div className="mt-8 flex min-w-0 items-end gap-2.5">
                {[
                  { label: 'Ledolgozott nap', pct: dampenPct(sel.daysWorked), value: sel.daysWorked, background: '#1D1C19', color: '#fff', align: 'start' as const, border: undefined as string | undefined },
                  { label: 'Szabadság', pct: dampenPct(sel.vacationDays), value: sel.vacationDays, background: '#F1CE45', color: '#1D1C19', align: 'start' as const, border: undefined as string | undefined },
                  { label: 'Betegség', pct: dampenPct(sel.sickDays), value: sel.sickDays, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', align: 'end' as const, border: '1px solid var(--dav-line-strong)' },
                ].map((s, i) => (
                  <motion.div
                    key={`${sel.id}-${s.label}`}
                    initial={{ flexGrow: 0.0001, minWidth: 0, opacity: 0, scale: 0.8, y: 12 }}
                    animate={{ flexGrow: Math.max(s.pct, 1), minWidth: 64, opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.85, ease: EASE, delay: 0.35 + i * 0.16 }}
                    style={{ flexBasis: 0 }}
                  >
                    <p className="mb-2 truncate text-xs font-medium text-ink-soft">{s.label}</p>
                    <div
                      className={`flex h-11 items-center overflow-hidden whitespace-nowrap rounded-[21px] px-5 text-sm font-semibold ${s.align === 'end' ? 'justify-end' : 'justify-start'}`}
                      style={{ background: s.background, color: s.color, border: s.border }}
                    >
                      <CountUp to={s.value} />&nbsp;nap
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Munkaidő — aktuális hét vs. előző hét */}
              <motion.div variants={detailItem} className="mt-8">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h3 className="text-[17px] font-medium text-ink">Havi munkaidő</h3>
                    <p className="mt-0.5 text-[12px] text-ink-soft2">Ledolgozott órák a hónap napjai szerint</p>
                  </div>
                  <div className="flex items-center gap-4 text-[12.5px] text-ink-soft">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" />E hónap</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#C7C3B6]" />Előző hónap</span>
                  </div>
                </div>
                <WorkChart recent={eff.monthWeeks ?? eff.recent} previous={eff.prevMonthWeeks ?? eff.previous} labels={['1–7', '8–14', '15–21', '22–28', '29+']} />
              </motion.div>
              </>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
