import { ArrowRight, ChevronLeft, ChevronRight, Eye, Redo2, Settings, Undo2, X, type LucideIcon } from 'lucide-react'
import { Avatar, Button, IconButton, IconCircle, ListRow, Pill } from '@/components/ui-kit'
import { Ring } from './charts'
import { BIZ_LOGO, PoweredBy } from './brand'

/* Élő szerkesztő darabjai — a /design (a régi szerkesztő képe — ma már csak a landing használja; az új: /design 21.6) és a landing („Saját bemutatkozó weboldal”) is ezeket mutatja. */

/** Böngésző-fejléc az előnézetek fölé: ablakgombok és a foglalóoldal címe. */
export function BrowserBar() {
  return (
    <div className="flex items-center gap-1.5 border-b border-ui-cell px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" /> {/* ui-allow: macOS ablakgombok (illusztráció) */}
      <Pill tone="cell" size="sm" className="mx-auto">booking.davelopment.hu/fodraszat-budapest</Pill>
    </div>
  )
}

/** A foglalóoldal desktop előnézete böngésző-keretben: borító, bemutatkozás, a kijelölt szakasz (sárga keret + lebegő
 *  mini-eszköztár), csapat, rejtett szakasz jelölése. */
export function BookingPagePreview({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
    <div className="h-full overflow-hidden rounded-ui-card bg-white">
      <BrowserBar />
      {/* oldal */}
      <div className="relative h-[150px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/teamsection/munkatarsak-davelopment-booking.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-5 flex items-end gap-3 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BIZ_LOGO} alt="" className="h-12 w-auto shrink-0" />
          <span><span className="block text-ui-title font-medium leading-tight">Fodrászat Budapest</span><span className="block text-ui-label text-white/80">VI. ker., Andrássy út 12 · ★ 4,9 (128)</span></span>
        </div>
        <Pill tone="yellow" className="absolute bottom-3 right-5">Időpontot foglalok</Pill>
      </div>
      <div className="space-y-4 p-5">
        <p className="max-w-[520px] text-ui-meta leading-relaxed text-ui-muted">Belvárosi szalon 2012 óta: vágás, festés, balayage és köröm. Kedd–Szombat, este 8-ig.</p>
        {/* kijelölt szakasz */}
        <div className="relative rounded-ui-inner border-2 border-dashed border-ui-yellow p-3">
          <span className="absolute -top-4 left-3 flex items-center gap-1 rounded-full bg-ui-dark p-1 text-white shadow-ui-float">
            <span className="px-2 text-ui-label">Szolgáltatások</span>
            {[ArrowRight, ArrowRight, Eye, Settings].map((I, i) => <span key={i} /* ui-allow: szerkesztő mikro-vezérlő */ className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"><I className={`h-3 w-3 ${i === 0 ? '-rotate-90' : i === 1 ? 'rotate-90' : ''}`} /></span>)}
          </span>
          <div className="mb-2 mt-1 text-ui-body font-medium text-ui-dark">Szolgáltatások</div>
          <div className="grid grid-cols-2 gap-2">
            {[['Női hajvágás', '60 p', '11 900 Ft'], ['Balayage', '150 p', '48 000 Ft'], ['Festés', '90 p', '22 000 Ft'], ['Géllakk', '60 p', '8 500 Ft']].map(([n, d, p]) => (
              <div key={n} /* ui-allow: a vendég-oldal előnézete, nem dashboard-elem */ className="flex items-center justify-between rounded-ui-control bg-ui-cell px-3 py-2 text-ui-label"><span className="text-ui-dark">{n}<span className="ml-1.5 text-ui-muted">{d}</span></span><span className="text-ui-dark">{p}</span></div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-ui-body font-medium text-ui-dark">Csapat</div>
          <div className="flex gap-3">
            {['viktoria', 'csaba', 'szabina', 'dave'].map((a) => (
              <span key={a} className="flex flex-col items-center gap-1 text-ui-label text-ui-muted">
                <Avatar size="lg" src={`/landing/funkciok/csapat/avatar/${a}.webp`} />
                {({ viktoria: 'Viktória', csaba: 'Csaba', szabina: 'Szabina', dave: 'Dávid' } as Record<string, string>)[a]}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-ui-control border border-dashed border-ui-grey px-3 py-2.5 text-ui-label text-ui-muted">Értékelések — rejtett szakasz (a vendég nem látja)</div>
        {/* a foglalóoldal alján mindig: a rendszer jele (terjedés) */}
        <div className="flex justify-center border-t border-dashed border-ui-divider pt-3"><PoweredBy /></div>
      </div>
    </div>
    </div>
  )
}

/** A szerkesztő alsó sávja: visszavonás / újra, nyelvek, módosítások száma, Közzététel. Élőben `onUndo` / `onRedo`
 *  (`canUndo` / `canRedo`), `langs` + `onLang` (a szerkesztett nyelv), `changes`, `onPublish` (`busy`). */
export function EditorPublishBar({ onUndo, onRedo, canUndo = true, canRedo = false, langs = [{ code: 'hu', active: true }, { code: 'en', active: false }, { code: 'de', active: false }], onLang, changes = 3, onPublish, busy = false, publishLabel = 'Közzététel' }: {
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean
  langs?: { code: string; active: boolean }[]; onLang?: (code: string) => void
  changes?: number; onPublish?: () => void; busy?: boolean; publishLabel?: string
}) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ui-dark p-1.5 text-white shadow-ui-float">
      <IconButton icon={Undo2} label="Visszavonás" size="sm" variant="ghostDark" onClick={onUndo} disabled={!canUndo} className="disabled:opacity-40" />
      <IconButton icon={Redo2} label="Újra" size="sm" variant="ghostDark" onClick={onRedo} disabled={!canRedo} className="disabled:opacity-40" />
      {langs.length > 1 && <>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
        {langs.map((l) => onLang
          ? <button key={l.code} type="button" onClick={() => onLang(l.code)} aria-pressed={l.active} className="ui-press shrink-0 rounded-full"><Pill tone={l.active ? 'onDark' : 'ghostDark'}>{l.code.toUpperCase()}</Pill></button>
          : <Pill key={l.code} tone={l.active ? 'onDark' : 'ghostDark'}>{l.code.toUpperCase()}</Pill>)}
      </>}
      <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
      <span className="mr-1 shrink-0 text-ui-meta text-white/55">{changes ? `${changes} módosítás` : 'Nincs módosítás'}</span>
      <Button variant="yellow" onClick={onPublish} loading={busy} disabled={!changes} className="shrink-0">{publishLabel}</Button>
    </div>
  )
}

/* ── A szerkesztő jobb paneljének építőkockái (design 21.6) — a design oldal és az élő szerkesztő is ezeket használja.
 *  Szabályok: egy beállítás = egy sor (balra a neve, jobbra a vezérlő, köztük szaggatott vonal); igen/nem = kapcsoló;
 *  egy választás = Segmented; több választás = pillek pipával; szín = kör-minták; minden vezérlő 36 px. ── */

/** Egy beállítás-sor: balra a neve (alatta opcionális tipp), jobbra a vezérlő; az elsőn nincs vonal. */
export function EditorRow({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-dashed border-ui-divider py-1.5 first:border-t-0">
      <span className="min-w-0"><span className="block text-ui-body text-ui-muted">{label}</span>{hint && <span className="block text-ui-label text-ui-muted">{hint}</span>}</span>
      {children}
    </div>
  )
}

/** Csoport-cím a panelen belül (pl. Betűszín), alatta a sorai. */
export function EditorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-dashed border-ui-divider pt-3 first:border-t-0 first:pt-0">
      <span className="text-ui-label text-ui-muted">{title}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** Szín-minták körként: `fills` osztály (pl. bg-white) vagy hex szín; a kiválasztott sötét gyűrűt kap. Élőben `onSelect`
 *  (a minta indexe) és `add` (saját szín — a gomb tartalma, pl. egy színválasztó). */
export function Swatches({ fills, on, onSelect, add }: { fills: string[]; on: number; onSelect?: (i: number) => void; add?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {fills.map((c, i) => {
        const dot = <span className={`block h-7 w-7 rounded-full ${c.startsWith('#') ? '' : c} ${i === on ? 'ring-2 ring-ui-dark ring-offset-2' : 'ring-1 ring-ui-divider'}`} style={c.startsWith('#') ? { background: c } : undefined} /> // ui-allow: szín-minta kör (a minta maga a szín)
        return onSelect ? <button key={c + i} type="button" aria-pressed={i === on} onClick={() => onSelect(i)} className="ui-press rounded-full">{dot}</button> : <span key={c + i}>{dot}</span>
      })}
      {add}
    </span>
  )
}

/** A foglalás lépés-sávja a szerkesztő tetején (Oldal · Szolgáltatás · … · Kész): a kiválasztott sötét; `off`: kikapcsolt
 *  lépés (áthúzva), `todo`: ott van még teendő (sárga pötty). Élőben `onSelect`. */
/** A lépés-sáv keskeny kijelzőn: előző / következő gomb, középen a lépés sorszáma és neve („2 / 7 · Szolgáltatás”). */
export function EditorStepSwitch({ steps, active, onSelect, className = '' }: { steps: { label: string; off?: boolean; todo?: boolean }[]; active: number; onSelect?: (i: number) => void; className?: string }) {
  const st = steps[active]
  return (
    <div className={`flex items-center justify-between gap-2 rounded-full bg-white/70 p-1 ${className}`}>
      <IconButton icon={ChevronLeft} label="Előző lépés" variant="cell" size="sm" disabled={active <= 0} onClick={onSelect ? () => onSelect(active - 1) : undefined} className="disabled:opacity-40" />
      <span className="flex min-w-0 items-center gap-2 text-ui-body text-ui-text">
        <IconCircle size="xs" tone="dark">{active + 1}</IconCircle>
        <span className={`truncate ${st?.off ? 'line-through opacity-60' : ''}`}>{st?.label}</span>
        <span className="shrink-0 text-ui-meta text-ui-muted">{active + 1} / {steps.length}</span>
      </span>
      <IconButton icon={ChevronRight} label="Következő lépés" variant="cell" size="sm" disabled={active >= steps.length - 1} onClick={onSelect ? () => onSelect(active + 1) : undefined} className="disabled:opacity-40" />
    </div>
  )
}

export function EditorStepBar({ steps, active, onSelect, className = '' }: { steps: { label: string; off?: boolean; todo?: boolean; title?: string }[]; active: number; onSelect?: (i: number) => void; className?: string }) {
  return (
    // egy sorban marad, keskeny kijelzőn oldalra görgethető (nem törik két sorba)
    <div className={`flex items-center gap-1 overflow-x-auto rounded-full bg-white/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {steps.map((st, i) => {
        const pill = (
          <Pill tone={i === active ? 'dark' : 'ghost'} className={st.off ? 'line-through opacity-60' : ''}>
            <IconCircle size="xs" tone={i === active ? 'onDark' : 'cell'}>{i + 1}</IconCircle>{st.label}
          </Pill>
        )
        return (
          <span key={st.label} className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            {i > 0 && <ArrowRight className="h-3 w-3 shrink-0 text-ui-muted/40" />}
            <span title={st.title} className="relative">
              {onSelect ? <button type="button" onClick={() => onSelect(i)} className="ui-press rounded-full">{pill}</button> : pill}
              {st.todo && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ui-yellow" />}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** A szerkesztő default nézete (még nincs kijelölve semmi): mennyire kész az oldal (gyűrű), alatta a részek az
 *  állapotukkal — a teendősök sárga ikonnal, rákattintva a beállításuk nyílik —, alul a megosztás. */
export function EditorOverview({ parts, onOpen, share }: { parts: { id: string; icon: LucideIcon; title: string; status: string; todo?: boolean }[]; onOpen?: (id: string) => void; share?: React.ReactNode }) {
  const done = parts.filter((p) => !p.todo).length
  return (
    <>
      <div className="flex items-center gap-4">
        <Ring pct={parts.length ? Math.round((done / parts.length) * 100) : 0} size={72}><span className="text-ui-row text-ui-text">{done}/{parts.length}</span></Ring>
        <span><span className="block text-ui-sub font-light leading-tight text-ui-text">{done === parts.length ? 'Kész' : 'Majdnem kész'}</span><span className="mt-0.5 block text-ui-label text-ui-muted">{done === parts.length ? 'Minden rész be van állítva.' : `${parts.length - done} helyen javíthatsz még — kattints rá.`}</span></span>
      </div>
      <div className="mt-3">
        {parts.map((p) => {
          const row = <ListRow className="px-0" leading={<IconCircle tone={p.todo ? 'yellow' : 'cell'} size="sm" icon={p.icon} />} title={p.title} meta={p.status} trailing={<ChevronRight className="h-4 w-4 text-ui-muted" />} />
          return onOpen ? <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="block w-full text-left">{row}</button> : <div key={p.id}>{row}</div>
        })}
      </div>
      {share && <EditorGroup title="Megosztás">{share}</EditorGroup>}
    </>
  )
}

/** A jobb panel fejléce egy kijelölt elemhez: „Kijelölt elem” + név, bezárás; alul a tipp. */
export function EditorPanel({ title, onClose, note, children }: { title: string; onClose?: () => void; note?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div><div className="text-ui-label text-ui-muted">Kijelölt elem</div><div className="mt-0.5 text-ui-sub font-light text-ui-text">{title}</div></div>
        <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} />
      </div>
      <div className="mt-4">{children}</div>
      {note && <div className="mt-3 border-t border-dashed border-ui-divider pt-3 text-ui-label text-ui-muted">{note}</div>}
    </>
  )
}
