import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bold, ChevronLeft, ChevronRight, Eye, Italic, Link2, List, Settings, X, type LucideIcon } from 'lucide-react'
import { Avatar, IconButton, IconCircle, ListRow, Pill, MarqueeText, SheetHandle } from '@/components/ui-kit'
import { EditorPublishBar as PublishBar } from './editor-publish-bar'
import { Ring } from './charts'
import { LiveStage } from './public'
import { FitCard } from '@/components/landing/FitCard'
import { BIZ_LOGO, PoweredBy } from './brand'
// a közzétételi sáv állapotot tart (nyelv-menü) — külön kliens-fájlban, hogy ez a fájl szerver-oldalon is használható maradjon
export { EditorPublishBar } from './editor-publish-bar'

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
/** A foglalóoldal-szerkesztő előnézete a landing / design mockjaiban: a VALÓDI élő oldal (LiveStage) a helyben
 *  szerkesztéssel (21.6.3) — a kijelölt leírás sárga kerettel, fölötte a gyors-sáv. Korábban egy kézzel rajzolt, régi
 *  előnézet volt; mostantól a szerkesztő változásait magától követi. `mobile`: a telefonos nézet. */
/** a landing-mock háttere: fodrászstúdió (Pexels, Emirhan Sayar) */
const NY_SALON = '/design/boritokep-szalon-ny.webp'

export function BookingPagePreview({ mobile = false, className = '' }: { mobile?: boolean; className?: string }) {
  return (
    <div className={className}>
      {mobile
        ? <FitCard w={360} className="overflow-hidden rounded-ui-card"><LiveStage mobile photo={NY_SALON} sel="desc" quick={<DescQuickBar />} /></FitCard>
        // desktopon ráközelítve: az oldal bal alsó része (név, a kijelölt leírás a gyors-sávval, a foglalás gomb) — az
        // egész oldal kicsinyítve túl apró lenne
        // desktopon az egész oldal, ahogy az élő szerkesztőben látszik (Dave képe, 2026-11-08): kijelölve az üzlet neve a
        // gyors-sávval, jobbra az üveges foglaló kártya, alul a közzétételi sáv
        : <FitCard w={1440}><div className="flex w-[1440px] flex-col items-center gap-0.5"><div className="w-full"><LiveStage photo={NY_SALON} sel="name" card="glass" quick={<NameQuickBar />} /></div><div><PublishBar changes={6} langs={[{ code: 'hu', active: true }, { code: 'en', active: false }]} /></div></div></FitCard>}
    </div>
  )
}

/** Helyben szerkesztés (design 21.6.3): a kijelölt elem fölötti sötét gyors-sáv — ugyanaz a felület, mint a közzétételi
 *  sávé. Elöl az elem neve (sárga pill), utána az elem eszközei (`children`: szövegnél félkövér, dőlt, link, szín; mezőnél
 *  kötelező, elrejt, sorrend), a végén a kijelölés vége (X). A beállítások desktopon a jobb panelen, mobilon a lapon. */
export function EditorQuickBar({ name, onClose, settings = false, onSettings, children, className = '' }: { name: string; onClose?: () => void
  /** mobil: a beállítások gombja (a lapot nyitja) az X előtt */ settings?: boolean; onSettings?: () => void; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ui-dark p-1.5 text-white shadow-ui-float [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      <Pill tone="yellow" size="sm" className="ml-0.5 shrink-0">{name}</Pill>
      {children}
      {settings && <IconButton icon={Settings} label="Beállítások" size="sm" variant="ghostDark" onClick={onSettings} className="shrink-0" />}
      <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
      <IconButton icon={X} label="Kijelölés vége" size="sm" variant="ghostDark" onClick={onClose} className="shrink-0" />
    </div>
  )
}

/** A gyors-sáv egy eszköze (ikon-gomb a sötét sávon); `on`: bekapcsolva (pl. félkövér). */
export function QuickTool({ icon, label, on = false, onClick }: { icon: LucideIcon; label: string; on?: boolean; onClick?: () => void }) {
  return <IconButton icon={icon} label={label} size="sm" variant={on ? 'onDark' : 'ghostDark'} onClick={onClick} className="shrink-0" />
}

/** A gyors-sávon a szöveg színe: pötty a jelenlegi színnel (`fill`: osztály, pl. bg-white/70) — rákattintva a színminták. */
export function QuickColor({ fill = '', css, onClick }: { fill?: string; /** élőben: a jelenlegi szín (CSS) */ css?: string; onClick?: () => void }) {
  return (
    <button type="button" aria-label="Szöveg színe" onClick={onClick} className="ui-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full"> {/* ui-allow: a szín-pötty gombja a sáv ikon-gombjainak méretében */}
      <span className={`block h-[18px] w-[18px] rounded-full ring-2 ring-white/35 ${fill}`} style={css ? { background: css } : undefined} /> {/* ui-allow: a pötty maga a választott szín */}
    </button>
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
export function EditorStepSwitch({ steps, active, onSelect, compact = false, onLabel, className = '' }: { steps: { label: string; off?: boolean; todo?: boolean }[]; active: number; /** tömör: ‹ lépés neve › (a sorszám nélkül) — szűk fejlécbe */ compact?: boolean; /** a lépés nevére koppintva (pl. a lépések listája) */ onLabel?: () => void; onSelect?: (i: number) => void; className?: string }) {
  const st = steps[active]
  return (
    <div className={`flex items-center justify-between gap-2 rounded-full bg-white/70 p-1 ${className}`}>
      <IconButton icon={ChevronLeft} label="Előző lépés" variant="cell" size="sm" disabled={active <= 0} onClick={onSelect ? () => onSelect(active - 1) : undefined} className="disabled:opacity-40" />
      {compact ? <button type="button" onClick={onLabel} disabled={!onLabel} className="ui-press min-w-0 flex-1 rounded-full px-1 text-center text-ui-meta text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20" title={`${active + 1} / ${steps.length}`}><MarqueeText className={st?.off ? 'line-through opacity-60' : ''}>{st?.label}</MarqueeText></button> : <span className="flex min-w-0 items-center gap-2 text-ui-body text-ui-text">
        <IconCircle size="xs" tone="dark">{active + 1}</IconCircle>
        <MarqueeText className={`${st?.off ? 'line-through opacity-60' : ''}`}>{st?.label}</MarqueeText>
        <span className="shrink-0 text-ui-meta text-ui-muted">{active + 1} / {steps.length}</span>
      </span>}
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

/** Minta-gyors-sáv a leírás szerkesztéséhez (félkövér, dőlt, link, szín) — a landing mockjai (borító, „Saját weboldal”)
 *  ezzel mutatják a helyben szerkesztést (21.6.3), ugyanazzal, mint a /design. */
/** Az üzlet neve kijelölve (élő szerkesztő): félkövér, dőlt, szín, fel / le a sorrendben. */
export function NameQuickBar() {
  return (
    <EditorQuickBar name="Üzlet neve">
      <QuickTool icon={Bold} label="Félkövér" /><QuickTool icon={Italic} label="Dőlt" /><QuickColor fill="bg-white" /><QuickTool icon={ArrowUp} label="Feljebb" /><QuickTool icon={ArrowDown} label="Lejjebb" />
    </EditorQuickBar>
  )
}

export function DescQuickBar({ settings = false }: { settings?: boolean }) {
  return (
    <EditorQuickBar settings={settings} name="Leírás">
      <QuickTool icon={Bold} label="Félkövér" on /><QuickTool icon={Italic} label="Dőlt" /><QuickTool icon={Link2} label="Link" /><QuickColor fill="bg-white/70" />
    </EditorQuickBar>
  )
}

/** A mobilos szerkesztő kerete (design 21.6.4): fent vissza, „Foglalóoldal”, a lépés-váltó és az Elemek; alatta az élő
 *  oldal (`children`); alul a közzétételi sáv, ha van módosítás. `sheet`: felcsúszó lap (mögötte az oldal elmosva),
 *  `pop`: felugró (pl. színminták). A /design és a landing mockja is ezt mutatja. */
export function MobileEditorFrame({ step, steps, children, sheet, pop, changes = 0 }: { step: number; steps: { label: string }[]; children: React.ReactNode; sheet?: { k: string; t: string; body: React.ReactNode }; pop?: React.ReactNode; changes?: number }) {
  return (
    <div className="relative h-[940px] w-[390px] overflow-hidden rounded-ui-container bg-ui-page p-[5px]">
      <div className="flex items-center gap-2 px-2 py-3">
        <IconButton icon={ArrowLeft} label="Vissza a Beállításokhoz" variant="cell" size="sm" />
        <span className="shrink-0 text-ui-title font-normal text-ui-text">Foglalóoldal</span>
        <EditorStepSwitch compact className="min-w-0 flex-1" active={step} steps={steps} />
        <IconButton icon={List} label="Elemek" variant="dark" size="sm" />
      </div>
      {/* saját réteg: a lap belső rétegei (pl. a felcsúszó foglaló) nem kerülnek a közzétételi sáv fölé */}
      <div className="relative z-0 flex justify-center">{children}</div>
      {pop}
      {sheet && <>
        <div className="absolute inset-0 z-30 backdrop-blur-sm" />
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-ui-card bg-white p-5 pb-8 shadow-ui-popup">
          <SheetHandle className="-mt-2 pb-3" />
          <div className="text-ui-label text-ui-muted">{sheet.k}</div>
          <div className="mt-0.5 text-ui-sub font-light text-ui-text">{sheet.t}</div>
          <div className="mt-3">{sheet.body}</div>
        </div>
      </>}
      {!sheet && changes > 0 && <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-3"><PublishBar compact langs={[{ code: 'hu', active: true }, { code: 'en', active: false }]} changes={changes} /></div>}
    </div>
  )
}

/** A szalon foglaló-lépései a mockokhoz (a /design 21.6 mintája). */
export const SALON_EDITOR_STEPS = [{ label: 'Oldal' }, { label: 'Szolgáltatás' }, { label: 'Szakember' }, { label: 'Időpont' }, { label: 'Adatok' }, { label: 'Kész' }]
