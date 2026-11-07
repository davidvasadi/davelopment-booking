import { ArrowRight, Check, Gift, Link2, Scissors, Upload, UtensilsCrossed } from 'lucide-react'
import { Button, Card, Checkbox, EmptyState, Field, IconButton, IconCircle, Input, Meta, OptionCard, Pill, StatusPill, MarqueeText } from '@/components/ui-kit'
import { AuthOr } from './auth'
import { GLASS_FIELD } from './public'

// mobilon a lépések a sötét videón, üvegből — mint a belépés (design 3.5)
const GLASS_TILE = 'border border-white/15 bg-white/[0.06] text-white backdrop-blur-[10px]' // ui-allow: üveg-csempe a videón
const GLASS_PILL = 'border border-white/15 bg-white/[0.06] text-white/85 backdrop-blur-[10px]' // ui-allow: üveg-pill a videón

/* Regisztráció (design 3.3) — a design oldal, a főoldal „Hogyan működik” lépései és az élő /register ugyanezeket a
 * blokkokat használja: 1 vállalkozás, 2 fiók (kód e-mailben), 3 import (kihagyható), 4 kész. */

export { REGISTER_STEPS, Steps } from './steps'
import { REGISTER_STEPS, Steps } from './steps'

export type TypeOption = { id: string; label: string }
const SAMPLE_TYPES: TypeOption[] = ['Fodrászat', 'Körömszalon', 'Szépségszalon', 'Masszázs / Spa', 'Fizioterápia', 'Személyi edző', 'Fotós / Videós', 'Oktató / Tanár'].map((label) => ({ id: label, label }))

/** 1. lépés: szalon vagy étterem, és szalonnál milyen szolgáltatások (több is), étteremnél milyen típusú hely (egy). */
export function BusinessTypeStep({ kind = 'salon', onKind, options = SAMPLE_TYPES, selected = ['Fodrászat'], onToggle, hint, onNext, card = false, dark = false, className = '' }: {
  kind?: 'salon' | 'restaurant'; onKind?: (k: 'salon' | 'restaurant') => void
  options?: TypeOption[]; selected?: string[]; onToggle?: (id: string) => void
  /** a választás alatt egy mondat (étteremnél: mit tölt be a sablon) */
  hint?: string
  onNext?: () => void; card?: boolean
  /** mobilon a sötét videón, üvegből */
  dark?: boolean
  className?: string
}) {
  const body = (
    <>
      <Steps active={0} dark={dark} />
      <div className={`text-ui-sub font-light ${dark ? 'text-white ui-photo-text' : 'text-ui-text'}`}>Milyen vállalkozást vezetsz?</div>
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {([['salon', Scissors, 'Szalon', 'Időpontfoglalás'], ['restaurant', UtensilsCrossed, 'Étterem', 'Asztalfoglalás']] as const).map(([k, Icon, t, d]) => {
          const c = dark
            ? <div className={`flex flex-col gap-3 rounded-ui-inner p-4 ${kind === k ? 'bg-white text-ui-text' : GLASS_TILE}`}><Icon className="h-5 w-5" strokeWidth={1.6} /><div><div className="text-ui-row">{t}</div><div className={`text-ui-meta ${kind === k ? 'text-ui-muted' : 'text-white/60'}`}>{d}</div></div></div>
            : <OptionCard stacked icon={Icon} title={t} selected={kind === k}>{d}</OptionCard>
          return onKind ? <button key={k} type="button" onClick={() => onKind(k)} className="block rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <div key={k}>{c}</div>
        })}
      </div>
      <div className={`mt-5 text-ui-meta ${dark ? 'text-white/60' : 'text-ui-muted'}`}>{kind === 'salon' ? 'Mivel foglalkozol? — ehhez töltjük be a kategóriákat és a minta szolgáltatásokat' : 'Milyen helyet vezetsz? — ehhez töltjük be a termeket, az asztalokat és a nyitvatartást'}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((o) => {
          const on = selected.includes(o.id)
          const p = <Pill tone={on ? (dark ? 'white' : 'dark') : dark ? 'ghost' : 'cell'} className={dark && !on ? GLASS_PILL : ''}>{on ? <Check className="h-3.5 w-3.5" /> : null}{o.label}</Pill>
          return onToggle ? <button key={o.id} type="button" aria-pressed={on} onClick={() => onToggle(o.id)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{p}</button> : <span key={o.id}>{p}</span>
        })}
      </div>
      {hint && <div className={`mt-3 text-ui-meta leading-relaxed ${dark ? 'text-white/60' : 'text-ui-muted'}`}>{hint}</div>}
      <Button variant={dark ? 'glass' : 'dark'} className={`mt-6 w-full ${dark ? 'bg-white' : ''}`} onClick={onNext} disabled={!!onNext && selected.length === 0}>Tovább<ArrowRight className="h-4 w-4" /></Button>
    </>
  )
  return card ? <Card tone="white" pad="lg" className={className}>{body}</Card> : <div className={className}>{body}</div>
}

/** Mező a fiók-lépésen: mobilon (`dark`) üveg a videón, különben a kit mezője. */
function Inp({ dark, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & { dark: boolean }) {
  return dark ? <input {...p} className={`${GLASS_FIELD} w-full outline-none placeholder:text-white/30 ${p.className ?? ''}`} /> : <Input {...p} />
}
function F({ dark, label, hint, children }: { dark: boolean; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return dark
    ? <div><div className="mb-1.5 text-ui-label text-white/60">{label}</div>{children}{hint && <div className="mt-1.5 text-ui-label text-white/60">{hint}</div>}</div>
    : <Field label={label} hint={hint}>{children}</Field>
}

/** A fiók adatai (2. lépés). */
export type AccountValues = { placeName: string; ownerName: string; email: string; city: string; phone: string; consent: boolean }
const SAMPLE_ACCOUNT: AccountValues = { placeName: 'Anna Fodrászat', ownerName: '', email: '', city: '', phone: '', consent: false }

/** 2. lépés: a hely neve (rögtön mutatja a foglalóoldal címét és hogy szabad-e), a te neved, e-mail, város, telefon,
 *  ÁSZF → Kód küldése (jelszó nincs, a kód egyben e-mail-megerősítés); vagy Google. `errors`: mezőnként a hiba. */
export function AccountStep({ kind = 'salon', values = SAMPLE_ACCOUNT, onChange, slugUrl = 'booking.davelopment.hu/anna-fodraszat', slugStatus = 'available', errors = {}, error, busy = false, onSubmit, onBack, google, termsHref, dark = false, className = '', referral }: {
  /** ajánló program: a kód (a linkből jön, vagy kézzel), az állapota és ki ajánlotta — érvényesnél fent sárga sáv */
  referral?: { code: string; onCode?: (v: string) => void; status: 'idle' | 'checking' | 'ok' | 'bad'; by?: string | null }
  kind?: 'salon' | 'restaurant'; values?: AccountValues; onChange?: (v: Partial<AccountValues>) => void
  slugUrl?: string; slugStatus?: 'idle' | 'checking' | 'available' | 'taken'
  errors?: Partial<Record<keyof AccountValues, string>>; error?: string | null; busy?: boolean
  onSubmit?: () => void; onBack?: () => void; google?: React.ReactNode; termsHref?: string
  /** mobilon a sötét videón, üvegből */
  dark?: boolean
  className?: string
}) {
  const set = (k: keyof AccountValues) => onChange ? { value: values[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value }) } : { defaultValue: values[k] as string }
  const bad = (k: keyof AccountValues) => (errors[k] ? 'ring-2 ring-ui-bad-dot/40' : '')
  const err = (k: keyof AccountValues) => errors[k] && <div role="alert" className={`mt-1 text-ui-label ${dark ? 'text-ui-bad-bg' : 'text-ui-bad'}`}>{errors[k]}</div>

  const pill = slugStatus === 'available' ? <StatusPill status="ok">szabad</StatusPill> : slugStatus === 'taken' ? <StatusPill status="bad">foglalt</StatusPill> : slugStatus === 'checking' ? <StatusPill status="neutral">…</StatusPill> : null
  return (
    <form className={className} noValidate onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit() } : undefined}>
      <Steps active={1} dark={dark} />
      {referral?.status === 'ok' && referral.by && <Pill tone="yellow" className="mb-3 max-w-full"><Gift className="h-4 w-4 shrink-0" /><MarqueeText>{referral.by} ajánlott</MarqueeText></Pill>}
      <div className={`text-ui-title ${dark ? 'text-white ui-photo-text' : 'text-ui-text'}`}>Hozd létre a fiókodat</div>
      <div className="mt-4 space-y-4">
        <F dark={dark} label={kind === 'salon' ? 'Szalon neve' : 'Étterem neve'} hint={values.placeName.trim() ? <span className="flex flex-wrap items-center gap-1.5">{slugUrl} {pill}</span> : undefined}>
          <Inp dark={dark} {...set('placeName')} placeholder={kind === 'salon' ? 'pl. Anna Fodrászat' : 'pl. Budapest Bisztró'} className={bad('placeName')} />{err('placeName')}
        </F>
        <F dark={dark} label="A te neved"><Inp dark={dark} {...set('ownerName')} autoComplete="name" placeholder="pl. Kiss Anna" className={bad('ownerName')} />{err('ownerName')}</F>
        <F dark={dark} label="E-mail"><Inp dark={dark} {...set('email')} type="email" inputMode="email" autoComplete="email" placeholder="te@pelda.hu" className={bad('email')} />{err('email')}</F>
        <div className="grid grid-cols-2 gap-3">
          <F dark={dark} label="Város"><Inp dark={dark} {...set('city')} autoComplete="address-level2" placeholder="Budapest" className={bad('city')} />{err('city')}</F>
          <F dark={dark} label="Telefon"><Inp dark={dark} {...set('phone')} type="tel" autoComplete="tel" placeholder="+36 …" className={bad('phone')} />{err('phone')}</F>
        </div>
        {referral && (
          <F dark={dark} label="Ajánló kód (ha van)" hint={referral.status === 'ok' ? 'Rendben — így tudjuk, ki ajánlott.' : referral.status === 'bad' ? 'Ilyen kód nincs — ellenőrizd, vagy hagyd üresen.' : undefined}>
            <span className="relative block">
              <Inp dark={dark} {...(referral.onCode ? { value: referral.code, onChange: (e: React.ChangeEvent<HTMLInputElement>) => referral.onCode!(e.target.value.toUpperCase()) } : { defaultValue: referral.code })} autoCapitalize="characters" placeholder="pl. ANNA" className="pr-28" />
              {referral.status !== 'idle' && <span className="absolute right-2 top-1/2 -translate-y-1/2">{referral.status === 'ok' ? <StatusPill status="ok">Érvényes</StatusPill> : referral.status === 'bad' ? <StatusPill status="bad">Nincs ilyen</StatusPill> : <StatusPill status="neutral">…</StatusPill>}</span>}
            </span>
          </F>
        )}
        <div>
          <Checkbox className={dark ? 'text-white/85' : undefined} checked={onChange ? values.consent : undefined} onChange={onChange ? (e: React.ChangeEvent<HTMLInputElement>) => onChange({ consent: e.target.checked }) : undefined}
            label={<>Elfogadom az {termsHref ? <a href={termsHref} target="_blank" rel="noopener" className="underline underline-offset-2">ÁSZF-et és az adatkezelést</a> : 'ÁSZF-et és az adatkezelést'}</>} />
          {err('consent')}
        </div>
      </div>
      {error && <div role="alert" className={`mt-3 text-ui-label ${dark ? 'text-ui-bad-bg' : 'text-ui-bad'}`}>{error}</div>}
      <Button type="submit" variant={dark ? 'glass' : 'dark'} loading={busy} className={`mt-5 w-full ${dark ? 'bg-white' : ''}`}>Kód küldése<ArrowRight className="h-4 w-4" /></Button>
      <div className={`mt-2 text-center text-ui-label ${dark ? 'text-white/50' : 'text-ui-muted'}`}>Jelszó nincs — a kóddal egyben az e-mailed is megerősítjük.</div>
      {google && <><AuthOr dark={dark} />{google}</>}
      {onBack && !dark && <button type="button" onClick={onBack} className="mt-4 w-full text-center text-ui-meta text-ui-muted underline-offset-4 outline-none hover:underline">Vissza</button>}
    </form>
  )
}

/** 3. lépés: import más rendszerből — kihagyható. Élőben a `children` a feltöltő (WizardImportStep). */
export function ImportStep({ onSkip, onNext, children, dark = false, labels = REGISTER_STEPS, className = '' }: { onSkip?: () => void; onNext?: () => void; children?: React.ReactNode; dark?: boolean; labels?: string[]; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <Steps active={Math.max(0, labels.indexOf('Import'))} dark={dark} labels={labels} />
      <div className={`text-ui-title ${dark ? 'text-white ui-photo-text' : 'text-ui-text'}`}>Importáld az adataid</div>
      <Meta dark={dark} className="mt-1">Ha más rendszerből váltasz — kihagyható, később is megcsinálhatod (Beállítások › Integrációk).</Meta>
      {children ?? <EmptyState icon={Upload} title="Húzd ide a fájlt" className="mt-4 flex-1" action={<Button variant="glass">Fájl kiválasztása</Button>}>CSV vagy Excel — munkatársak, vendégek, szolgáltatások egyszerre.</EmptyState>}
      {/* élőben a feltöltő (children) hozza a saját Kihagyás / Tovább gombjait */}
      {!children && <div className="mt-5 flex gap-1.5"><Button variant="cell" className="flex-1" onClick={onSkip}>Kihagyom</Button><Button className="flex-1" onClick={onNext}>Tovább</Button></div>}
    </div>
  )
}

/** 4. lépés, kész: „Jöhetnek a vendégek!” — mi készült el, a foglalóoldal linkje (másolható), irány a dashboard. */
export function ReadyCard({ kind = 'salon', url = 'booking.davelopment.hu/anna-fodraszat', onCopy, href, labels = REGISTER_STEPS, className = '' }: { kind?: 'salon' | 'restaurant'; url?: string; onCopy?: () => void; href?: string; labels?: string[]; className?: string }) {
  const items = kind === 'salon' ? ['Szalon profil létrehozva', 'Alapszolgáltatások beállítva', 'Foglalási oldal elérhető'] : ['Étterem profil létrehozva', 'Termek és asztalok beállítva', 'Foglalási oldal elérhető']
  return (
    <Card tone="dark" pad="lg" className={`flex flex-col ${className}`}>
      <Steps active={labels.length - 1} labels={labels} className="mb-6 [&_*]:text-white/80" />
      <div className="text-ui-sub font-light">Jöhetnek a vendégek!</div>
      <Meta dark className="mt-1">{kind === 'salon' ? 'A szalonod elkészült' : 'Az éttermed elkészült'} — már csak meg kell osztanod.</Meta>
      <div className="mt-5 space-y-2.5">
        {items.map((t) => <div key={t} className="flex items-center gap-2.5 text-ui-body"><IconCircle tone="yellow" size="sm" icon={Check} />{t}</div>)}
      </div>
      <div className="mb-1.5 mt-6 flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-4 pr-1 text-ui-meta text-white/80">
        <MarqueeText className="flex-1">{url}</MarqueeText>
        <IconButton icon={Link2} label="Link másolása" variant="yellow" size="sm" onClick={onCopy} />
      </div>
      <Button variant="yellow" className="mt-auto w-full" href={href}>Irány a dashboard</Button>
    </Card>
  )
}

/* ── Új üzlet a meglévő fiókhoz (design 23.7) — a regisztráció darabjaiból, belépés / jelszó nélkül ───────────── */

export const NEW_BUSINESS_STEPS = ['Üzlet', 'Import', 'Kész']
export type NewBusinessValues = { name: string; city: string; phone: string }

/** 1. lépés: szalon vagy étterem, a neve (rögtön a foglalóoldal címével és hogy szabad-e), város, telefon; alatta mi
 *  lesz az előfizetéssel (próbaidő alatt a közös próbaidőbe kerül; fizetősnél a díja a következő számlához adódik). */
export function NewBusinessStep({ kind = 'salon', onKind, values = { name: 'Anna Szépségszalon', city: 'Budapest', phone: '' }, onChange, slugUrl = 'booking.davelopment.hu/anna-szepsegszalon', slugStatus = 'available', paying = false, error, busy = false, onSubmit, backHref, dark = false, className = '' }: {
  kind?: 'salon' | 'restaurant'; onKind?: (k: 'salon' | 'restaurant') => void
  values?: NewBusinessValues; onChange?: (v: Partial<NewBusinessValues>) => void
  slugUrl?: string; slugStatus?: 'idle' | 'checking' | 'available' | 'taken'
  /** van-e már fizetős előfizetés (a díj-mondat ettől függ) */
  paying?: boolean
  error?: string | null; busy?: boolean; onSubmit?: () => void; backHref?: string
  /** mobilon a sötét videón, üvegből — mint a regisztráció (design 3.5) */
  dark?: boolean
  className?: string
}) {
  const set = (k: keyof NewBusinessValues) => onChange ? { value: values[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value }) } : { defaultValue: values[k] }
  const pill = slugStatus === 'available' ? <StatusPill status="ok">szabad</StatusPill> : slugStatus === 'taken' ? <StatusPill status="bad">foglalt</StatusPill> : slugStatus === 'checking' ? <StatusPill status="neutral">…</StatusPill> : null
  return (
    <form className={className} noValidate onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit() } : undefined}>
      <Steps active={0} labels={NEW_BUSINESS_STEPS} dark={dark} />
      <div className={`text-ui-title ${dark ? 'text-white ui-photo-text' : 'text-ui-text'}`}>Új üzlet hozzáadása</div>
      <Meta dark={dark} className="mt-1">Ugyanabba a fiókba — nem kell újra belépned, a váltás a profil-menüből megy.</Meta>
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {([['salon', Scissors, 'Szalon', 'Időpontfoglalás'], ['restaurant', UtensilsCrossed, 'Étterem', 'Asztalfoglalás']] as const).map(([k, Icon, t, d]) => {
          const c = dark
            ? <div className={`flex flex-col gap-3 rounded-ui-inner p-4 ${kind === k ? 'bg-white text-ui-text' : GLASS_TILE}`}><Icon className="h-5 w-5" strokeWidth={1.6} /><div><div className="text-ui-row">{t}</div><div className={`text-ui-meta ${kind === k ? 'text-ui-muted' : 'text-white/60'}`}>{d}</div></div></div>
            : <OptionCard stacked icon={Icon} title={t} selected={kind === k}>{d}</OptionCard>
          return onKind ? <button key={k} type="button" onClick={() => onKind(k)} className="block rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <div key={k}>{c}</div>
        })}
      </div>
      <div className="mt-4 space-y-4">
        <F dark={dark} label={kind === 'salon' ? 'Szalon neve' : 'Étterem neve'} hint={values.name.trim() ? <span className="flex flex-wrap items-center gap-1.5">{slugUrl} {pill}</span> : undefined}>
          <Inp dark={dark} {...set('name')} autoComplete="organization" placeholder={kind === 'salon' ? 'pl. Anna Fodrászat' : 'pl. Budapest Bisztró'} />
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F dark={dark} label="Város"><Inp dark={dark} {...set('city')} autoComplete="address-level2" placeholder="Budapest" /></F>
          <F dark={dark} label="Telefon"><Inp dark={dark} {...set('phone')} type="tel" autoComplete="tel" placeholder="+36 …" /></F>
        </div>
      </div>
      <div className={`mt-4 rounded-ui-inner px-4 py-3 text-ui-meta leading-relaxed ${dark ? GLASS_PILL : 'bg-ui-cell text-ui-muted'}`}>
        {paying ? 'Fizetős előfizetésed van — az új üzlet díja a következő havi számládhoz adódik.' : 'A fiókod próbaidejébe kerül — amíg az tart, nem kell fizetned érte.'}
      </div>
      {error && <div role="alert" className={`mt-3 text-ui-label ${dark ? 'text-ui-bad-bg' : 'text-ui-bad'}`}>{error}</div>}
      <Button type="submit" variant={dark ? 'glass' : 'dark'} loading={busy} className={`mt-5 w-full ${dark ? 'bg-white' : ''}`}>Üzlet létrehozása<ArrowRight className="h-4 w-4" /></Button>
      {backHref && !dark && <a href={backHref} className="mt-4 block w-full text-center text-ui-meta text-ui-muted underline-offset-4 outline-none hover:underline">Vissza</a>}
    </form>
  )
}
