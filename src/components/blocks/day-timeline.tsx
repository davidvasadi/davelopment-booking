'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Avatar, IconButton, IconCircle, Pill } from '@/components/ui-kit'

/* Mobil nap-idővonal — kliens-komponens (a „+N” kinyitás állapota miatt); a blocks/overview innen exportálja tovább. */

/** `key`: ha adott és a lista `onOpen`-t kap, a kártya gomb (élesben: a foglalás megnyitása). */
/** `avatars`: kép-URL, vagy { src, name } — fotó nélkül a név monogramja látszik. */
export type DayAvatar = string | { src?: string | null; name: string }
export type DayEvent = { n: string; s: string; tone: 'dark' | 'light' | 'yellow'; dot: string; avatars?: DayAvatar[]; key?: string }
/** `avatars`: kép-URL-ek (a foglalás munkatársa). `more`: az óra további foglalásai — a sárga „+N” kinyitja őket
 *  (`badge` csak a statikus mintákon: szám, kinyitás nélkül). */
export type DayRow = { t: string; st?: 'past' | 'now'; badge?: number; ev?: DayEvent; more?: DayEvent[] }

function DayCard({ ev, onOpen }: { ev: DayEvent; onOpen?: (key: string) => void }) {
  const open = onOpen && ev.key ? () => onOpen(ev.key!) : undefined
  return (
    <div role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined} onClick={open} onKeyDown={open ? (e) => { if (e.key === 'Enter') open() } : undefined} className={`relative h-[60px] rounded-ui-inner px-4 py-2.5 text-left ${open ? 'cursor-pointer outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ui-dark/20 active:scale-[.99]' : ''} ${ev.tone === 'dark' ? 'bg-ui-dark text-white' : ev.tone === 'yellow' ? 'bg-ui-yellow text-ui-dark' : 'bg-white/90 text-ui-text'}`}>
      <span className={`absolute right-3.5 top-3 h-2 w-2 rounded-full ${ev.dot}`} />
      <div className="truncate pr-4 text-ui-body">{ev.n}</div>
      <div className={`truncate text-ui-label ${ev.tone === 'dark' ? 'text-white/55' : ev.tone === 'yellow' ? 'text-ui-dark/60' : 'text-ui-muted'}`}>{ev.s}</div>
      {ev.avatars && (
        <span className="absolute bottom-2 right-3 flex -space-x-2">
          {ev.avatars.map((a) => { const x = typeof a === 'string' ? { src: a, name: '' } : a; return <Avatar key={x.src ?? x.name} size="xs" src={x.src ?? null} name={x.name} className="ring-2 ring-white" /> })}
        </span>
      )}
    </div>
  )
}

// a kinyíló további foglalások „staggered spring” belépője (mint a Foglalások napi nézetében)
const EXTRA_ITEM = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } } }

/** Mobil nap-idővonal (a referencia szerint): balra időpont-pillek pontozott összekötővel (múlt sötét, most sárga,
 *  jövő körvonal), jobbra a foglalás-kártyák, a szabad idő csíkos. Ha egy órában több foglalás van, a pillek közötti
 *  sárga „+N” kinyitja a többit (rugósan, egymás után). `onMore`: az alsó ⌄ további órákat tölt be.
 *  A Foglalások (6.11) és az Áttekintés mobil (4.4) is ezt használja. */
export function MobileDayTimeline({ rows, more = true, onMore, onOpen }: { rows: DayRow[]; more?: boolean; onMore?: () => void; onOpen?: (key: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (t: string) => setOpen((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n })
  return (
    <div className="relative mt-4">
      {rows.map((r, i, arr) => {
        const extra = r.more ?? []
        const isOpen = open.has(r.t)
        const last = i === arr.length - 1
        return (
          <div key={r.t} className="flex gap-2">
            <div className="flex w-[58px] shrink-0 flex-col items-center">
              <Pill size="sm" tone={r.st === 'past' ? 'dark' : r.st === 'now' ? 'yellow' : 'outline'} className="z-10 mt-1">{r.t}</Pill>
              {!last && (
                <div className="relative flex min-h-[36px] w-full flex-1 flex-col items-center justify-center">
                  <span className="absolute inset-y-0 border-l-[1.5px] border-dotted border-ui-dark/60" />
                  {extra.length > 0
                    ? <button type="button" onClick={() => toggle(r.t)} aria-expanded={isOpen} aria-label={`még ${extra.length} foglalás ${r.t}-kor`} className="relative z-10 rounded-full outline-none transition-transform active:scale-95"><IconCircle tone={isOpen ? 'dark' : 'yellow'} size="sm">+{extra.length}</IconCircle></button>
                    : r.badge ? <IconCircle tone="yellow" size="sm" className="z-10">{r.badge}</IconCircle> : null}
                  <span className="absolute bottom-[-3px] z-10 h-1.5 w-1.5 rounded-full border border-ui-dark/60 bg-ui-cell" />
                </div>
              )}
            </div>
            <div className="relative z-10 min-w-0 flex-1 py-1 pb-2">
              {/* összecsukva az első kártyán az óra összes foglalt munkatársa (avatarok), kinyitva mindenki a sajátját */}
              {r.ev ? <DayCard ev={!isOpen && extra.length ? { ...r.ev, avatars: [...new Map([r.ev, ...extra].flatMap((e) => e.avatars ?? []).map((a) => [typeof a === 'string' ? a : a.src ?? a.name, a] as const)).values()].slice(0, 5) } : r.ev} onOpen={onOpen} /> : <div className="ui-hatch h-[60px] rounded-ui-inner" />}
              <AnimatePresence initial={false}>
                {isOpen && extra.length > 0 && (
                  <motion.div key="extra" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}>
                    <motion.div className="space-y-2 pt-2" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } }}>
                      {extra.map((ev, k) => <motion.div key={k} variants={EXTRA_ITEM}><DayCard ev={ev} onOpen={onOpen} /></motion.div>)}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )
      })}
      {more && (
        <div className="flex w-[58px] justify-center pt-1">
          {onMore
            ? <IconButton icon={ChevronDown} label="További órák" size="sm" variant="dark" onClick={onMore} />
            : <IconCircle size="sm" icon={ChevronDown} />}
        </div>
      )}
    </div>
  )
}


/** Óránkénti sorok egy nap foglalásaiból (mobil, design 6.11): az órában induló első foglalás, a többi a „+N” alatt;
 *  ha az órában nem indul semmi, de egy korábbi még tart, az látszik („…-ig”), hogy egy hosszú foglalás ne tűnjön
 *  szabad időnek. `extra`: az órához tartozó egyéb kártyák (pl. a munkatárs szünete). */
export function hourRows<S>(items: S[], o: { openMin: number; closeMin: number; nowMin: number | null; start: (s: S) => number; end: (s: S) => number; ev: (s: S) => DayEvent; extra?: (lo: number, hi: number) => DayEvent[] }): DayRow[] {
  const marks: number[] = []
  if (o.openMin % 60 !== 0) marks.push(o.openMin)
  for (let m = Math.ceil(o.openMin / 60) * 60; m < o.closeMin; m += 60) marks.push(m)
  const nowH = o.nowMin != null ? Math.floor(o.nowMin / 60) * 60 : null
  return marks.map((m, i) => {
    const lo = i === 0 ? o.openMin : m
    const hi = marks[i + 1] ?? o.closeMin + 1
    const starts = items.filter((s) => o.start(s) >= lo && o.start(s) < hi).sort((a, b) => o.start(a) - o.start(b)).map(o.ev)
    const cont = starts.length ? [] : items.filter((s) => o.start(s) < lo && o.end(s) > lo).map((s) => ({ ...o.ev(s), s: `folytatódik · ${String(Math.floor(o.end(s) / 60)).padStart(2, '0')}:${String(o.end(s) % 60).padStart(2, '0')}-ig` }))
    const all = [...starts, ...cont, ...(o.extra?.(lo, hi) ?? [])]
    return {
      t: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      st: nowH == null ? undefined : m < nowH ? 'past' : m === nowH ? 'now' : undefined,
      ev: all[0],
      more: all.slice(1),
    }
  })
}
