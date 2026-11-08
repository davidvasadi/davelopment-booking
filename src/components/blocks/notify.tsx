import { ArrowLeftRight, Bell, CalendarClock, CalendarDays, Check, Lightbulb, CheckCheck, Gift, Settings, Star, Trash2, X, type LucideIcon } from 'lucide-react'
import { Button, Card, CardTitle, IconButton, IconCircle, ListRow, Meta, PageHead, Panel, Pill, Segmented, MarqueeText } from '@/components/ui-kit'
import type { CircleTone } from '@/components/ui-kit'

/* Értesítések panelje (a csengő alól) — a /design 17.2 és a főoldal „Azonnali értesítések” is ezt mutatja. */

/** 17.2: fül-váltó (Mind / Jóváhagyás), napokra bontva; olvasatlan sárga pötty, jóváhagyásnál gombok. */
export function NotificationsPanel({ className = '' }: { className?: string }) {
  return (
      <Panel pad="xs" className={className}>
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <span className="flex items-center gap-2 text-ui-title text-ui-text">Értesítések <IconCircle tone="yellow" size="xs">3</IconCircle></span>
          <Segmented options={['Mind', 'Jóváhagyás']} active={0} tone="glass" size="sm" />
        </div>
        {[
          { day: 'Ma', items: [
            { I: CalendarDays, t: 'Új foglalás — jóváhagyásra vár', b: 'Juhász Hanna · Nov. 6. 13:30 · Balayage', when: '2 perce', unread: true, approve: true, tone: '' },
            { I: Gift, t: 'Utalványt vásároltak', b: 'Kovács Anna · 20 000 Ft · online', when: '1 órája', unread: true, approve: false, tone: '' },
            { I: X, t: 'Lemondás', b: 'Tóth Bence · ma 17:00', when: '3 órája', unread: true, approve: false, tone: 'bad' },
          ] },
          { day: 'Tegnap', items: [
            { I: Star, t: 'Új Google-értékelés ★★★★★', b: '„Viktória csodát művelt a hajammal…”', when: 'Okt. 30.', unread: false, approve: false, tone: '' },
          ] },
        ].map((g) => (
          <div key={g.day}>
            <div className="px-3 pb-1 pt-3 text-ui-label text-ui-muted">{g.day}</div>
            <div className="space-y-1">
            {g.items.map((n) => (
              <div key={n.t} className={`flex gap-3 rounded-ui-inner px-3 py-3 ${n.unread ? 'bg-white' : ''}`}>
                <IconCircle size="md" tone={n.tone === 'bad' ? 'bad' : n.approve ? 'yellow' : 'cell'}><n.I className="h-4 w-4" strokeWidth={1.8} /></IconCircle>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-ui-body font-medium leading-snug text-ui-text">{n.t}</span>
                    {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ui-yellow" />}
                  </div>
                  <MarqueeText className="mt-0.5 text-ui-meta text-ui-muted">{n.b}</MarqueeText>
                  <div className="mt-0.5 text-ui-label text-ui-muted/70">{n.when}</div>
                  {n.approve && (
                    <div className="mt-2.5 flex gap-1.5">
                      <Button variant="dark" size="sm" icon={Check} className="flex-1">Elfogadom</Button>
                      <Button variant="cell" size="sm" className="flex-1">Elutasítom</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        ))}
        <div className="mt-1 flex h-11 items-center justify-center rounded-full text-ui-body text-ui-muted">Összes megjelölése olvasottként</div>
      </Panel>
  )
}

/** 17.3: az összes értesítés oldala (a csengő panel aljáról / a menüből). Fejléc a darabszámmal, jobbra Összes olvasott,
 *  Összes törlése és a beállítás (Beállítások › Értesítések); alatta szűrő (Mind / Olvasatlan / Jóváhagyás); napokra
 *  bontva fehér kártyákon a sorok — kör-ikon a típus színével, cím, szöveg, idő, olvasatlannál sárga pötty, jobbra a
 *  törlés; jóváhagyásnál a gombok a sorban (`extra`). Üresen egy mondat. Élőben minden adat és művelet a hívótól. */
export type InboxRow = { id: string; icon: LucideIcon; tone: CircleTone; title: string; body?: string | null; when: string; unread: boolean; extra?: React.ReactNode; onOpen?: () => void; onRemove?: () => void }
export type InboxGroup = { label: string; rows: InboxRow[] }
const SAMPLE_INBOX: InboxGroup[] = [
  { label: 'Ma', rows: [
    { id: '1', icon: CalendarDays, tone: 'yellow', title: 'Új foglalás — jóváhagyásra vár', body: 'Juhász Hanna · Nov. 6. 13:30 · Balayage', when: '13:28 · 2 perce', unread: true, extra: <div className="mt-2.5 flex gap-1.5"><Button size="sm" icon={Check} className="flex-1">Elfogadom</Button><Button size="sm" variant="cell" className="flex-1">Elutasítom</Button></div> },
    { id: '2', icon: Gift, tone: 'cell', title: 'Utalványt vásároltak', body: 'Kovács Anna · 20 000 Ft · online', when: '12:30 · 1 órája', unread: true },
    { id: '3', icon: X, tone: 'bad', title: 'Lemondás', body: 'Tóth Bence · ma 17:00 · Férfi hajvágás', when: '10:05 · 3 órája', unread: false },
  ] },
  { label: 'Tegnap', rows: [
    { id: '4', icon: CalendarClock, tone: 'warn', title: 'Foglalás módosítva', body: 'Balázs Noémi · Nov. 7. 18:00 → 18:30', when: '18:23', unread: false },
    { id: '5', icon: Star, tone: 'cell', title: 'Új Google-értékelés ★★★★★', body: '„Viktória csodát művelt a hajammal…”', when: '09:12', unread: false },
    { id: '6', icon: ArrowLeftRight, tone: 'warn', title: 'Beosztás módosítva', body: 'Nagy Eszter · Nov. 9. 9:00–17:00 → 10:00–18:00', when: '08:40', unread: false },
    { id: '7', icon: Lightbulb, tone: 'cell', title: 'Heti tipp', body: 'Kapcsold be az emlékeztetőt — kevesebb lesz a meg nem jelenés.', when: '08:00', unread: false },
  ] },
]
export function NotificationsInbox({ groups = SAMPLE_INBOX, total = 5, unread = 2, approvals = 1, filter = 0, onFilter, onReadAll, onClearAll, settingsHref, empty = false, className = '' }: {
  groups?: InboxGroup[]; total?: number; unread?: number
  /** jóváhagyásra váró foglalások száma (a jobb oszlop összesítőjéhez) */
  approvals?: number
  /** 0 Mind · 1 Olvasatlan · 2 Jóváhagyás */
  filter?: number; onFilter?: (i: number) => void
  onReadAll?: () => void; onClearAll?: () => void
  /** Beállítások › Értesítések */
  settingsHref?: string
  empty?: boolean
  className?: string
}) {
  const list = empty ? [] : groups
  return (
    <div className={`w-full ${className}`}>
      <PageHead title={<>Értesítések {total > 0 && <IconCircle tone="yellow" size="sm">{total}</IconCircle>}</>} />
      {/* desktop: balra a lista, jobbra (ragadósan) az összesítő, a nézet és a tömeges műveletek — az Audit-napló mintájára.
          Mobilon a nézet és a műveletek a fejléc szűrő-ikonjáról nyíló ablakban vannak (NotificationsPage). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-[5px]">
      <div className="min-w-0">
      {list.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <IconCircle tone="cell" size="lg" icon={Bell} />
          <div className="mt-3 text-ui-title font-light text-ui-text">{filter === 1 ? 'Minden értesítést elolvastál' : filter === 2 ? 'Nincs jóváhagyásra váró foglalás' : 'Nincs értesítés'}</div>
          <Meta className="mt-1">Az új foglalások, lemondások és a csapat változásai itt jelennek meg.</Meta>
        </Card>
      ) : list.map((g, gi) => (
        <div key={g.label} className={gi ? 'mt-4' : ''}>
          <div className="mb-1.5 flex items-center justify-between px-3"><Meta className="text-ui-label">{g.label}</Meta><Meta className="text-ui-label">{g.rows.length}</Meta></div>
          <Card pad="xs" className="space-y-0.5">
            {g.rows.map((r) => (
              <div key={r.id} className="group flex items-start gap-3 rounded-ui-inner px-3 py-3 transition-colors hover:bg-ui-cell/60">
                <IconCircle size="md" tone={r.tone} icon={r.icon} />
                <div className="min-w-0 flex-1">
                  {r.onOpen
                    ? <button type="button" onClick={r.onOpen} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><InboxText r={r} /></button>
                    : <InboxText r={r} />}
                  {r.extra}
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {r.unread && <span aria-label="Olvasatlan" className="h-2 w-2 rounded-full bg-ui-yellow" />}
                  <IconButton icon={X} label="Értesítés törlése" size="sm" variant="cell" onClick={r.onRemove} className="opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" />
                </span>
              </div>
            ))}
          </Card>
        </div>
      ))}
      </div>
      <aside className="max-lg:hidden lg:sticky lg:top-6">
        {/* a bal oszlop nap-címkéjével (pl. „Tegnap”) egy magasságú üres sor — így a kártyák teteje egy vonalban van */}
        {list.length > 0 && <div aria-hidden className="invisible mb-1.5 px-3"><Meta className="text-ui-label">&nbsp;</Meta></div>}
        <div className="flex flex-col gap-[5px]">
        <Card tone="dark">
          <Meta dark>Értesítések</Meta>
          <div className="mt-1 text-ui-num font-light leading-none">{total.toLocaleString('hu-HU')}</div>
          <Meta dark className="mt-2">{unread} olvasatlan · {approvals} jóváhagyásra vár</Meta>
        </Card>
        <Card pad="sm">
          <div className="px-2 pb-1 pt-1"><CardTitle>Nézet</CardTitle></div>
          {(['Mind', 'Olvasatlan', 'Jóváhagyás'] as const).map((label, i) => (
            <button key={label} type="button" onClick={() => onFilter?.(i)} className="ui-press mb-1 block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
              <ListRow filled open={filter === i} title={label} trailing={<Pill size="sm" tone={filter === i ? 'white' : 'cell'}>{[total, unread, approvals][i]}</Pill>} />
            </button>
          ))}
        </Card>
        <Card pad="sm" className="flex flex-col gap-1.5">
          <Button variant="cell" icon={CheckCheck} onClick={onReadAll} disabled={!unread}>Összes olvasott</Button>
          <Button variant="danger" icon={Trash2} onClick={onClearAll} disabled={!total}>Összes törlése</Button>
          <Button variant="ghost" icon={Settings} href={settingsHref}>Értesítési beállítások</Button>
        </Card>
        </div>
      </aside>
      </div>
    </div>
  )
}
function InboxText({ r }: { r: InboxRow }) {
  return <>
    <span className={`block text-ui-body leading-snug text-ui-text ${r.unread ? 'font-medium' : ''}`}>{r.title}</span>
    {r.body && <span className="mt-0.5 block whitespace-pre-wrap break-words text-ui-meta text-ui-muted">{r.body}</span>}
    <span className="mt-1 block text-ui-label text-ui-muted">{r.when}</span>
  </>
}
