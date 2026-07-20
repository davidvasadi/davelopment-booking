'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plus, Loader2, X, Monitor, Zap, MessageSquare, Ruler, Link2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/payload/payload-types'

/**
 * „Teendők" — 1:1 a Crextio „Onboarding" + „Onboarding Task" referenciára.
 * FENT: 3 szegmens-pill (gold / sötét / szaggatott) fölöttük kis felirattal — ezek a KAPCSOLHATÓ
 * tabok NAP szerint: Mai / Holnapi (a maradék) / Tegnapi (szaggatott, utolsó). ALUL: réteges
 * kártya, sorok BAL ikon-körrel + cím/idő + JOBB pipa-körrel; a kész sor ÁTHÚZVA.
 * Az első nézet (Mai) az alapértelmezett. Mentés a /api/tasks-on (restaurantId scope).
 */

type Tab = 'today' | 'tomorrow' | 'yesterday'
const EASE = [0.22, 1, 0.36, 1] as const
const ROW_ICONS: LucideIcon[] = [Monitor, Zap, MessageSquare, Ruler, Link2]

export function OverviewTasksPanel({ restaurantId, salonId, initial }: { restaurantId?: string; salonId?: string; initial: Task[] }) {
  // Az üzlet-scope: étterem VAGY szalon (a /api/tasks mindkettőt kezeli).
  const scope = restaurantId ? { restaurantId } : { salonId }
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [tab, setTab] = useState<Tab>('today')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // A teendőket a lejárati dátum szerint 3 kosárba soroljuk: MAI / HOLNAPI (a maradék) / TEGNAPI.
  // due_date nélküli teendő = a LÉTREHOZÁS napja (createdAt) — így nem ragad örökre „mai"-ban,
  // hanem a naptárral együtt öregszik. A nap-határt helyi időben számoljuk.
  const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
  const DAY = 86_400_000
  const todayStart = dayStart(new Date())
  const bucketOf = (t: Task): Tab => {
    const ref = t.due_date ?? t.createdAt
    if (!ref) return 'today'
    const d = dayStart(new Date(ref))
    if (d <= todayStart - DAY) return 'yesterday' // tegnap és korábbi
    if (d === todayStart) return 'today'
    return 'tomorrow' // holnap és minden későbbi = a maradék
  }
  const todayList = tasks.filter((t) => bucketOf(t) === 'today')
  const tomorrowList = tasks.filter((t) => bucketOf(t) === 'tomorrow')
  const yesterdayList = tasks.filter((t) => bucketOf(t) === 'yesterday')
  const listOf = (k: Tab) => (k === 'today' ? todayList : k === 'tomorrow' ? tomorrowList : yesterdayList)
  const total = tasks.length
  const doneList = tasks.filter((t) => t.done)
  const donePct = total ? Math.round((doneList.length / total) * 100) : 0

  // Az aktív fül napja (dél, hogy az időzóna ne csússzon át) — erre bélyegezzük az új feladatot,
  // így a helyére kerül ÉS a naptárral együtt vándorol (Holnapi → Mai → Tegnapi).
  function dueForTab(t: Tab): string {
    const d = new Date(); d.setHours(12, 0, 0, 0)
    if (t === 'tomorrow') d.setDate(d.getDate() + 1)
    else if (t === 'yesterday') d.setDate(d.getDate() - 1)
    return d.toISOString()
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    // Múltba (tegnapi/korábbi fül) NEM lehet új teendőt felvenni — csalás-védelem; ott csak pipálni lehet.
    if (!t || adding || tab === 'yesterday') return
    setAdding(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...scope, title: t, due_date: dueForTab(tab) }),
      })
      const data = (await res.json().catch(() => null)) as { task?: Task; error?: string } | null
      if (!res.ok || !data?.task) throw new Error(data?.error ?? 'hiba')
      setTasks((p) => [...p, data.task!]); setTitle(''); setShowAdd(false)
    } catch { toast.error('Nem sikerült hozzáadni') } finally { setAdding(false) }
  }

  async function toggle(task: Task) {
    setBusy(String(task.id)); const next = !task.done
    setTasks((p) => p.map((x) => (x.id === task.id ? { ...x, done: next } : x)))
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: task.id, done: next }),
      })
      if (!res.ok) throw new Error()
    } catch { setTasks((p) => p.map((x) => (x.id === task.id ? { ...x, done: !next } : x))); toast.error('Hiba történt') }
    finally { setBusy(null) }
  }

  async function remove(task: Task) {
    setBusy(String(task.id)); const prev = tasks
    setTasks((p) => p.filter((x) => x.id !== task.id))
    try {
      const res = await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
    } catch { setTasks(prev); toast.error('Nem sikerült törölni') } finally { setBusy(null) }
  }

  // 3 szegmens = tabok. `pill` a kis gomb háttere (a 3. a HERO-val EGYEZŐ 115°-os csíkos minta),
  // `card` az adott nagy kártya ELTÉRŐ háttérszíne. A pipa/„+" mindig GOLD.
  const HERO_STRIPE = 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)'
  const DARK_STRIPE = 'repeating-linear-gradient(115deg, #2c2a25 0 8px, #201e1a 8px 16px)'
  // Sorrend: MAI (gold, elöl) → HOLNAPI (a maradék, világos) → TEGNAPI (szaggatott, UTOLSÓ).
  const SEGS: { key: Tab; label: string; count: number; pill: string; card: string; light?: boolean; striped?: boolean }[] = [
    { key: 'today', label: 'Mai', count: todayList.length, pill: '#F1CE45', card: '#26220f' },
    { key: 'tomorrow', label: 'Holnapi', count: tomorrowList.length, pill: '#1D1C19', card: '#E4E3E0', light: true },
    { key: 'yesterday', label: 'Korábbi', count: yesterdayList.length, pill: HERO_STRIPE, card: DARK_STRIPE, striped: true },
  ]

  return (
    <div className="flex h-full flex-col rounded-[26px] bg-[var(--dav-glass-strong)] backdrop-blur-lg p-[18px] shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
      {/* Fejléc: cím + nagy % (kész arány) */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[19px] font-medium text-ink">Teendők</div>
        <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{donePct}%</div>
      </div>

      {/* 3 SZEGMENS-PILL (kapcsolható tabok) — ARÁNYOS szélesség a darabszám szerint, felül felirat + osztóvonal */}
      <div className="mt-4 flex items-stretch gap-2">
        {SEGS.map((s, i) => {
          const active = tab === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className="group relative flex min-w-[64px] flex-col text-left"
              style={{
                flexGrow: Math.max(s.count, 1),
                flexBasis: 0,
                // FOLYAMATOS ease-in-out szélesség-váltás (nem ugrálva): a flex-grow animálódik
                transition: 'flex-grow 0.55s cubic-bezier(0.42, 0, 0.58, 1)',
              }}
            >
              <div className="mb-1.5 flex items-center gap-2 pl-1">
                {i > 0 && <span className="absolute -left-1 top-0 bottom-0 w-[2px] rounded-full bg-[#d9d4c5]" />}
                <span className="text-[11px] font-medium text-ink-soft2">{s.count} db</span>
              </div>
              <div
                className="h-[42px] rounded-[16px]"
                style={{
                  background: s.pill,
                  transform: active ? 'translateY(-3px)' : 'none',
                  boxShadow: active ? '0 10px 22px -10px rgba(40,35,15,.45)' : 'none',
                  transition: 'transform 0.55s cubic-bezier(0.42, 0, 0.58, 1), box-shadow 0.55s cubic-bezier(0.42, 0, 0.58, 1)',
                }}
              />
              <span className="sr-only">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* KÁRTYA-STACK — a 3 nézet LÁTHATÓAN egymás mögött; a kiválasztott animálva előre kerül */}
      <div className="relative mt-5 min-h-[300px] flex-1">
        {SEGS.map((s) => {
          const stack: Tab[] = [tab, ...(['today', 'tomorrow', 'yesterday'] as Tab[]).filter((k) => k !== tab)]
          const pos = stack.indexOf(s.key) // 0 = elöl, 1/2 = mögötte
          const front = pos === 0
          const list = listOf(s.key)
          const label = s.key === 'today' ? 'Mai teendők' : s.key === 'tomorrow' ? 'Holnapi teendők' : 'Korábbi teendők'
          const light = !!s.light
          const th = {
            title: light ? 'text-ink' : 'text-white',
            num: light ? 'text-ink-soft2' : 'text-white/40',
            empty: light ? 'text-ink-soft' : 'text-white/40',
            border: light ? 'border-[#e4dfd0]' : 'border-[#2c2b27]',
            iconBg: light ? '#D6D5D1' : '#33322e',
            iconFg: light ? '#6b6a64' : '#cfccc2',
            iconFgDone: light ? '#a9a8a2' : '#5a5852',
            rowOpen: light ? 'text-ink' : 'text-white',
            rowDone: light ? 'text-[#57564f] line-through decoration-[#57564f]' : 'text-[#8a8880] line-through',
            date: light ? 'text-[#6b6a64]' : 'text-[#6a6860]',
            openBorder: light ? '#c9c3b4' : '#3a3934',
            x: light ? 'text-ink-soft2/60 hover:text-ink' : 'text-white/15 hover:text-white/60',
          }
          return (
            <motion.div
              key={s.key}
              className="absolute inset-x-0 top-0 bottom-0"
              style={{ zIndex: 30 - pos * 10, pointerEvents: front ? 'auto' : 'none' }}
              animate={{ y: pos * -16, scale: 1 - pos * 0.05, filter: front ? 'brightness(1)' : 'brightness(0.72)' }}
              transition={{ duration: 0.55, ease: [0.42, 0, 0.58, 1] }}
            >
              <div className="flex h-full flex-col rounded-[24px] p-[20px] shadow-[0_22px_46px_-26px_rgba(40,35,15,.55)]" style={{ background: s.card }}>
                <div className="flex items-center justify-between px-1 pb-1">
                  <div className={`text-[16px] font-medium ${th.title}`}>{label}</div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[22px] font-light ${th.title}`}>{list.filter((t) => t.done).length}<span className={th.num}>/{list.length}</span></span>
                    {front && s.key !== 'yesterday' && (
                      <button type="button" onClick={() => setShowAdd((v) => !v)} aria-label="Új feladat" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-dark" style={{ background: '#F1CE45' }}>
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="no-scrollbar mt-1 min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
                  {list.length === 0 ? (
                    <p className={`py-6 text-center text-sm ${th.empty}`}>
                      {s.key === 'yesterday' ? 'Nincs korábbi teendő.' : s.key === 'tomorrow' ? 'Nincs holnapi vagy későbbi teendő.' : 'Nincs mai teendő. Vegyél fel egyet a +-szal.'}
                    </p>
                  ) : (
                    list.map((task, idx) => {
                      const busyRow = busy === String(task.id)
                      const RowIcon = ROW_ICONS[idx % ROW_ICONS.length]
                      const timeLabel = task.due_date ? new Date(task.due_date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) : null
                      return (
                        <div key={task.id} className={`group flex items-center gap-3 border-b py-[11px] last:border-0 ${th.border}`}>
                          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full" style={{ background: th.iconBg }}>
                            <RowIcon className="h-[15px] w-[15px]" strokeWidth={2} style={{ color: task.done ? th.iconFgDone : th.iconFg }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-[14px] font-medium ${task.done ? th.rowDone : th.rowOpen}`}>{task.title}</div>
                            {timeLabel ? <div className={`text-[11px] font-medium ${th.date}`}>{timeLabel}</div> : null}
                          </div>
                          <button type="button" onClick={() => remove(task)} aria-label="Törlés" className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${th.x}`}>
                            <X className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => toggle(task)} disabled={busyRow} aria-label={task.done ? 'Nem kész' : 'Kész'} className="shrink-0">
                            {busyRow ? (
                              <Loader2 className={`h-[22px] w-[22px] animate-spin ${light ? 'text-ink-soft2' : 'text-white/50'}`} />
                            ) : task.done ? (
                              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ background: '#F1CE45' }}>
                                <Check className="h-3.5 w-3.5 text-ink-dark" strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="block h-[22px] w-[22px] rounded-full border-2 transition-colors" style={{ borderColor: th.openBorder }} />
                            )}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>

                {front && showAdd && s.key !== 'yesterday' && (
                  <form onSubmit={addTask} className={`mt-2 flex items-center gap-2 border-t pt-2.5 ${th.border}`}>
                    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Új feladat…" className={`min-w-0 flex-1 bg-transparent text-[14px] focus:outline-none ${light ? 'text-ink placeholder:text-ink-soft2' : 'text-white placeholder:text-white/35'}`} />
                    <button type="submit" disabled={adding || !title.trim()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-dark disabled:opacity-40" style={{ background: '#F1CE45' }}>
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
