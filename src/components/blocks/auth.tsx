import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button, Card, CodeInput, Field, IconCircle, Input, Meta, Note } from '@/components/ui-kit'
import { BrandLogo } from '@/components/BrandLogo'
import { POSTER } from './assets'
import { GLASS_FIELD } from './public'

/*
 * Belépés és regisztráció (design 3.1–3.5) — a design oldal és az élő /login, /register ugyanezeket a blokkokat
 * használja. Desktop: fehér oldal, bal oldalt a nagy sötét panel (élőben a háttérvideó, a mintán a poszter), a logó, a
 * csupa-nagybetűs szlogen és az üveges info-sorok; jobbra a fehér lap az űrlappal. Mobil: teljes képernyős sötét a
 * videón, üveges mezők és gombok. Jelszó nincs: e-mail → 6 jegyű kód e-mailben → belépés (7 napig ezen az eszközön).
 */

const GLASS_ROW = 'flex items-center gap-3 rounded-ui-control border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-[10px]' // ui-allow: üveg-sor a videón
const GLASS_BTN = 'border border-white/15 bg-transparent backdrop-blur-[10px]' // ui-allow: üveg-gomb a videón
const GLASS_CODE = `${GLASS_FIELD} justify-center` // a kód négyzetei a videón

export const AUTH_INFO = ['30 nap ingyenes próba, kártya nélkül', 'Szakembereknek és vendéglátóhelyeknek', 'Jelszó nélkül — kóddal lépsz be']

/** Üveges info-sor a sötét videón: sárga pipa-kör, fehér szöveg. */
export const GlassRow = ({ children }: { children: React.ReactNode }) => (
  <div className={GLASS_ROW}><IconCircle tone="yellow" size="xs" icon={Check} /><span className="text-ui-meta text-white/85">{children}</span></div>
)

/** „vagy” elválasztó (világos vagy sötét alapon). */
export function AuthOr({ dark = false }: { dark?: boolean }) {
  const line = dark ? 'flex-1 border-t border-white/10' : 'flex-1 border-t border-dashed border-ui-divider'
  return <div className={`my-4 flex items-center gap-3 ${dark ? 'text-ui-label uppercase tracking-widest text-white/40' : 'text-ui-meta text-ui-muted'}`}><span className={line} />vagy<span className={line} /></div>
}

/** A háttér: élőben a videó (`media`), a mintán a poszter. */
const Media = ({ media, dim = 'opacity-80' }: { media?: React.ReactNode; dim?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <>{media ?? <img src={POSTER} alt="" className={`absolute inset-0 h-full w-full object-cover ${dim}`} />}</>
)

/** Desktop képernyő: bal a sötét panel (logó, szlogen, info-sorok, copyright), jobbra a fehér lap a tartalommal. */
export function AuthScreen({ title = <>Kezeld<br />okosan<br />az üzleted.</>, sub = 'Foglalás, csapat, vendégek, fizetés és marketing — egy helyen.', info = AUTH_INFO, media, logoHref, full = false, children }: {
  title?: React.ReactNode; sub?: string; info?: string[]; media?: React.ReactNode; logoHref?: string
  /** élőben a teljes képernyő magasságában */
  full?: boolean
  children: React.ReactNode
}) {
  const logo = <BrandLogo variant="dark" className="h-8 w-fit" />
  return (
    <div className={`grid gap-[5px] bg-white p-[5px] lg:grid-cols-[58%_minmax(0,1fr)] ${full ? 'min-h-dvh' : 'rounded-ui-container'}`}>
      <Card tone="dark" pad="none" className={`relative hidden overflow-hidden lg:flex ${full ? '' : 'min-h-[620px]'}`}>
        <Media media={media} />
        <div className="relative flex flex-1 flex-col justify-between p-12">
          {logoHref ? <a href={logoHref} aria-label="davelopment booking" className="w-fit transition-opacity hover:opacity-80">{logo}</a> : logo}
          <div className="ui-photo-text">
            <div className="text-ui-page font-light uppercase leading-none">{title}</div>
            {sub && <div className="mt-5 max-w-[340px] text-ui-body text-white/80">{sub}</div>}
            {info.length > 0 && <div className="mt-6 max-w-[380px] space-y-1.5">{info.map((t) => <GlassRow key={t}>{t}</GlassRow>)}</div>}
          </div>
          <span className="text-ui-label text-white/50">© {new Date().getFullYear()} [davelopment]®</span>
        </div>
      </Card>
      <Card tone="white" pad="lg" className="flex flex-col justify-center lg:px-12"><div className="mx-auto w-full max-w-[400px]">{children}</div></Card>
    </div>
  )
}

/** Mobil képernyő: teljes képernyős sötét a videón; fent a logó vagy a vissza, a tartalom alul. */
export function AuthMobile({ media, back = false, onBack, logoHref, full = false, children }: { media?: React.ReactNode; /** fent a Vissza (a logó helyett) */ back?: boolean; onBack?: () => void; logoHref?: string; full?: boolean; children: React.ReactNode }) {
  const logo = <BrandLogo variant="dark" className="h-8 w-fit" />
  return (
    <div className={`relative flex flex-col overflow-hidden bg-ui-dark px-7 pb-10 text-white ${full ? 'min-h-dvh pt-[calc(3rem+env(safe-area-inset-top))]' : 'h-[740px] w-[360px] shrink-0 rounded-ui-container pt-12'}`}>
      <Media media={media} dim="opacity-60" />
      <div className="relative flex flex-1 flex-col justify-between gap-8">
        {back || onBack
          ? <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-ui-meta text-white/60 outline-none transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Vissza</button>
          : logoHref ? <a href={logoHref} aria-label="davelopment booking" className="w-fit">{logo}</a> : logo}
        <div>{children}</div>
      </div>
    </div>
  )
}

/** Mobil kezdőképernyő: szlogen, Bejelentkezés, Regisztráció (30 nap ingyen), vagy Google, ÁSZF. */
export function AuthSplash({ title = <>Kezeld<br />okosan<br />az üzleted.</>, onLogin, registerHref, google, termsHref }: { title?: React.ReactNode; onLogin?: () => void; registerHref?: string; google?: React.ReactNode; termsHref?: string }) {
  return (
    <div className="flex min-h-[520px] flex-col justify-between">
      <div className="text-ui-page font-light uppercase leading-none ui-photo-text">{title}</div>
      <div className="space-y-2.5">
        <Button variant="glass" className="w-full bg-white" onClick={onLogin}>Bejelentkezés<ArrowRight className="h-4 w-4" /></Button>
        <Button variant="ghostDark" className={`w-full ${GLASS_BTN}`} href={registerHref}>Regisztráció — 30 nap ingyen</Button>
        <AuthOr dark />
        {google ?? <Button variant="ghostDark" className={`w-full ${GLASS_BTN}`}>Folytatás Google-lel</Button>}
        <div className="pt-1 text-center text-ui-label text-white/40">A belépéssel elfogadod az {termsHref ? <a href={termsHref} className="underline underline-offset-2">ÁSZF</a> : 'ÁSZF'}-et.</div>
      </div>
    </div>
  )
}

/** 1. képernyő: e-mail → Kód küldése; vagy Google; regisztráció. `dark`: mobilon, a videón (üveg). */
export function LoginEmailForm({ dark = false, email = 'anna@fodraszat.hu', onEmail, onSubmit, busy = false, error, google, registerHref }: {
  dark?: boolean; email?: string; onEmail?: (v: string) => void; onSubmit?: () => void; busy?: boolean; error?: string | null
  google?: React.ReactNode; registerHref?: string
}) {
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit?.() }
  const field = onEmail
    ? dark ? <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => onEmail(e.target.value)} placeholder="te@pelda.hu" aria-invalid={!!error} className={`${GLASS_FIELD} w-full outline-none placeholder:text-white/30 ${error ? 'ring-2 ring-ui-bad-dot/60' : ''}`} />
      : <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => onEmail(e.target.value)} placeholder="te@pelda.hu" aria-invalid={!!error} className={error ? 'ring-2 ring-ui-bad-dot/40' : ''} />
    : dark ? <div className={GLASS_FIELD}>{email}</div> : <Input type="email" defaultValue={email} />
  const errLine = error && <div role="alert" className={`mt-2 text-ui-label ${dark ? 'text-ui-bad-bg' : 'text-ui-bad'}`}>{error}</div>
  return (
    <form onSubmit={submit} noValidate>
      {dark
        ? <><div className="mb-8 text-ui-num font-light uppercase leading-tight ui-photo-text">Bejelentkezés</div><div className="mb-1.5 text-ui-label text-white/60">E-mail</div>{field}{errLine}<div className="mt-3"><GlassRow>Küldünk egy 6 jegyű kódot — jelszó nem kell</GlassRow></div></>
        : <><div className="text-ui-page font-light leading-tight text-ui-text">Üdv újra!</div><Meta className="mt-2 text-ui-body">Jelentkezz be a fiókodba.</Meta>
          <Field label="E-mail" className="mt-6">{field}</Field>{errLine}
          <Note tip className="mt-3">Jelszó nem kell — küldünk egy 6 jegyű belépési kódot. 7 napig belépve maradsz ezen az eszközön.</Note></>}
      <Button type="submit" variant={dark ? 'glass' : 'dark'} loading={busy} className={`mt-5 w-full ${dark ? 'bg-white' : ''}`}>Kód küldése<ArrowRight className="h-4 w-4" /></Button>
      <AuthOr dark={dark} />
      {google ?? <Button variant={dark ? 'ghostDark' : 'cell'} className={`w-full ${dark ? GLASS_BTN : ''}`}>Folytatás Google-lel</Button>}
      {!dark && <Meta className="mt-6 text-center">Még nincs fiókod? {registerHref ? <a href={registerHref} className="text-ui-text underline underline-offset-4">Regisztráció</a> : <span className="text-ui-text underline underline-offset-4">Regisztráció</span>}</Meta>}
    </form>
  )
}

/** 2. képernyő: a kód beírása. Hibás kódnál piros keret és a hátralévő próbálkozás; újraküldés visszaszámlálással. */
export function LoginCodeForm({ dark = false, email = 'anna@fodraszat.hu', code = '482', onCode, onSubmit, busy = false, error, onOtherEmail, onResend, resendIn = 24, submitLabel = 'Belépés' }: {
  dark?: boolean; email?: string; code?: string; onCode?: (v: string) => void; onSubmit?: (code?: string) => void; busy?: boolean
  /** a mező alatti piros sor (pl. „Hibás kód — még 4 próbálkozás.”) */
  error?: string | null
  onOtherEmail?: () => void; onResend?: () => void
  /** másodperc az újraküldésig (0: most kérhető) */
  resendIn?: number
  submitLabel?: string
}) {
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit?.() }
  const mmss = `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`
  return (
    <form onSubmit={submit} noValidate>
      {dark ? <div className="text-ui-num font-light uppercase leading-tight ui-photo-text">Írd be<br />a kódot</div> : <div className="text-ui-sub font-light text-ui-text">Írd be a kódot</div>}
      <div className={`mt-1 text-ui-body ${dark ? 'mb-6 mt-3 text-ui-meta text-white/60' : 'text-ui-muted'}`}>Elküldtük ide: <span className={dark ? 'text-white' : 'text-ui-text'}>{email}</span></div>
      <CodeInput value={code} onChange={onCode} onComplete={onSubmit ? (v) => onSubmit(v) : undefined} autoFocus={!!onCode} error={!!error} className={dark ? '' : 'mt-6'} inputClassName={dark ? GLASS_CODE : undefined} />
      {error
        ? <div role="alert" className={`mt-2 text-ui-label ${dark ? 'text-ui-bad-bg' : 'text-ui-bad'}`}>{error}</div>
        : <div className={`mt-2 text-ui-label ${dark ? 'text-white/50' : 'text-ui-muted'}`}>10 percig érvényes. Nem jött meg? Nézd meg a Spam mappát.</div>}
      <Button type="submit" variant={dark ? 'glass' : 'dark'} loading={busy} disabled={code.length < 6 && !!onCode} className={`mt-5 w-full ${dark ? 'bg-white' : ''}`}>{submitLabel}<ArrowRight className="h-4 w-4" /></Button>
      <div className="mt-4 flex justify-between text-ui-meta">
        <button type="button" onClick={onOtherEmail} className={`underline underline-offset-4 outline-none ${dark ? 'text-white/80' : 'text-ui-text'}`}>Másik e-mail</button>
        {resendIn > 0
          ? <span className={dark ? 'text-white/50' : 'text-ui-muted'}>Újraküldés {mmss}</span>
          : <button type="button" onClick={onResend} className={`underline underline-offset-4 outline-none ${dark ? 'text-white/80' : 'text-ui-text'}`}>Új kód küldése</button>}
      </div>
    </form>
  )
}
