'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { Check, Plus, Loader2, X, Monitor, Zap, MessageSquare, Ruler, Link2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, Card, IconButton, IconCircle, Input, SegmentBar, TaskRow } from '@/components/ui-kit'
import type { Task } from '@/payload/payload-types'
import { capsWords } from '@/lib/utils'

/**
 * „Teendők” — a /design 4.1 Teendők oszlopa: fent a kész arány (%) és az összefüggő sáv, ami egyben a három
 * fül (Mai / Holnapi / Korábbi, darabszám szerinti szélességgel); alatta a sötét lista egy kártya-stackben (mögötte a
 * másik két lap kandikál ki). Pipálás, törlés, új teendő. Mentés a /api/tasks-on (salonId / restaurantId scope).
 */

type Creator = { name?: string; avatar_url?: string | null }

/** Ki vette fel (kis avatar + keresztnév) és mikorra. */
function taskMeta(task: Task, timeLabel: string | null) {
  const creator = typeof task.created_by === 'object' && task.created_by !== null ? (task.created_by as Creator) : null
  if (!creator && !timeLabel) return undefined
  return (
    <span className="inline-flex items-center gap-1.5">
      {creator && <Avatar size="xs" src={creator.avatar_url ?? null} className="h-4 w-4" />}
      {[creator?.name?.split(' ')[0], timeLabel].filter(Boolean).join(' · ')}
    </span>
  )
}

type Tab = 'today' | 'tomorrow' | 'yesterday'
const TABS: Tab[] = ['today', 'tomorrow', 'yesterday']
// minden lapnak saját színe van (a sáv szegmensével párban), és a szín a lappal együtt mozog
const CARD_BG: Record<Tab, string> = { today: 'bg-ui-dark text-white', tomorrow: 'bg-ui-cell text-ui-text', yesterday: 'bg-ui-muted text-white' }
const ROW_ICONS: LucideIcon[] = [Monitor, Zap, MessageSquare, Ruler, Link2]

/** Számláló-animáció: pipáláskor a % ne ugorjon, hanem fusson végig az előző és az új érték között. */
function useCountUp(value: number, duration = 0.5): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  useEffect(() => {
    const from = prevRef.current
    const controls = animate(from, value, { duration, ease: 'easeOut', onUpdate: (v) => setDisplay(Math.round(v)) })
    prevRef.current = value
    return () => controls.stop()
  }, [value, duration])
  return display
}

export function OverviewTasksPanel({ restaurantId, salonId, initial }: { restaurantId?: string; salonId?: string; initial: Task[] }) {
  // Az üzlet-scope: étterem VAGY szalon (a /api/tasks mindkettőt kezeli).
  const scope = restaurantId ? { restaurantId } : { salonId }
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [tab, setTab] = useState<Tab>('today')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // Ha épp nyitva van az "Új feladat" mező, a fül-váltás blokkolva van (a beírt szöveg elveszne) —
  // helyette a Mégse gomb megrezeg + fehér keretet kap, jelezve hogy előbb azt kell bezárni.
  const [shakeCancel, setShakeCancel] = useState(false)
  // Percenkénti "óraketyegés" — ha a lap nyitva marad éjfélen át (interakció, tehát re-render
  // nélkül), enélkül a lenti todayStart csak a KÖVETKEZŐ kattintásig maradna a tegnapi napon.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

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
  const donePctDisplay = useCountUp(donePct)

  // Az aktív fül napja (dél, hogy az időzóna ne csússzon át) — erre bélyegezzük az új feladatot,
  // így a helyére kerül ÉS a naptárral együtt vándorol (Holnapi → Mai → Tegnapi).
  function dueForTab(t: Tab): string {
    const d = new Date(); d.setHours(12, 0, 0, 0)
    if (t === 'tomorrow') d.setDate(d.getDate() + 1)
    else if (t === 'yesterday') d.setDate(d.getDate() - 1)
    return d.toISOString()
  }

  function closeAdd() {
    setShowAdd(false)
    setTitle('')
  }

  function tryChangeTab(key: Tab) {
    if (showAdd && key !== tab) { setShakeCancel(true); return }
    setTab(key)
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
  const counts = { today: todayList.length, tomorrow: tomorrowList.length, yesterday: yesterdayList.length }

  return (
    <div className="flex h-full flex-col gap-[5px]">
      <Card>
        <div className="flex items-baseline justify-between"><span className="text-ui-title text-ui-text">Teendők</span><span className="text-ui-num font-light text-ui-text">{donePctDisplay}%</span></div>
        <SegmentBar
          joined
          className="mt-4"
          active={TABS.indexOf(tab)}
          onSelect={(i) => tryChangeTab(TABS[i])}
          segments={[
            { label: `${counts.today} db`, value: 'Mai', weight: Math.max(counts.today, 1), tone: 'yellow' },
            { label: `${counts.tomorrow} db`, value: 'Holnapi', weight: Math.max(counts.tomorrow, 1), tone: 'dark' },
            { label: `${counts.yesterday} db`, value: 'Korábbi', weight: Math.max(counts.yesterday, 1), tone: 'muted' },
          ]}
        />
      </Card>

      {/* KÁRTYA-STACK — a 3 lap láthatóan egymás mögött; a kiválasztott animálva előre csúszik (elöl mindig sötét) */}
      <div className="relative mt-5 min-h-[360px] flex-1 lg:min-h-[300px]">
        {TABS.map((key) => {
          const stack: Tab[] = [tab, ...TABS.filter((k) => k !== tab)]
          const pos = stack.indexOf(key) // 0 = elöl, 1/2 = mögötte
          const front = pos === 0
          const items = listOf(key)
          const label = key === 'today' ? 'Mai teendők' : key === 'tomorrow' ? 'Holnapi teendők' : 'Korábbi teendők'
          return (
            <motion.div
              key={key}
              className="absolute inset-0"
              style={{ zIndex: 30 - pos * 10, pointerEvents: front ? 'auto' : 'none' }}
              animate={{ y: pos * -16, scale: 1 - pos * 0.05 }}
              transition={{ duration: 0.55, ease: [0.42, 0, 0.58, 1] }}
            >
              <div className={`flex h-full flex-col rounded-ui-card p-5 transition-[filter] duration-500 ${CARD_BG[key]} ${front ? '' : 'brightness-[.85]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-ui-title">{label}</span>
                  <span className="text-ui-sub font-light">{items.filter((t) => t.done).length}/{items.length}</span>
                </div>
                {front && <TaskList tab={key} items={items} busy={busy} onToggle={toggle} onRemove={remove} />}
                {/* „Új teendő” a lapon — a lappal együtt tűnik el / jön be (a Korábbi lapon nincs) */}
                {front && key !== 'yesterday' && (showAdd
                  ? <div className="h-9 shrink-0" />
                  : <Button variant={key === 'tomorrow' ? 'glass' : 'onDark'} size="sm" icon={Plus} onClick={() => setShowAdd(true)} className="mt-3 self-start">Új teendő</Button>)}
              </div>
            </motion.div>
          )
        })}

        {/* Az új teendő MEZŐJE — SZÁNDÉKOSAN a transzformált stack-en KÍVÜL, saját (nem animált) rétegben: egy inputot
            transform-mal animált ősben tartani iOS Safarin ismert hiba (blur után nem fókuszálható vissza). */}
        {showAdd && tab !== 'yesterday' && (
          <form onSubmit={addTask} className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-1.5 px-5 pb-5">
            <Input size="sm" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Új teendő…" className="min-w-0 flex-1" />
            <IconButton icon={X} label="Mégse" variant={tab === 'tomorrow' ? 'glass' : 'onDark'} size="sm" onClick={closeAdd} className={shakeCancel ? 'animate-shake' : ''} onAnimationEnd={() => setShakeCancel(false)} />
            <IconButton icon={Check} label="Hozzáadás" variant="yellow" size="sm" type="submit" disabled={adding || !title.trim()} className="disabled:opacity-40" />
          </form>
        )}
      </div>
    </div>
  )
}

/** Az elöl lévő lap sorai: ikon, cím (teljes egészében), ki/mikorra; jobbra törlés (hoverre) és a pipa. */
function TaskList({ tab, items, busy, onToggle, onRemove }: { tab: Tab; items: Task[]; busy: string | null; onToggle: (t: Task) => void; onRemove: (t: Task) => void }) {
  const light = tab === 'tomorrow'
  return (
    <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
      {items.length === 0 ? (
        <p className={`py-6 text-center text-ui-body ${light ? 'text-ui-muted' : 'text-white/60'}`}>
          {tab === 'yesterday' ? 'Nincs korábbi teendő.' : tab === 'tomorrow' ? 'Nincs holnapi vagy későbbi teendő.' : 'Nincs mai teendő.'}
        </p>
      ) : items.map((task, idx) => {
        const busyRow = busy === String(task.id)
        const timeLabel = task.due_date ? capsWords(new Date(task.due_date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })) : null
        return (
          <TaskRow
            key={task.id}
            icon={ROW_ICONS[idx % ROW_ICONS.length]}
            title={<span className="whitespace-normal break-words">{task.title}</span>}
            meta={taskMeta(task, timeLabel)}
            done={!!task.done}
            light={light}
            className="group"
            trailing={
              <span className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => onRemove(task)} aria-label="Törlés" className={`opacity-0 transition-opacity group-hover:opacity-100 ${light ? 'text-ui-muted hover:text-ui-text' : 'text-white/30 hover:text-white/70'}`}>
                  <X className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onToggle(task)} disabled={busyRow} aria-label={task.done ? 'Nem kész' : 'Kész'}>
                  {busyRow
                    ? <Loader2 className={`h-5 w-5 animate-spin ${light ? 'text-ui-muted' : 'text-white/50'}`} />
                    : task.done
                      ? <IconCircle icon={Check} tone="yellow" size="xs" />
                      : <span className={`block h-5 w-5 rounded-full ${light ? 'bg-ui-dark/10' : 'bg-white/15'}`} />}
                </button>
              </span>
            }
          />
        )
      })}
    </div>
  )
}
