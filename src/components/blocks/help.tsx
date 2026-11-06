import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button, Card, Collapse, IconCircle } from '@/components/ui-kit'
import { helpGroups, type HelpTopic } from '@/lib/helpTopics'

/* A Súgó darabjai — a /design 15.x és az élő HelpView is ezeket rendereli. A témák (lib/helpTopics) három
 * csoportban (Napi munka · Beüzemelés & testreszabás · Növekedés & elemzés), soronként ikon, cím, egy soros leírás;
 * kinyitva a részletek, pontokba szedve, és egy gomb a funkcióhoz. */

export type HelpGroupVM = { id: string; label: string; tone: 'dark' | 'yellow' | 'ok'; topics: HelpTopic[] }

/** Egy téma-sor: ikon-kör a csoport színével, cím, egy soros leírás, jobbra nyíl; kinyitva a részletek pontokba
 *  szedve (sárga pötty) és egy gomb a funkcióhoz. */
function HelpRow({ topic, tone, open, onToggle }: { topic: HelpTopic; tone: HelpGroupVM['tone']; open: boolean; onToggle?: () => void }) {
  const head = (
    <>
      <IconCircle tone={tone} size="lg" icon={topic.icon} />
      <span className="min-w-0 flex-1"><span className="block text-ui-row text-ui-text">{topic.title}</span><span className={`block text-ui-meta text-ui-muted ${open ? '' : 'truncate'}`}>{topic.body}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-ui-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </>
  )
  return (
    <div id={`tip-${topic.id}`} className={`scroll-mt-24 border-t border-dashed border-ui-divider first:border-t-0 transition-colors duration-300 ${open ? 'bg-white/60' : ''}`}>
      {onToggle
        ? <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-dark/20">{head}</button>
        : <div className="flex items-center gap-3.5 px-4 py-3.5">{head}</div>}
      <Collapse open={open} className="pb-5 pl-[70px] pr-5">
          <p className="text-ui-meta leading-relaxed text-ui-muted">{topic.details}</p>
          <ul className="mt-3 space-y-2">{topic.bullets.map((b) => <li key={b} className="flex gap-2.5 text-ui-meta leading-relaxed text-ui-text"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ui-yellow" />{b}</li>)}</ul>
          <Button className="mt-4" size="sm" icon={ArrowRight} href={onToggle ? topic.href : undefined}>{topic.linkLabel}</Button>
      </Collapse>
    </div>
  )
}

/** A Súgó témái csoportonként: fejléc-sor (név, szaggatott vonal, darabszám), alatta egy kártyában a sorok. Élőben
 *  `groups` (a jogosultság és a keresés szerint), `openIds` / `onToggle`; nélkülük a minta (a Foglalások kinyitva). */
export function HelpGroups({ groups, openIds, onToggle, restaurant = false, limit, className = '' }: {
  groups?: HelpGroupVM[]; openIds?: string[]; onToggle?: (id: string) => void; restaurant?: boolean; limit?: number; className?: string
}) {
  const list = (groups ?? helpGroups(restaurant ? 'restaurant' : 'salon')).slice(0, limit)
  const open = openIds ?? ['bookings']
  return (
    <div className={`space-y-5 ${className}`}>
      {list.map((g) => (
        <section key={g.id}>
          <div className="mb-2 flex items-center gap-2 px-1 text-ui-label text-ui-muted">{g.label}<span className="h-px flex-1 border-t border-dashed border-ui-divider" />{g.topics.length}</div>
          <Card pad="none" className="overflow-hidden">{g.topics.map((t) => <HelpRow key={t.id} topic={t} tone={g.tone} open={open.includes(t.id)} onToggle={onToggle ? () => onToggle(t.id) : undefined} />)}</Card>
        </section>
      ))}
    </div>
  )
}
