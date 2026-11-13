import { BarChart3, Lock, Megaphone, ShieldCheck } from 'lucide-react'
import { Button, Card, IconCircle, Meta, Modal } from '@/components/ui-kit'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { Switch } from '@/components/ui/toggle-switch'

/* Sütik a foglalóoldalon (design 21.x) — csak akkor jelenik meg, ha a vállalkozó beállított mérést (Google Analytics,
 * Meta Pixel); enélkül a foglalóoldal nem tesz le nem-szükséges sütit, így nem is kérdez. A mérést a VÁLLALKOZÓ végzi
 * (ő az adatkezelő) — ezért az ő neve szerepel. Az elutasítás ugyanolyan könnyű, mint az elfogadás; a döntés bármikor
 * módosítható a lábléc „Süti-beállítások” linkjével. Kis, önálló fájl — a foglalóoldal nehéz blokkjait nem húzza be. */

export const TRACKING_LABELS: Record<string, string> = { ga4: 'Google Analytics', pixel: 'Meta Pixel' }
const toolList = (tools: string[]) => tools.map((t) => TRACKING_LABELS[t] ?? t).join(', ')

/** A design-minta (21.14) szövegei — a vállalkozó mérése. Élőben a sáv a landingével azonos általános szöveg, a részletek
 *  (ki, mivel, mire) a beállítások-popupban, név szerint (`CookieChoices`). */
function texts(business: string, tools: string[]) {
  return {
    bar: `${business} a foglalóoldal látogatottságát méri (${toolList(tools)}), hogy jobban elérje a vendégeit.`,
    row: `${toolList(tools)} — ${business} méri, honnan érkeznek a vendégek, és mely hirdetések működnek.`,
    who: `A mérést ${business} végzi, ő az adatkezelő.`,
    title: 'Mérhetjük a látogatást?',
  }
}

/** Az alsó sáv: ki és mire használ sütit, a részletek linkje, két egyforma gomb. Élőben `onAccept` / `onReject` / `onDetails`. */
export function CookieBar({ business = 'Anna Fodrászat', tools = ['ga4', 'pixel'], platform = false, policyHref = '/cookies', onAccept, onReject, onDetails, className = '' }: {
  business?: string; tools?: string[]; platform?: boolean; policyHref?: string; onAccept?: () => void; onReject?: () => void; onDetails?: () => void; className?: string
}) {
  return (
    <Card tone="dark" className={`flex flex-col gap-4 sm:flex-row sm:items-center ${className}`}>
      {platform ? (
        /* élőben: ugyanaz a szöveg, mint a landing sávján — ikon nélkül; a kötelező: a tájékoztató linkje és a két egyforma gomb
           + a „Beállítások” (a részletes választás elsőre is elérhető); később a lábléc „Süti-beállítások” linkje */
        <span className="min-w-0 flex-1 text-ui-row leading-relaxed text-white">
          Sütiket használunk az oldal működéséhez és a felhasználói élmény javításához. Részletek a{' '}
          <a href={policyHref} className="underline underline-offset-2 outline-none">süti-tájékoztatóban</a>.{' '}
          {onDetails && <button type="button" onClick={onDetails} className="text-white/70 underline underline-offset-2 outline-none hover:text-white">Beállítások</button>}
        </span>
      ) : (<>
      <IconCircle tone="onDark" size="lg" icon={BarChart3} className="max-sm:hidden" />
      <span className="min-w-0 flex-1">
        <span className="block text-ui-row text-white">{texts(business, tools).title}</span>
        <Meta dark className="mt-1 leading-relaxed">
          {texts(business, tools).bar} A foglaláshoz nem kell elfogadnod.{' '}
          {onDetails ? <button type="button" onClick={onDetails} className="text-white underline underline-offset-2 outline-none">Részletek és beállítások</button> : <span className="text-white underline underline-offset-2">Részletek és beállítások</span>}
        </Meta>
      </span>
      </>)}
      {/* a két gomb egyforma — az elutasítás ugyanolyan könnyű, mint az elfogadás */}
      <span className="flex shrink-0 gap-1.5">
        <Button variant="ghostDark" className="flex-1 sm:flex-none" onClick={onReject}>Elutasítom</Button>
        <Button variant="yellow" className="flex-1 sm:flex-none" onClick={onAccept}>Elfogadom</Button>
      </span>
    </Card>
  )
}

/** A beállítások (a közös popupban): a szükséges sütik (mindig — a foglalás működéséhez), és a mérés kapcsolója a
 *  vállalkozó nevével és az eszközökkel; az adatkezelési tájékoztató linkje. Élőben `measure` + `onMeasure`, `onSave`. */
export function CookieSettings({ business = 'Anna Fodrászat', tools = ['ga4', 'pixel'], measure = false, onMeasure, onSave, onClose, privacyHref }: {
  business?: string; tools?: string[]; measure?: boolean; onMeasure?: (on: boolean) => void; onSave?: () => void; onClose?: () => void; privacyHref?: string
}) {
  return (
    <Modal size="sm" title="Süti-beállítások" subtitle={`${business} foglalóoldala`} onClose={onClose}
      footer={<Button className="w-full" onClick={onSave}>Mentés</Button>}>
      <CookieSettingsBody business={business} tools={tools} measure={measure} onMeasure={onMeasure} privacyHref={privacyHref} />
    </Modal>
  )
}

/** A design-minta beállításainak tartalma. */
function CookieSettingsBody({ business = 'Anna Fodrászat', tools = ['ga4', 'pixel'], measure = false, onMeasure, privacyHref, privacyLabel = 'Adatkezelési tájékoztató' }: {
  business?: string; tools?: string[]; measure?: boolean; onMeasure?: (on: boolean) => void; privacyHref?: string; privacyLabel?: string
}) {
  const t = texts(business, tools)
  const row = (icon: typeof Lock, title: string, desc: string, ctl: React.ReactNode) => (
    <div className="flex items-start gap-3 rounded-ui-inner bg-ui-cell p-3">
      <IconCircle tone="white" size="md" icon={icon} />
      <span className="min-w-0 flex-1"><span className="block text-ui-row text-ui-text">{title}</span><Meta className="mt-0.5 leading-relaxed">{desc}</Meta></span>
      <span className="shrink-0 pt-1">{ctl}</span>
    </div>
  )
  return (
    <>
      <div className="space-y-1.5">
        {row(Lock, 'Szükséges', 'A foglalás működéséhez kellenek (pl. a kiválasztott időpont megtartása, a fizetés). Nem kapcsolhatók ki.', <Meta>mindig</Meta>)}
        {row(BarChart3, 'Látogatottság mérése', t.row,
          onMeasure ? <Switch checked={measure} onChange={onMeasure} ariaLabel="Látogatottság mérése" /> : <DesignSwitch defaultOn={measure} />)}
      </div>
      <Meta className="mt-4 flex items-start gap-1.5 leading-relaxed"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t.who} {privacyHref ? <a href={privacyHref} className="text-ui-text underline underline-offset-2">{privacyLabel}</a> : <span className="text-ui-text underline underline-offset-2">{privacyLabel}</span>}</span>
      </Meta>
    </>
  )
}

/** A lábléc linkje (a „Powered by” mellé) — a döntés bármikor módosítható. */
export function CookieFooterLink({ onClick, dark = false }: { onClick?: () => void; dark?: boolean }) {
  const tone = dark ? 'text-white/55' : 'text-ui-muted'
  return onClick
    ? <button type="button" onClick={onClick} className={`text-ui-label ${tone} underline-offset-2 outline-none hover:underline`}>Süti-beállítások</button>
    : <span className={`text-ui-label ${tone}`}>Süti-beállítások</span>
}


/** Élő süti-beállítások (a közös PopupModalban): kategóriánként, név szerint — ki méri, mivel, mire, ki az adatkezelő.
 *  - Szükséges: mindig (nem kapcsolható ki).
 *  - Látogatottság mérése: a davelopment booking (Google Analytics) — mindig fut a foglalóoldalon.
 *  - A vállalkozó saját mérése: csak ha beállított (Google Analytics / Meta Pixel); adatkezelő a vállalkozó — külön kapcsoló. */
export function CookieChoices({ business, tools, stats, onStats, biz, onBiz, policyHref = '/cookies', bizPrivacyHref }: {
  business: string; tools: string[]; stats: boolean; onStats: (on: boolean) => void; biz: boolean; onBiz: (on: boolean) => void; policyHref?: string
  /** a vállalkozó saját adatkezelési tájékoztatója (ha megadta) */
  bizPrivacyHref?: string
}) {
  const row = (icon: typeof Lock, title: string, desc: React.ReactNode, ctl: React.ReactNode) => (
    <div className="flex items-start gap-3 rounded-ui-inner bg-ui-cell p-3">
      <IconCircle tone="white" size="md" icon={icon} />
      <span className="min-w-0 flex-1"><span className="block text-ui-row text-ui-text">{title}</span><Meta className="mt-0.5 leading-relaxed">{desc}</Meta></span>
      <span className="shrink-0 pt-1">{ctl}</span>
    </div>
  )
  const hasPixel = tools.includes('pixel')
  return (
    <>
      <div className="space-y-1.5">
        {row(Lock, 'Feltétlenül szükséges sütik', <>Ezek nélkül az oldal nem működne: megjegyzik a választott nyelvet és időpontot, és biztonságossá teszik a fizetést.</>, <Meta>mindig aktív</Meta>)}
        {row(BarChart3, 'Statisztikai sütik', <>Segítenek megérteni, hogyan használják az oldalt (pl. hányan nézik meg), név nélkül. Ebből fejlesztjük a foglalórendszert. Szolgáltató: Google Analytics.</>,
          <Switch checked={stats} onChange={onStats} ariaLabel="Statisztikai sütik" />)}
        {tools.length > 0 && row(Megaphone, hasPixel ? `Marketing sütik — ${business}` : `Statisztikai sütik — ${business}`, <>{hasPixel ? 'Látogatottság és hirdetések mérése' : 'Látogatottság mérése'} — honnan érkeznek a vendégek{hasPixel ? ', és mely hirdetések működnek' : ''}. Szolgáltató: {toolList(tools)}. Adatkezelő: {business}.{bizPrivacyHref && <> <a href={bizPrivacyHref} target="_blank" rel="noopener noreferrer" className="text-ui-text underline underline-offset-2">Adatkezelési tájékoztató</a></>}</>,
          <Switch checked={biz} onChange={onBiz} ariaLabel={hasPixel ? 'Marketing sütik' : `${business} mérése`} />)}
      </div>
      <Meta className="mt-4 flex items-start gap-1.5 leading-relaxed"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>A döntésed bármikor módosíthatod az oldal alján, a „Süti-beállítások” linkkel. Részletek: <a href={policyHref} className="text-ui-text underline underline-offset-2">Süti-tájékoztató</a></span>
      </Meta>
    </>
  )
}
