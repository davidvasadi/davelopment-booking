import { ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Search, TriangleAlert, Upload, X, type LucideIcon, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export { SpringPopover } from './SpringPopover'
export { CountText, GrowSegments, useLoadProgress, LOAD_MS } from './LoadAnim'
import { CountText, GrowSegments } from './LoadAnim'
import { Children, Fragment } from 'react'
export { SlideSwap, SLIDE_SPRING } from './SlideSwap'
export { Collapse } from './Collapse'

/**
 * Közös UI-készlet — a dashboard egyetlen építőkészlete (minta: /design, „Alap” fül).
 * Szín, lekerekítés, betűméret és árnyék csak a Tailwind `ui-*` skálájából jöhet; a komponensek
 * kívülről csak VÁLTOZATOT kapnak (tone / size / variant), nyers színt vagy méretet nem.
 * A `className` csak elrendezésre való (margó, szélesség, flex) — kinézetre nem.
 */

type Children = { children?: React.ReactNode; className?: string }

/* ── Felületek ─────────────────────────────────────────────────────────────── */

const CARD_TONE = {
  glass: 'bg-white/60 backdrop-blur-lg',
  dark: 'bg-ui-dark text-white',
  white: 'bg-white',
  cell: 'bg-ui-cell',
} as const
const CARD_PAD = { none: '', xs: 'p-2', sm: 'p-3', md: 'p-5', lg: 'p-6' } as const

/** Kártya: krém-üveg (alap), sötét (oldalanként max. egy), fehér (popup / űrlap-lap), cella (kártyán belül).
 *  Árnyéka nincs — árnyék csak a lebegő elemen (shadow-ui-float) és a popupon (shadow-ui-popup) van. */
export function Card({ tone = 'glass', pad = 'md', inner = false, children, className }: Children & { tone?: keyof typeof CARD_TONE; pad?: keyof typeof CARD_PAD; inner?: boolean }) {
  return <div className={cn(inner ? 'rounded-ui-inner' : 'rounded-ui-card', CARD_TONE[tone], CARD_PAD[pad], className)}>{children}</div>
}

/* ── Szöveg ────────────────────────────────────────────────────────────────── */

export function PageTitle({ children, className }: Children) {
  return <h1 className={cn('text-ui-page font-light text-ui-text', className)}>{children}</h1>
}
export function CardTitle({ children, className, dark = false }: Children & { dark?: boolean }) {
  return <div className={cn('text-ui-title font-normal', dark ? 'text-white' : 'text-ui-text', className)}>{children}</div>
}
export function BigNumber({ children, className, dark = false }: Children & { dark?: boolean }) {
  return <div className={cn('text-ui-num font-light', dark ? 'text-white' : 'text-ui-text', className)}>{children}</div>
}
export function Meta({ children, className, dark = false }: Children & { dark?: boolean }) {
  return <div className={cn('text-ui-meta', dark ? 'text-white/55' : 'text-ui-muted', className)}>{children}</div>
}

/** Nagy szám a fejlécben: ikon + szám + címke (Crextio). `md` desktopon, `sm` mobilon / szűk helyen.
 *  Minden fejléc-szám ez (a régi dashboard HeroKpi helyett). */
export function Kpi({ icon: Icon, value, label, size = 'md', className }: { icon: LucideIcon; value: React.ReactNode; label: string; size?: 'md' | 'sm'; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      {/* md mobilon a kompakt méret (a design 4.4), lg-től a nagy */}
      <div className={cn('flex items-center', size === 'md' ? 'gap-1.5 lg:gap-2.5' : 'gap-1.5')}>
        <Icon className={cn('shrink-0 text-ui-muted', size === 'md' ? 'h-4 w-4 lg:h-6 lg:w-6' : 'h-4 w-4')} strokeWidth={1.6} />
        <span data-kpi-num className={cn('whitespace-nowrap font-light leading-none text-ui-text', size === 'md' ? 'text-ui-sub lg:text-ui-page' : 'text-ui-sub')}>{typeof value === 'string' || typeof value === 'number' ? <CountText text={String(value)} /> : value}</span>
      </div>
      <div className={cn('whitespace-nowrap text-ui-muted', size === 'md' ? 'mt-1 text-ui-label lg:mt-1.5 lg:text-ui-meta' : 'mt-1 text-ui-label')}>{label}</div>
    </div>
  )
}

/** Az oldalak teteje — minden oldalon ugyanez a ritmus (/design 2.2): a menüsor (`nav`, csak a mintákon — élesben
 *  az AppShell adja), alatta a nagy cím és alatta egy sor alcím (dátum, üzlet vagy rövid leírás), jobbra a gombok mindig
 *  ebben a sorrendben: nézet-váltók → másodlagos (üveg) gombok → a fő gomb (sárga, „+ Új …”) a végén.
 *  `back`: aloldalon a cím helyett morzsa (vissza · Szülő › Aktuális), `onBack` a vissza-gomb művelete.
 *  `bar` + `kpis`: a fejléc alatti sáv — balra a megoszlás-csík, jobbra a nagy számok. Alatta mindig ugyanakkora a hely.
 *  Cím nélkül (csak `bar` + `kpis`) az „étterem — csak az eltérések” minták sávja. */
/** Hány nagy szám van a sorban (a fragmentben a ténylegesen megjelenő elemek — a feltételes `false`-ok nélkül). */
function kpiCount(kpis: React.ReactNode): number {
  const el = kpis as React.ReactElement<{ children?: React.ReactNode }> | null
  const inner = el && typeof el === 'object' && 'props' in el && el.type === Fragment ? el.props.children : kpis
  return Children.toArray(inner).length
}

export function PageHead({ nav, title, sub, actions, back, onBack, bar, kpis, className }: { nav?: React.ReactNode; title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; back?: [string, string]; onBack?: () => void; bar?: React.ReactNode; kpis?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6', className)}>
      {nav}
      {!title && !back ? null : back ? (
        <div className={cn('flex items-center gap-2', nav && 'mt-6')}>
          <IconButton icon={ArrowLeft} size="sm" label={`Vissza: ${back[0]}`} onClick={onBack} />
          <span className="text-ui-meta text-ui-muted">{back[0]}</span><span className="text-ui-meta text-ui-muted">›</span><span className="text-ui-body text-ui-text">{back[1]}</span>
        </div>
      ) : (
        <div className={cn('flex flex-wrap items-end justify-between gap-3', nav && 'mt-6')}>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-ui-num font-light leading-none text-ui-text lg:text-ui-page">{title}</h1>
            {sub && <div className="mt-2 max-w-[560px] text-ui-body text-ui-muted">{sub}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
      )}
      {(bar || kpis) && (
        <div className={cn('flex flex-wrap items-end justify-between gap-6', (title || back) && 'mt-6')}>
          {/* mobilon a csík teljes szélességű, a nagy számok alatta egy sorban, telefon-szélességben elosztva (design 4.4) —
              max. 420px, hogy szélesebb képernyőn ne húzódjanak szét */}
          <div className="w-full min-w-0 lg:w-auto lg:max-w-[620px] lg:flex-1">{bar}</div>
          {/* mobilon legfeljebb 3 szám nagyobban (kifér) — 4-nél a kompakt méret marad */}
          {kpis && <div className={cn('flex w-full max-w-[420px] items-start justify-between gap-3 lg:w-auto lg:max-w-none lg:justify-start lg:gap-8', kpiCount(kpis) <= 3 && 'max-lg:[&_[data-kpi-num]]:text-ui-num')}>{kpis}</div>}
        </div>
      )}
    </div>
  )
}

/* ── Pill és státusz ───────────────────────────────────────────────────────── */

const PILL_TONE = {
  dark: 'bg-ui-dark text-white',
  yellow: 'bg-ui-yellow text-ui-dark',
  grey: 'bg-ui-grey text-ui-dark',
  // sötétebb szürke (a halvány-szöveg színe háttérként) — az összefüggő SegmentBar harmadik fokozatához
  muted: 'bg-ui-muted text-white',
  cell: 'bg-ui-cell text-ui-text',
  white: 'bg-white text-ui-text',
  glass: 'bg-white/70 text-ui-text',
  // sötét kártyán
  onDark: 'bg-white/10 text-white',
  outline: 'border-[1.5px] border-ui-dark text-ui-dark',
  // csíkos: a fehér csíkok átfutnak a betűn → félkövér + halvány fehér kiemelés a betű mögött (ui-hatch-text)
  hatch: 'ui-hatch ui-hatch-text font-medium text-ui-text',
  // naptár-cella csík (szürke vonalak) — a hónapon kívüli napokhoz
  hatchCell: 'ui-hatch-cell text-ui-muted',
  // szegmens / váltó inaktív eleme
  ghost: 'text-ui-muted',
  ghostDark: 'text-white/60',
} as const
const PILL_SIZE = { sm: 'h-7 px-2.5 text-ui-label', md: 'h-9 px-3.5 text-ui-meta', lg: 'h-12 px-4 text-ui-body' } as const

/** Pill: minden kerek címke / érték-doboz. Hosszú tartalom egy sorban marad (levágódik). */
const pillClass = (tone: keyof typeof PILL_TONE = 'cell', size: keyof typeof PILL_SIZE = 'md') => cn('inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full', PILL_TONE[tone], PILL_SIZE[size])

export function Pill({ tone = 'cell', size = 'md', icon: Icon, children, className }: Children & { tone?: keyof typeof PILL_TONE; size?: keyof typeof PILL_SIZE; icon?: LucideIcon }) {
  return (
    <span className={cn(pillClass(tone, size), className)}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />}
      {children}
    </span>
  )
}

const STATUS = {
  confirmed: { cls: 'bg-ui-dark text-white', dot: 'bg-ui-yellow' },
  pending: { cls: 'bg-ui-yellow text-ui-dark', dot: 'bg-ui-dark' },
  ok: { cls: 'bg-ui-ok-bg text-ui-ok', dot: 'bg-ui-ok-dot' },
  warn: { cls: 'bg-ui-warn-bg text-ui-warn', dot: 'bg-ui-warn-dot' },
  bad: { cls: 'bg-ui-bad-bg text-ui-bad', dot: 'bg-ui-bad-dot' },
  neutral: { cls: 'bg-ui-neutral-bg text-ui-neutral', dot: 'bg-ui-muted' },
} as const
export type Status = keyof typeof STATUS

/** Státusz-pill ponttal: megerősített / függő (1. szint színei) és a riasztások (ok / warn / bad / neutral). */
export function StatusPill({ status, children, className }: Children & { status: Status }) {
  const s = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-ui-label font-medium', s.cls, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {children}
    </span>
  )
}

/** Foglalás-blokk (1. szint: naptár, idővonal) kinézete: megerősített sötét, függő sárga, befejezett szürke, hamarosan körvonal. */
export const BLOCK_TONE = {
  ok: 'bg-ui-dark text-white',
  pending: 'bg-ui-yellow text-ui-dark',
  done: 'bg-ui-grey text-ui-dark',
  soon: 'border-[1.5px] border-ui-dark bg-white/60 text-ui-dark',
} as const
export function blockTone(status: string) {
  return BLOCK_TONE[status as keyof typeof BLOCK_TONE] ?? BLOCK_TONE.ok
}

/* ── Gombok ────────────────────────────────────────────────────────────────── */

const BTN_VARIANT = {
  dark: 'bg-ui-dark text-white',
  yellow: 'bg-ui-yellow text-ui-dark',
  glass: 'bg-white/70 text-ui-text',
  cell: 'bg-ui-cell text-ui-text',
  danger: 'bg-ui-bad-dot text-white',
  // sötét kártyán
  onDark: 'bg-white/10 text-white',
  // menüsor / fül inaktív eleme
  ghost: 'text-ui-text',
  // sötét eszköztáron (visszavonás, bezárás)
  ghostDark: 'text-white/80',
  // gyors döntés (jóváhagy / elutasít)
  ok: 'bg-ui-ok-bg text-ui-ok',
  bad: 'bg-ui-bad-bg text-ui-bad',
} as const
const BTN_SIZE = { sm: 'h-9 px-3.5 text-ui-meta', md: 'h-11 px-5 text-ui-body', lg: 'h-12 px-4 text-ui-body' } as const

/** Gomb: minden gomb pill. Sötét = elsődleges, sárga = kiemelt, üveg / cella = másodlagos, danger = csak visszafordíthatatlan lépés. */
const buttonClass = (variant: keyof typeof BTN_VARIANT = 'dark', size: keyof typeof BTN_SIZE = 'md') => cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium outline-none ui-press focus-visible:ring-2 focus-visible:ring-ui-dark/25 disabled:opacity-50', BTN_VARIANT[variant], BTN_SIZE[size])

type LinkProps = { /** ha meg van adva, a gomb link (next/link), ugyanazzal a kinézettel */ href?: string; /** fájl letöltése (sima <a download>) */ download?: boolean }
type BtnAttrs = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
/** A gomb vagy link — `href`-fel link, különben <button>. */
function ButtonOrLink({ href, download, className, children, rest }: LinkProps & { className: string; children: React.ReactNode; rest: BtnAttrs }) {
  if (href) {
    // a linkre csak a link-értelmes attribútumok mennek át (címke, cím, kattintás, data-* — pl. a Bevezető data-tour jelölője)
    const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('data-')))
    const a = { ...data, className, 'aria-label': rest['aria-label'], title: rest.title, onClick: rest.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> }
    return download ? <a href={href} download {...a}>{children}</a> : <Link href={href} {...a}>{children}</Link>
  }
  return <button type="button" {...rest} className={className}>{children}</button>
}

/** `loading`: töltés közben forgó jel az ikon helyén, a gomb nem nyomható. */
export function Button({ variant = 'dark', size = 'md', icon: Icon, loading = false, href, download, children, className, ...rest }: Children & LinkProps & { variant?: keyof typeof BTN_VARIANT; size?: keyof typeof BTN_SIZE; icon?: LucideIcon; loading?: boolean } & BtnAttrs) {
  return (
    <ButtonOrLink href={href} download={download} rest={loading ? { ...rest, disabled: true, 'aria-busy': true } : rest} className={cn(buttonClass(variant, size), className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
      {children}
    </ButtonOrLink>
  )
}

// lg = 48px, mint az Avatar lg — a mobil fejlécben minden kerek elem (+, csengő, avatar) egy méret
const ICONBTN_SIZE = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' } as const
/** Kör ikon-gomb (↗, +, szűrő…). `dot`: sárga jelző-pötty a jobb felső részen (pl. olvasatlan értesítés a csengőn). */
const iconButtonClass = (variant: keyof typeof BTN_VARIANT = 'glass', size: keyof typeof ICONBTN_SIZE = 'md') => cn('relative inline-flex shrink-0 items-center justify-center rounded-full outline-none ui-press focus-visible:ring-2 focus-visible:ring-ui-dark/25', BTN_VARIANT[variant], ICONBTN_SIZE[size])

export function IconButton({ icon: Icon, variant = 'glass', size = 'md', label, dot = false, href, download, className, ...rest }: LinkProps & { icon: LucideIcon; variant?: keyof typeof BTN_VARIANT; size?: keyof typeof ICONBTN_SIZE; label: string; dot?: boolean; className?: string } & BtnAttrs) {
  return (
    <ButtonOrLink href={href} download={download} rest={{ ...rest, 'aria-label': label, title: label }} className={cn(iconButtonClass(variant, size), className)}>
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      {dot && <span className="absolute right-[26%] top-[26%] h-2 w-2 rounded-full bg-ui-yellow ring-2 ring-white" />}
    </ButtonOrLink>
  )
}

/** Keresőmező: fehér pill, nagyító + halvány helyőrző. A szélességet a hívó adja (className). */
export function SearchField({ children = 'Keresés…', value, onChange, autoFocus = false, className }: Children & { /** élő mező: az érték és a változás; nélkülük minta (a `children` a felirat) */ value?: string; onChange?: (v: string) => void; /** megnyitáskor rögtön bele lehet gépelni (pl. a fejléc kereső-ikonjáról) */ autoFocus?: boolean }) {
  if (onChange) {
    return (
      <label className={cn('inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-ui-body text-ui-muted', className)}>
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <input type="search" autoComplete="off" autoFocus={autoFocus} data-1p-ignore data-lpignore="true" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={typeof children === 'string' ? children : undefined} className="min-w-0 flex-1 bg-transparent text-ui-text outline-none placeholder:text-ui-muted [&::-webkit-search-cancel-button]:hidden" />
        {value && <button type="button" aria-label="Keresés törlése" onClick={() => onChange('')} className="shrink-0 text-ui-muted hover:text-ui-text"><X className="h-4 w-4" strokeWidth={1.8} /></button>}
      </label>
    )
  }
  return (
    <span className={cn('inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-ui-body text-ui-muted', className)}>
      <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      <MarqueeText>{children}</MarqueeText>
    </span>
  )
}

/* ── Szegmensek ────────────────────────────────────────────────────────────── */

export type Segment = { label: string; value: React.ReactNode; weight: number; tone: 'dark' | 'yellow' | 'grey' | 'white' | 'muted' | 'hatch' | 'hatchCell' | 'outline' }

/** Széles szegmentált csík (Crextio-fejléc): címke felül, arányos szélességű pillek. */
/**  `joined`: összefüggő változat (Crextio „Onboarding”): a szegmensek összeérnek, magasabbak, és a határoknál vékony
 *  függőleges vonal fut fel a címkéig — haladás / megoszlás egy kártyán belül (pl. Teendők). */
export function SegmentBar({ segments, size = 'lg', joined = false, active, onSelect, className }: { segments: Segment[]; size?: 'md' | 'lg'; joined?: boolean; /** joined + onSelect: a szegmensek fülek (pl. Teendők: Mai / Holnapi / Korábbi), az aktív kissé kiemelkedik */ active?: number; onSelect?: (i: number) => void; className?: string }) {
  if (joined) {
    return (
      <div className={cn('flex min-w-0 items-end', className)}>
        {segments.map((s, i) => {
          const body = (
            <>
              {i > 0 && <span className="absolute inset-y-0 left-0 z-10 w-px bg-ui-dark" />}
              <div className="whitespace-nowrap pb-2 pl-2 text-left text-ui-label text-ui-text">{s.label}</div>
              {/* fülként: az aktív kiemelkedik — a Teendők lap-stackjével azonos ütemben */}
              <div className={cn('flex h-14 items-center rounded-ui-inner px-4 text-ui-body transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform', PILL_TONE[s.tone], active === i && '-translate-y-1')}>{s.value}</div>
            </>
          )
          const style = { flex: `${s.weight} 1 0%`, transition: 'flex-grow .5s cubic-bezier(.22,1,.36,1)' }
          return onSelect
            ? <button key={`${s.label}-${i}`} type="button" onClick={() => onSelect(i)} aria-pressed={active === i} className="relative min-w-[64px] rounded-ui-inner outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20" style={style}>{body}</button>
            : <div key={`${s.label}-${i}`} className="relative min-w-0" style={style}>{body}</div>
        })}
      </div>
    )
  }
  // betöltéskor a pillek 0-ról nőnek, a számok felszámolnak (LoadAnim — a régi Áttekintés viselkedése, egy ütemben a grafikonokkal)
  return <GrowSegments segments={segments} size={size} className={className} />
}

const SEG_TONE = { glass: 'bg-white/70', cell: 'bg-ui-cell' } as const
// md: fix 44px (mint a Button / SearchField / Input) — egy eszköztárban minden elem egy magas
// sm: összesen 36px (h-9), mint a kis gomb / kis mező — egy beállítás-sorban a váltó és a mező egy magas
const SEG_SIZE = { sm: 'h-8 px-3 text-ui-meta', md: 'h-9 px-4 text-ui-body' } as const

/** Szegmentált váltó (Nap / Hét / Hónap). Krém felületen üveg, fehér kártyán cella alap; `sm` a sorokba; `full`: a teljes
 *  szélességet kitölti, a részek egyenlően osztoznak (keskeny popupban, pl. a nap-szerkesztő típusa).
 *  Megjelenítés; az állapotot a hívó kezeli. */
export function Segmented({ options, active, onSelect, tone = 'glass', size = 'md', full = false, className }: { options: readonly string[]; active: number; onSelect?: (i: number) => void; tone?: keyof typeof SEG_TONE; size?: keyof typeof SEG_SIZE; full?: boolean; className?: string }) {
  return (
    <div className={cn(full ? 'relative flex w-full' : 'inline-flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', 'items-center rounded-full', size === 'sm' ? 'h-9 p-0.5' : 'h-11 p-1', SEG_TONE[tone], className)}>
      {/* teljes szélességben (egyforma fülek) a sötét jelölő átcsúszik a kiválasztottra */}
      {full && active >= 0 && (
        <span aria-hidden className={cn('pointer-events-none absolute rounded-full bg-ui-dark transition-transform duration-300 ease-out', size === 'sm' ? 'inset-y-0.5 left-0.5' : 'inset-y-1 left-1')}
          style={{ width: `calc((100% - ${size === 'sm' ? 4 : 8}px) / ${options.length})`, transform: `translateX(${active * 100}%)` }} />
      )}
      {options.map((o, i) => (
        <button key={o} type="button" onClick={onSelect ? () => onSelect(i) : undefined} className={cn('ui-press whitespace-nowrap rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20', SEG_SIZE[size], full && 'relative min-w-0 flex-1 px-1', i === active ? (full ? 'text-white' : 'bg-ui-dark text-white') : 'text-ui-muted')}>{o}</button>
      ))}
    </div>
  )
}

/** Oldalsó menü-sor (Beállítások, szerkesztő-panelek): ikon körben + felirat; az aktív sötét. */
export function NavItem({ icon: Icon, active = false, trailing, children, className }: Children & { icon?: LucideIcon; active?: boolean; trailing?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 text-ui-body', active ? 'bg-ui-dark text-white' : 'text-ui-text', className)}>
      {Icon && <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', active ? 'bg-white/15' : 'bg-white/70')}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></span>}
      <TextLine className="flex-1">{children}</TextLine>
      {trailing}
    </div>
  )
}

/* ── Sorok ─────────────────────────────────────────────────────────────────── */

/** Űrlap-sor: címke balra, érték / vezérlő jobbra, szaggatott elválasztó (az elsőnél nincs).
 *  `stacked`: címke felül, tartalom alatta teljes szélességben (chip-sorhoz, hosszabb tartalomhoz).
 *  `boxed`: popupban — cella-színű doboz elválasztó helyett (pl. „Értesítés a vendégnek” + kapcsoló). */
export function FieldRow({ label, hint, stacked = false, boxed = false, children, className }: Children & { label: string; hint?: React.ReactNode; stacked?: boolean; boxed?: boolean }) {
  return (
    <div className={cn(boxed ? 'rounded-ui-control bg-ui-cell px-3 py-2.5 [&+&]:mt-1' : 'border-t border-dashed border-ui-divider py-2.5 first:border-t-0', stacked ? 'space-y-2' : cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', !boxed && 'min-h-[52px]'), className)}>
      {/* a felirat (és a hint) inkább sort tör, a vezérlő jobbra marad — csak ha a vezérlő a sor 8rem-en túli részébe sem
          fér (széles váltó), akkor kerül a felirat alá */}
      <span className={cn('block min-w-0', !stacked && 'flex-[1_1_8rem]')}>
        <span className={cn('block text-ui-body', boxed ? 'text-ui-text' : 'text-ui-muted')}>{label}</span>
        {hint && <span className="block text-ui-label text-ui-muted">{hint}</span>}
      </span>
      {/* keskeny kijelzőn a széles vezérlő (pl. sok opciós váltó) a felirat alá törik, nem lóg ki */}
      <div className={stacked ? 'flex flex-wrap gap-1' : 'ml-auto min-w-0 max-w-full'}>{children}</div>
    </div>
  )
}

const CIRCLE_SIZE = { xs: 'h-5 w-5 text-ui-label', sm: 'h-7 w-7 text-ui-label', md: 'h-9 w-9 text-ui-meta', lg: 'h-12 w-12 text-ui-body' } as const
const CIRCLE_TONE = { dark: 'bg-ui-dark text-white', yellow: 'bg-ui-yellow text-ui-dark', white: 'bg-white text-ui-text', glass: 'bg-white/70 text-ui-text', cell: 'bg-ui-cell text-ui-text', onDark: 'bg-white/15 text-white', bad: 'bg-ui-bad-bg text-ui-bad', ok: 'bg-ui-ok-bg text-ui-ok', warn: 'bg-ui-warn-bg text-ui-warn' } as const
export type CircleTone = keyof typeof CIRCLE_TONE
/** Kerek jelvény (nem gomb): ikon vagy rövid szöveg körben — lépésszám, mai dátum, asztal-szám, darabszám, popup-ikon.
 *  Kattintható kör ikonhoz az IconButton. */
export function IconCircle({ icon: Icon, children, tone = 'dark', size = 'sm', className }: { icon?: LucideIcon; children?: React.ReactNode; tone?: keyof typeof CIRCLE_TONE; size?: keyof typeof CIRCLE_SIZE; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full', CIRCLE_SIZE[size], CIRCLE_TONE[tone], className)}>
      {Icon ? <Icon className={size === 'lg' ? 'h-5 w-5' : size === 'xs' ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={1.8} /> : children}
    </span>
  )
}

const AVATAR_SIZE = { xs: 'h-6 w-6', sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' } as const
const AVATAR_TEXT = { xs: 'text-ui-label', sm: 'text-ui-label', md: 'text-ui-meta', lg: 'text-ui-body' } as const
/** Avatar: mindig kör, fotó felülről vágva; fotó nélkül halvány kör — ha `name` adott, benne a monogram (hogy fotó
 *  nélkül is felismerhető legyen, ki az). */
export function Avatar({ src, name, size = 'md', className }: { src?: string | null; name?: string | null; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  const ini = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  if (!src) return <span title={name ?? undefined} className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-ui-cell text-ui-muted', AVATAR_SIZE[size], AVATAR_TEXT[size], className)}>{ini}</span>
  // névvel: a monogram a kép alatt — ha a kép átlátszó (pl. Gravatar profilkép nélkül), a monogram látszik
  // eslint-disable-next-line @next/next/no-img-element
  if (!name) return <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover object-top', AVATAR_SIZE[size], className)} />
  return (
    <span title={name} className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-cell text-ui-muted', AVATAR_SIZE[size], AVATAR_TEXT[size], className)}>
      {ini}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
    </span>
  )
}

/** Lista-sor: avatar / ikon, cím + alcím, jobbra érték vagy státusz. Saját háttérrel (`filled`) 4px rés kell köztük.
 *  `open`: épp megnyitott sor (a részlete mellette látszik) — sárga, egyszerre csak egy. */
export function ListRow({ leading, title, meta, trailing, filled = false, open = false, className }: { leading?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode; filled?: boolean; open?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5', filled || open ? cn('rounded-ui-inner', open ? 'bg-ui-yellow' : 'bg-white/70') : 'border-t border-dashed border-ui-divider first:border-t-0', className)}>
      {leading}
      <span className="min-w-0 flex-1">
        <TextLine className="text-ui-body text-ui-text">{title}</TextLine>
        {meta && <TextLine className="text-ui-label text-ui-muted">{meta}</TextLine>}
      </span>
      {trailing}
    </div>
  )
}

/** Feladat-sor sötét kártyán (Crextio „Onboarding Task”): ikon-kör (kész = sötét, teendő = fehér), cím + idő,
 *  jobbra sárga pipa (kész) vagy szürke pötty (teendő). A kész sor címe áthúzott, halvány. */
export function TaskRow({ icon: Icon, lead, title, meta, done = false, light = false, trailing, className }: { icon: LucideIcon; /** az ikon helyén más (pl. zászló) — ilyenkor kör-háttér nélkül */ lead?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; done?: boolean; /** világos kártyán (pl. a Teendők „Holnapi” lapja) */ light?: boolean; trailing?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5', className)}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', lead ? '' : done ? (light ? 'bg-ui-dark/10 text-ui-muted' : 'bg-white/10 text-white/70') : 'bg-white text-ui-dark', done && lead && 'opacity-60')}>
        {lead ?? <Icon className="h-4 w-4" strokeWidth={1.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <TextLine className={cn('text-ui-body', done ? (light ? 'text-ui-muted line-through' : 'text-white/45 line-through') : light ? 'text-ui-text' : 'text-white')}>{title}</TextLine>
        {meta && <TextLine className={cn('text-ui-label', light ? 'text-ui-muted' : 'text-white/45')}>{meta}</TextLine>}
      </span>
      {trailing ?? (done
        ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-yellow text-ui-dark"><Check className="h-3 w-3" strokeWidth={3} /></span>
        : <span className="h-5 w-5 shrink-0 rounded-full bg-white/15" />)}
    </div>
  )
}

/* ── Táblázat ──────────────────────────────────────────────────────────────── */

/** Táblázat: fejléc halvány címkével, sorok közt 4px rés. Minden lista-táblázat ebből épül. */
export function Table({ children, minWidth = 640, className }: Children & { minWidth?: number }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-y-1 text-left" style={{ minWidth }}>{children}</table>
    </div>
  )
}
/** Oszlopcím. `onSort`: rendezhető — kattintásra rendez, újabb kattintásra fordít; `sort`: az aktuális irány (a nyíl). */
export function Th({ children, sort, onSort, className }: Children & { sort?: 'asc' | 'desc' | null; onSort?: () => void }) {
  if (!onSort) return <th className={cn('whitespace-nowrap px-3 py-2 text-ui-meta font-normal text-ui-muted', className)}>{children}</th>
  const Icon = sort === 'asc' ? ChevronUp : sort === 'desc' ? ChevronDown : ChevronsUpDown
  return (
    <th aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'} className={cn('whitespace-nowrap px-3 py-2 text-ui-meta font-normal', className)}>
      <button type="button" onClick={onSort} className={cn('-mx-1 inline-flex items-center gap-1 rounded-ui-control px-1 outline-none transition-colors hover:text-ui-text focus-visible:ring-2 focus-visible:ring-ui-dark/20', sort ? 'text-ui-text' : 'text-ui-muted')}>
        {children}<Icon className={cn('h-3.5 w-3.5', !sort && 'opacity-40')} strokeWidth={1.8} />
      </button>
    </th>
  )
}
const ROW_STATE = {
  default: '',
  selected: '[&>td]:bg-white',
  open: '[&>td]:bg-ui-yellow',
  muted: 'opacity-55',
} as const
export type RowState = keyof typeof ROW_STATE
/** Sor-állapot: selected = pipával kijelölt (fehér), open = épp megnyitott (sárga, egyszerre egy), muted = inaktív. */
export function Tr({ state = 'default', onClick, children, className }: Children & { state?: RowState; /** élőben: a sor megnyitása */ onClick?: () => void }) {
  return <tr onClick={onClick} className={cn('text-ui-body text-ui-text', ROW_STATE[state], onClick && 'cursor-pointer [&:hover>td]:bg-white/60', className)}>{children}</tr>
}
export function Td({ children, className, colSpan }: Children & { colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('whitespace-nowrap px-3 py-3 first:rounded-l-ui-inner last:rounded-r-ui-inner', className)}>{children}</td>
}
/** Jelölőnégyzet a táblázat első oszlopához. */
export function RowCheck({ checked = false, onToggle, label = 'Kijelölés' }: { checked?: boolean; /** élőben: kattintható (a sor megnyitása nélkül) */ onToggle?: () => void; label?: string }) {
  const dot = <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', checked ? 'bg-ui-dark text-white' : 'border border-ui-grey')}>{checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
  if (!onToggle) return dot
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={(e) => { e.stopPropagation(); onToggle() }} className="flex h-6 w-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{dot}</button>
}

/* ── Mérő ──────────────────────────────────────────────────────────────────── */

/** Felhasználás-sáv: felül címke + érték, alatta sáv (kitöltött rész sötét / sárga; a maradék csík). 90% felett piros jelzés. */
export function Meter({ label, value, max, unit = '', tone = 'dark', className }: { label: string; value: number; max: number; unit?: string; tone?: 'dark' | 'yellow'; className?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const warn = pct >= 90
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-ui-body text-ui-muted">{label}</span>
        <span className={cn('text-ui-body', warn ? 'text-ui-bad' : 'text-ui-text')}>{value.toLocaleString('hu-HU')} / {max.toLocaleString('hu-HU')}{unit}</span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <span className={cn('rounded-full', warn ? 'bg-ui-bad-dot' : tone === 'yellow' ? 'bg-ui-yellow' : 'bg-ui-dark')} style={{ width: `${pct}%` }} />
        <span className="ui-hatch-cell flex-1 rounded-full" />
      </div>
    </div>
  )
}

/* ── Űrlap ─────────────────────────────────────────────────────────────────── */

/** Mező-alap: minden beviteli elem ezt kapja (input, select, textarea — és a Radix Select / time-picker triggere is).
 *  Egy kinézet van: cella-színű, a popup fehér felületén. */
export const FIELD = 'w-full rounded-ui-control bg-ui-cell px-3.5 text-ui-body text-ui-text outline-none transition-shadow placeholder:text-ui-muted focus-visible:ring-2 focus-visible:ring-ui-dark/15 disabled:cursor-not-allowed disabled:opacity-50'

const FIELD_H = { sm: 'h-9', md: 'h-11' } as const
/** md = popup-mező (44px), sm = beállítás-sorban (FieldRow) jobbra álló érték (36px). */
type InputProps = { size?: keyof typeof FIELD_H; /** a mező a tartalmához igazodik (szám, összeg egy sor jobb oldalán) — nem fix szélesség */ hug?: boolean; className?: string; ref?: React.Ref<HTMLInputElement> } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'>
export function Input({ size = 'md', hug = false, className, ...rest }: InputProps) {
  // hug: ahol a böngésző tudja, a field-sizing igazítja a beírt értékhez; máshol a natív `size` (karakterszám) a tartalék
  const chars = hug ? Math.max(2, String(rest.value ?? rest.defaultValue ?? rest.placeholder ?? '').length) : undefined
  return <input {...rest} size={chars} className={cn(FIELD, FIELD_H[size], hug && 'w-auto min-w-[3.5rem] [field-sizing:content]', className)} />
}

type TextareaProps = { className?: string; ref?: React.Ref<HTMLTextAreaElement> } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>
export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea {...rest} className={cn(FIELD, 'min-h-[96px] resize-none py-3 leading-relaxed', className)} />
}

type SelectProps = { size?: keyof typeof FIELD_H; className?: string; children: React.ReactNode } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children' | 'size'>
/** Natív legördülő a mező-kinézettel (egyszerű listákhoz; kereshető / egyedi listához a Radix Select + FIELD). */
export function Select({ size = 'md', toolbar = false, className, children, ...rest }: SelectProps & { toolbar?: boolean }) {
  // `toolbar`: lista-eszköztárban (a kereső mellett) — fehér pill, mint a SearchField; űrlapban marad a szürke mező
  return (
    <span className={cn('relative block', className)}>
      <select {...rest} className={cn(FIELD, FIELD_H[size], 'appearance-none pr-10', toolbar && 'h-11 rounded-full bg-white px-4')}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted" strokeWidth={1.8} />
    </span>
  )
}

/** Belépési kód (e-mailben kapott 6 számjegy): külön cellák, nagy számok; hibánál piros keret. Megjelenítés —
 *  a fókusz-léptetést és a beillesztést az élő komponens kezeli. */
export function CodeInput({ length = 6, value = '', error = false, onChange, onComplete, autoFocus = false, inputClassName, className }: {
  length?: number; value?: string; error?: boolean
  /** élőben: a beírt számjegyek (hézag nélkül) — beírásra a következő négyzetre lép, törlésre vissza, a beillesztett kódot
   *  szétosztja; `onComplete` a 6. számjegynél */
  onChange?: (v: string) => void; onComplete?: (v: string) => void; autoFocus?: boolean
  /** a négyzetek saját kinézete (pl. sötét üveg mobilon) a mező helyett */
  inputClassName?: string; className?: string
}) {
  const box = (el: HTMLElement | null | undefined, i: number) => (el?.parentElement?.children[Math.max(0, Math.min(length - 1, i))] as HTMLInputElement | undefined)
  const put = (target: HTMLInputElement, i: number, digits: string) => {
    if (!onChange) return
    const next = (value.slice(0, i) + digits).replace(/\D/g, '').slice(0, length)
    // a beírt hossz a dobozok során is (data-len): a következő négyzet onFocus-a még a régi `value`-t látná („üres”),
    // és visszadobná a fókuszt az elsőre — így minden új szám felülírta az előzőt
    if (target.parentElement) target.parentElement.dataset.len = String(next.length)
    onChange(next)
    box(target, next.length)?.focus()
    if (next.length === length) onComplete?.(next)
  }
  return (
    <div className={cn('flex gap-1.5', className)} data-len={onChange ? value.length : undefined}>
      {Array.from({ length }, (_, i) => (
        <input key={i} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`${i + 1}. számjegy`} autoFocus={autoFocus && i === 0}
          {...(onChange ? {
            value: value[i] ?? '',
            maxLength: length,
            onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
              const len = Number(e.currentTarget.parentElement?.dataset.len ?? value.length)
              if (i > len) box(e.currentTarget, len)?.focus(); else e.currentTarget.select()
            },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const d = e.target.value.replace(/\D/g, ''); if (d) put(e.target, i, d.length > 1 && value[i] && d.startsWith(value[i]) ? d.slice(1) : d) },
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key !== 'Backspace') return
              e.preventDefault()
              const at = value[i] ? i : i - 1
              if (at < 0) return
              if (e.currentTarget.parentElement) e.currentTarget.parentElement.dataset.len = String(at)
              onChange(value.slice(0, at))
              box(e.currentTarget, at)?.focus()
            },
            onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); put(e.currentTarget, 0, e.clipboardData.getData('text')) },
          } : { maxLength: 1, defaultValue: value[i] ?? '' })}
          className={cn(inputClassName ?? FIELD, 'h-14 min-w-0 flex-1 px-0 text-center text-ui-sub font-light', error && 'ring-2 ring-ui-bad-dot/40')} />
      ))}
    </div>
  )
}

/** Kép-feltöltő hely: csíkos felület, feltöltés-ikon, rövid felirat. A méretet a hívó adja (h-…, w-…). */
export function UploadBox({ children = 'Kép', className }: Children) {
  return (
    <div className={cn('ui-hatch flex flex-col items-center justify-center gap-1 rounded-ui-inner px-3 text-center text-ui-meta text-ui-muted', className)}>
      <Upload className="h-4 w-4" strokeWidth={1.8} />
      {children}
    </div>
  )
}

/** Választható csempe (szerep, profil-mód, vállalkozás-típus): a kiválasztott sötét. `radio`: kör-jelölő elöl;
 *  `stacked`: ikon felül, nagyobb cím (kevés, nagy választásnál). */
/** Egysoros szöveg, ami ha nem fér ki, lassan oda-vissza végiggördül (szalag), hogy végig olvasható legyen; ha elfér,
 *  áll. Így a kártyák egyforma, kisebb méretűek maradnak (pl. szolgáltatás-választó). */
export function Marquee({ children, className }: Children) {
  return (
    <span className={cn('block overflow-hidden whitespace-nowrap [container-type:inline-size]', className)}>
      <span className="inline-block animate-ui-marquee motion-reduce:animate-none">{children}</span>
    </span>
  )
}

/** Egysoros szöveg a kit elemeiben (listasor, teendő-sor, menüpont): ha sima szöveget kap, görgő (MarqueeText); ha már
 *  összetett tartalmat (saját görgőt, pilleket), azt érintetlenül, levágva teszi ki — két görgő egymásban eltüntetné a szöveget. */
function TextLine({ children, className }: Children) {
  const plain = typeof children === 'string' || typeof children === 'number' || (Array.isArray(children) && children.every((c) => typeof c === 'string' || typeof c === 'number'))
  return plain ? <MarqueeText className={className}>{children}</MarqueeText> : <span className={cn('block min-w-0 truncate', className)}>{children}</span>
}

/** A `truncate` helyett mindenhol ez: egysoros szöveg, ami ha nem fér ki, elúszik (szalagcím), ha kifér, áll. Bármilyen
 *  rugalmas sorban működik — a láthatatlan példány adja a természetes szélességét (a sima Marquee egy tartalom-szélességű
 *  dobozban 0 szélesre esne), `min-w-0`-val annyira megy össze, amennyi hely van. A szöveg-osztályok a `className`-be. */
export function MarqueeText({ children, className }: Children) {
  return (
    <span className={cn('relative block min-w-0 overflow-hidden', className)}>
      <span aria-hidden className="invisible block whitespace-nowrap">{children}</span>
      <Marquee className="absolute inset-0">{children}</Marquee>
    </span>
  )
}

export function OptionCard({ title, children, selected = false, icon: Icon, radio = false, stacked = false, className }: Children & { title: React.ReactNode; selected?: boolean; icon?: LucideIcon; radio?: boolean; stacked?: boolean }) {
  return (
    <div className={cn('rounded-ui-inner', stacked ? 'p-4' : 'flex items-center gap-3 px-3.5 py-2.5', selected ? 'bg-ui-dark text-white' : 'bg-ui-cell text-ui-text', className)}>
      {radio && <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', selected ? 'bg-ui-yellow text-ui-dark' : 'border border-ui-grey')}>{selected && <Check className="h-3 w-3" strokeWidth={3} />}</span>}
      {Icon && <Icon className={cn('shrink-0', stacked ? 'h-5 w-5' : 'h-4 w-4')} strokeWidth={1.8} />}
      <span className={cn('block min-w-0 flex-1', stacked && 'mt-3')}>
        <Marquee className={stacked ? 'text-ui-row' : 'text-ui-body'}>{title}</Marquee>
        {children && <Marquee className={cn(stacked ? 'text-ui-meta' : 'text-ui-label', selected ? 'text-white/55' : 'text-ui-muted')}>{children}</Marquee>}
      </span>
    </div>
  )
}

/** Címkés mező (popupban): címke felül, alatta a mező, alul súgó vagy hiba. Beállítás-sorhoz a FieldRow. */
export function Field({ label, hint, error, children, className }: Children & { label: string; hint?: React.ReactNode; error?: React.ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-ui-meta text-ui-muted">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-ui-label text-ui-bad">{error}</span> : hint && <span className="mt-1.5 block text-ui-label text-ui-muted">{hint}</span>}
    </label>
  )
}

type CheckboxProps = { label?: React.ReactNode; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'>
/** Jelölőnégyzet: kerek, mint a táblázat RowCheck-je; bejelölve sötét pipa. */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5 text-ui-body text-ui-text', className)}>
      <input type="checkbox" {...rest} className="peer sr-only" />
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ui-grey text-white transition-colors peer-checked:border-ui-dark peer-checked:bg-ui-dark peer-focus-visible:ring-2 peer-focus-visible:ring-ui-dark/15 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      {label}
    </label>
  )
}

/** Megjegyzés-doboz. Szürke = tájékoztatás / előnézet; `strong` = kiszámolt érték; `warn` = FIGYELMEZTETÉS (narancs,
 *  háromszög-ikonnal, a legkisebb betűvel: text-ui-label) — minden, ami következményre vagy korlátra figyelmeztet, ezt kapja;
 *  `tip` = JAVASLAT (háttér nélkül, sárga villanykörte, szürke szöveg) — hogyan lehetne jobb / több bevétel. */
export function Note({ icon, strong = false, warn = false, tip = false, children, className }: Children & { icon?: LucideIcon; strong?: boolean; warn?: boolean; tip?: boolean }) {
  // figyelmeztetés: mindig narancs + háromszög-ikon, hogy egy pillantásra elváljon a sima tájékoztatástól (szürke)
  const Icon = icon ?? (warn ? TriangleAlert : tip ? Lightbulb : undefined)
  return (
    <div className={cn('flex items-start gap-2 leading-relaxed', tip ? 'text-ui-meta text-ui-muted' : 'rounded-ui-control px-3 py-2.5', !tip && (warn ? 'bg-ui-warn-bg text-ui-label text-ui-warn' : cn('bg-ui-cell text-ui-meta', strong ? 'text-ui-dark' : 'text-ui-muted')), className)}>
      {Icon && <Icon className={cn('shrink-0', warn ? 'mt-px h-3 w-3' : 'mt-0.5 h-3.5 w-3.5', tip && 'text-ui-yellow')} strokeWidth={2} />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ── Lebegő rétegek ────────────────────────────────────────────────────────── */

/** Popup-szélesség: sm = megerősítés / rövid info, md = űrlap (alap), lg = kéthasábos (pl. Új foglalás), xl = széles
 *  eredmény-nézet (pl. a kiküldött kampány címzettjei: lista szűrővel + jobb oszlop).
 *  Mobilon mindegyik teljes szélességű (alulról nyílik). */
export const POPUP_SIZE = { sm: 'w-full sm:max-w-[440px]', md: 'w-full sm:max-w-[560px]', lg: 'w-full sm:max-w-[880px]', xl: 'w-full sm:max-w-[1040px]' } as const

/** Lebegő felület (popup, modal, menü): tömör fehér, popup-árnyék. Popupnál `size`, menünél / oldalsó panelnél nincs. */
export function Panel({ pad = 'md', size, children, className }: Children & { pad?: keyof typeof CARD_PAD; size?: keyof typeof POPUP_SIZE }) {
  return <div className={cn('rounded-ui-card bg-white shadow-ui-popup', CARD_PAD[pad], size && POPUP_SIZE[size], className)}>{children}</div>
}

/** Háttér-réteg a modal mögött: elsötétít és enyhén elmos; mobilon alulról, desktopon középen nyit. */
export function Overlay({ onClose, children, className }: Children & { onClose?: () => void }) {
  return (
    <div className={cn('fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4', className)}>
      <div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full sm:w-auto">{children}</div>
    </div>
  )
}

/** Fogantyú-csík az alulról nyíló panelek tetején (mobil): középen, lehúzással zárható — mint iPhone-on. */
export function SheetHandle({ className }: { className?: string }) {
  return <div className={cn('flex shrink-0 justify-center', className)}><span className="h-1 w-10 rounded-full bg-ui-grey" /></div>
}

/** Modal: cím (+ alcím) és bezáró gomb felül, tartalom, alul a gombok jobbra. */
export function Modal({ title, subtitle, onClose, footer, size = 'md', children, className }: Children & { title: React.ReactNode; subtitle?: React.ReactNode; onClose?: () => void; footer?: React.ReactNode; size?: keyof typeof POPUP_SIZE }) {
  return (
    <Panel pad="none" size={size} className={cn('flex max-h-[85dvh] flex-col overflow-hidden max-sm:rounded-b-none', className)}>
      {/* mobilon alulról nyílik: fogantyú-csík középen, lehúzással zárható (iOS) — X csak desktopon */}
      <SheetHandle className="pt-2.5 sm:hidden" />
      <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-4 sm:pt-6">
        <div className="min-w-0">
          <div className="text-ui-sub font-light text-ui-text">{title}</div>
          {subtitle && <Meta className="mt-0.5">{subtitle}</Meta>}
        </div>
        <IconButton icon={X} variant="cell" size="sm" label="Bezárás" onClick={onClose} className="max-sm:hidden" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-6">{footer}</div>}
    </Panel>
  )
}

/** Menü (popover, legördülő, „…” műveletek): fehér felület, benne MenuItem-ek. */
export function Menu({ label, children, className }: Children & { label?: string }) {
  return (
    <Panel pad="xs" className={cn('ui-pop-in min-w-[220px]', className)}>
      {label && <div className="px-3 pb-1 pt-2 text-ui-meta text-ui-muted">{label}</div>}
      {children}
    </Panel>
  )
}
/** Menü-sor: ikon, felirat, jobbra rövidítés / érték. Az aktív cella-színű, a veszélyes piros szövegű. */
export function MenuItem({ icon: Icon, active = false, danger = false, trailing, children, className, ...rest }: Children & { icon?: LucideIcon; active?: boolean; danger?: boolean; trailing?: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  return (
    <button type="button" {...rest} className={cn('flex w-full items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-left text-ui-body transition-colors hover:bg-ui-cell', active && 'bg-ui-cell', danger ? 'text-ui-bad' : 'text-ui-text', className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />}
      <TextLine className="flex-1">{children}</TextLine>
      {trailing && <span className="shrink-0 text-ui-meta text-ui-muted">{trailing}</span>}
    </button>
  )
}

/* ── Visszajelzés ──────────────────────────────────────────────────────────── */

const TOAST_ICON = {
  ok: { cls: 'bg-ui-yellow text-ui-dark', icon: Check },
  bad: { cls: 'bg-ui-bad-bg text-ui-bad', icon: X },
  info: { cls: 'bg-white/15 text-white', icon: Bell },
} as const
/** Toast: sötét pill alul, bal oldalt állapot-kör (kész sárga pipa / hiba piros X / infó csengő), felirat, jobbra egy művelet.
 *  A sonner ezt rendereli. */
export function Toast({ status = 'ok', title, children, action, className }: Children & { status?: keyof typeof TOAST_ICON; title: React.ReactNode; action?: React.ReactNode }) {
  const t = TOAST_ICON[status]
  return (
    <div className={cn('inline-flex max-w-[460px] items-center gap-2.5 rounded-full bg-ui-dark py-2 pl-2 pr-4 text-ui-body text-white shadow-ui-float', action && 'pr-2', className)}>
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', t.cls)}><t.icon className="h-3.5 w-3.5" strokeWidth={3} /></span>
      <span className="block min-w-0 truncate">{title}{children && <span className="ml-1.5 text-white/55">{children}</span>}</span>
      {action}
    </div>
  )
}

/** Üres állapot: csíkos felület, ikon fehér körben, cím, egy mondat, egy gomb. */
export function EmptyState({ icon: Icon, title, children, action, className }: Children & { icon?: LucideIcon; title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn('ui-hatch flex flex-col items-center rounded-ui-card px-6 py-10 text-center', className)}>
      {Icon && <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ui-dark"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>}
      <CardTitle>{title}</CardTitle>
      {children && <Meta className="mt-1 max-w-[320px] text-ui-body">{children}</Meta>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Töltés-helyőrző: lüktető cella-színű folt; a méretét a hívó adja (h-…, w-…). */
export function Skeleton({ className, round = false }: { className?: string; round?: boolean }) {
  return <span className={cn('block animate-pulse bg-ui-cell', round ? 'rounded-full' : 'rounded-ui-control', className)} />
}

/* ── Lapozó ────────────────────────────────────────────────────────────────── */

function pageList(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = [1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages)
  const out: (number | null)[] = []
  for (const p of [...new Set(set)].sort((a, b) => a - b)) {
    if (out.length && p - (out[out.length - 1] as number) > 1) out.push(null)
    out.push(p)
  }
  return out
}

/** Lapozó: mindig a lista ALJÁN. Balra opcionális „1–6 / 42”, jobbra ‹ oldalszámok ›; az aktuális sötét. */
export function Pagination({ page, pages, label, onPage, full = false, className }: { page: number; pages: number; label?: React.ReactNode; onPage?: (p: number) => void; full?: boolean; className?: string }) {
  const go = (p: number) => (onPage ? () => onPage(p) : undefined)
  // `full` (mobil): nincs bal oldali „1–10 / 412”, a nyilak és az oldalszámok a teljes szélességen oszlanak el
  // mobilon egyetlen oldalnál nincs mit lapozni — nem jelenik meg (desktopon a sorszám miatt marad)
  if (full && pages <= 1) return null
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {!full && (label ? <Meta>{label}</Meta> : <span />)}
      <div className={cn('flex items-center gap-1', full && 'w-full justify-between')}>
        <IconButton icon={ArrowLeft} size="sm" label="Előző oldal" disabled={page <= 1} onClick={go(page - 1)} className="disabled:opacity-40" />
        {pageList(page, pages).map((p, i) => p === null
          ? <span key={`gap-${i}`} className="w-6 text-center text-ui-meta text-ui-muted">…</span>
          : <button key={p} type="button" onClick={go(p)} aria-current={p === page ? 'page' : undefined} className={cn('ui-press h-9 min-w-9 rounded-full px-2 text-ui-meta', p === page ? 'bg-ui-dark text-white' : 'text-ui-muted hover:bg-white/70')}>{p}</button>)}
        <IconButton icon={ArrowRight} size="sm" label="Következő oldal" disabled={page >= pages} onClick={go(page + 1)} className="disabled:opacity-40" />
      </div>
    </div>
  )
}
