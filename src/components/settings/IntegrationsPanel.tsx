'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Upload, Link2, Webhook, Share2, Calendar, Code2, BarChart3, KeyRound,
  ChevronRight,
} from 'lucide-react'
import { ImportPanel } from './ImportPanel'
import { IntegCard, UrlRow, SnippetBox, Steps } from './IntegCardKit'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  variant: 'salon' | 'restaurant'
  bookingUrl: string
  icalUrl: string
  embedUrl: string
  /** Kész `<div>` + `<script src=".../embed.js">` snippet — automatikus magasság-igazítással. */
  embedSmartSnippet: string
  apiBase: string
  webhookUrl?: string | null
  ga4Id?: string | null
  facebookPixelId?: string | null
  /** A Webhook + Marketing-követés kártyák összevont mentetlen-állapota — a hub közös lebegő
   *  sávjának. (A többi kártya nem tartalmaz szerkeszthető, mentendő mezőt.) */
  onDirtyChange?: (dirty: boolean) => void
  /** A hub ezen regisztrálja a mentés/elvetés műveletet. */
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}

// ── iCal CTA — platform-érzékeny ──────────────────────────────────────────

function ICalCta({ icalUrl }: { icalUrl: string }) {
  const [platform, setPlatform] = useState<'apple' | 'google' | 'other' | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    if (/iP(hone|ad|od)|Macintosh/.test(ua)) setPlatform('apple')
    else if (/Android/.test(ua)) setPlatform('google')
    else setPlatform('other')
  }, [])

  const webcalUrl = icalUrl.replace(/^https?:\/\//, 'webcal://')
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icalUrl)}`

  if (!platform) return null

  if (platform === 'apple') {
    return (
      <a
        href={webcalUrl}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-80"
      >
        <Calendar className="h-4 w-4" />
        Hozzáadás a naptáramhoz
      </a>
    )
  }

  if (platform === 'google') {
    return (
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-80"
      >
        <Calendar className="h-4 w-4" />
        Megnyitás Google Naptárban
      </a>
    )
  }

  // Windows / egyéb — csak a linket kínáljuk másolásra
  return (
    <div className="rounded-[12px] border border-line bg-[#FBF9F2] px-4 py-3 space-y-1.5">
      <p className="text-[12px] font-medium text-ink">Naptár feliratkozási link</p>
      <p className="text-[11.5px] text-ink-soft">Másold be Outlookba vagy más naptár alkalmazásba</p>
    </div>
  )
}

// ── Webhook config — kontrollált (a mentés a hub közös lebegő sávjából) ────

function WebhookConfig({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-medium text-ink mb-1.5">Zapier / Make webhook URL</p>
        <p className="text-[12.5px] text-ink-soft mb-3">
          Hozz létre egy Zap-et a Zapier-en „Catch Hook" triggerrel, másold be az ott generált URL-t, és mentsd el. Minden új foglalásnál automatikusan POST-ot küldünk erre a végpontra.
        </p>
        <input
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-soft2 focus:border-gold focus:outline-none"
        />
      </div>
    </div>
  )
}

// ── Marketing-követés — kontrollált (a mentés a hub közös lebegő sávjából) ─

function MarketingTrackingConfig({
  ga4Id,
  pixelId,
  onGa4Change,
  onPixelChange,
}: {
  ga4Id: string
  pixelId: string
  onGa4Change: (v: string) => void
  onPixelChange: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-ink-soft">
        Csak akkor jelenik meg bármelyik követő-kód a publikus foglaló oldalon, ha kitöltöd az azonosítóját. Foglalás sikeres létrejöttekor egy anonim eseményt küldünk — a vendég neve, telefonja vagy e-mail címe SOHA nem kerül bele.
      </p>
      <div>
        <p className="text-[13px] font-medium text-ink mb-1.5">Google Analytics 4 mérési azonosító</p>
        <input
          value={ga4Id}
          onChange={(e) => onGa4Change(e.target.value)}
          placeholder="G-XXXXXXXXXX"
          className="w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-soft2 focus:border-gold focus:outline-none"
        />
      </div>
      <div>
        <p className="text-[13px] font-medium text-ink mb-1.5">Facebook (Meta) Pixel ID</p>
        <input
          value={pixelId}
          onChange={(e) => onPixelChange(e.target.value)}
          placeholder="123456789012345"
          className="w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-soft2 focus:border-gold focus:outline-none"
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function IntegrationsPanel({ variant, bookingUrl, icalUrl, embedUrl, embedSmartSnippet, apiBase, webhookUrl, ga4Id, facebookPixelId, onDirtyChange, registerApi }: Props) {
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="700" style="border:0"></iframe>`

  const [webhook, setWebhook] = useState(webhookUrl ?? '')
  const [ga4, setGa4] = useState(ga4Id ?? '')
  const [pixel, setPixel] = useState(facebookPixelId ?? '')

  const dirty = webhook !== (webhookUrl ?? '') || ga4 !== (ga4Id ?? '') || pixel !== (facebookPixelId ?? '')
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    registerApi?.({
      save: async () => {
        try {
          const res = await fetch(apiBase, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              webhook_url: webhook.trim() || null,
              marketing_tracking: {
                ga4_measurement_id: ga4.trim() || null,
                facebook_pixel_id: pixel.trim() || null,
              },
            }),
          })
          if (!res.ok) throw new Error()
          return true
        } catch {
          toast.error('Nem sikerült menteni')
          return false
        }
      },
      discard: () => {
        setWebhook(webhookUrl ?? '')
        setGa4(ga4Id ?? '')
        setPixel(facebookPixelId ?? '')
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhook, ga4, pixel, webhookUrl, ga4Id, facebookPixelId])

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-soft">
        Kösd be a foglalórendszert külső eszközökhöz — naptárakhoz, marketplace-ekhez, automatizációs platformokhoz.
      </p>

      {/* ── Adatok importálása ── */}
      <IntegCard
        icon={Upload}
        title="Adatok importálása"
        description="Foglalások, vendégek, munkatársak, nyitvatartás és egyéb adatok behozatala más rendszerből"
        status="setup"
        defaultOpen={false}
      >
        <ImportPanel />
      </IntegCard>

      {/* ── iCal / webcal ── */}
      <IntegCard
        icon={Link2}
        title="Foglalások a saját naptáradban"
        description="Az összes beérkező foglalás automatikusan megjelenik az iPhone, Google Naptár vagy Outlook appodban"
        status="active"
      >
        <div className="space-y-4">
          {/* Elsődleges CTA — platform szerint más viselkedés */}
          <ICalCta icalUrl={icalUrl} />

          {/* Link kézi másoláshoz */}
          <div>
            <p className="text-[12px] font-medium text-ink-soft mb-1.5">Vagy másold be kézzel</p>
            <UrlRow url={icalUrl} />
          </div>

          {/* Platformonkénti lépések */}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-ink-soft uppercase tracking-[0.10em]">Kézi beállítás lépései</p>
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                iPhone / iPad (Apple Calendar)
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Menj ide: <strong>Beállítások</strong> → <strong>Naptár</strong> → <strong>Fiókok</strong> → <strong>Fiók hozzáadása</strong> → <strong>Más</strong></>,
                  <>Válaszd: <strong>CalDAV-fiók hozzáadása</strong> helyett <strong>Feliratkozott naptárak</strong></>,
                  'Illeszd be a fenti linket, majd nyomj Tovább-t',
                  'A foglalások automatikusan szinkronizálódnak',
                ]} />
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Google Naptár (böngésző)
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Nyisd meg a <strong>calendar.google.com</strong> oldalt</>,
                  <>Kattints a <strong>Más naptárak +</strong> gombra (bal oldal, lent)</>,
                  <>Válaszd: <strong>URL-ről</strong> → illeszd be a linket → <strong>Naptár hozzáadása</strong></>,
                  'Szinkron kb. 12–24 óránként frissül automatikusan',
                ]} />
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Outlook (asztali / web)
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Web: <strong>Naptár hozzáadása</strong> → <strong>Feliratkozás az internetről</strong> → link beillesztése</>,
                  <>Asztali: <strong>Fájl</strong> → <strong>Fiókbeállítások</strong> → <strong>Internet-naptárak</strong> → <strong>Új</strong> → link</>,
                ]} />
              </div>
            </details>
          </div>
        </div>
      </IntegCard>

      {/* ── Meta (Facebook/Instagram) ── */}
      <IntegCard
        icon={Share2}
        title={'Facebook / Instagram — „Foglalj" gomb'}
        description="Időpont-foglalás gomb közvetlenül az Instagram és Facebook business oldalon"
        status="setup"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">A foglalási link, amit be kell illesztened</p>
            <UrlRow url={bookingUrl} />
          </div>

          <div className="space-y-3">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Instagram beállítás
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Nyisd meg az Instagram alkalmazást és menj a <strong>business profilodra</strong></>,
                  <>Koppints a <strong>Profil szerkesztése</strong> gombra</>,
                  <>Görgess le az <strong>Akció gombok</strong> szekcióhoz → <strong>Gomb hozzáadása</strong></>,
                  <>Válaszd: <strong>Foglalj</strong> vagy <strong>Időpont foglalása</strong></>,
                  <>Illeszd be a fenti URL-t → <strong>Kész</strong></>,
                  'A „Foglalj" gomb megjelenik a profilodon az összes követő számára',
                ]} />
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Facebook oldal beállítás
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Nyisd meg a <strong>Facebook business oldaladat</strong></>,
                  <>Kattints a <strong>Gomb hozzáadása</strong> gombra (az oldalad borítóképe alatt)</>,
                  <>Válaszd: <strong>Időpont foglalása</strong> vagy <strong>Vásárlás / Foglalás</strong></>,
                  <>Az URL-be illeszd be a fenti linket → <strong>Mentés</strong></>,
                  <>A gomb azonnal megjelenik az oldalad látogatói számára</>,
                ]} />
              </div>
            </details>
          </div>
        </div>
      </IntegCard>

      {/* ── Zapier / Make ── */}
      <IntegCard
        icon={Webhook}
        title="Zapier / Make webhook"
        description="Automatizáció: új foglalásnál értesítés, Google Sheets frissítés, Slack üzenet és más"
        status="setup"
      >
        <div className="space-y-4">
          <WebhookConfig url={webhook} onChange={setWebhook} />

          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-ink">Beállítás lépései (Zapier)</p>
            <Steps steps={[
              <>Regisztrálj vagy jelentkezz be a <a href="https://zapier.com" target="_blank" rel="noopener" className="text-gold underline underline-offset-2">zapier.com</a> oldalon (ingyenes csomag elegendő)</>,
              <>Kattints a <strong>Create Zap</strong> gombra</>,
              <>Trigger-nek válaszd: <strong>Webhooks by Zapier</strong> → <strong>Catch Hook</strong></>,
              <>Zapier mutat egy URL-t — másold be ide fent, majd mentsd el</>,
              <>Tesztelj: hozz létre egy próba foglalást, ellenőrizd hogy megérkezett a Zapier-re</>,
              <>Action-nek válassz bármit: <strong>Gmail</strong> (email küldés), <strong>Google Sheets</strong> (sor hozzáadása), <strong>Slack</strong> (üzenet) stb.</>,
            ]} />

            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                Make (korábban Integromat) beállítás
              </summary>
              <div className="ml-6 mt-2">
                <Steps steps={[
                  <>Nyisd meg a <a href="https://make.com" target="_blank" rel="noopener" className="text-gold underline underline-offset-2">make.com</a> oldalt, hozz létre egy új szcenáriót</>,
                  <>Modulnak válaszd: <strong>Webhooks</strong> → <strong>Custom webhook</strong></>,
                  <>Make generál egy URL-t — másold be ide fent és mentsd el</>,
                  <>Futtasd le egy próba foglalással, Make automatikusan azonosítja az adatstruktúrát</>,
                  <>Adj hozzá további modulokat az automatizációhoz</>,
                ]} />
              </div>
            </details>
          </div>
        </div>
      </IntegCard>

      {/* ── Marketing-követés (GA4, Facebook Pixel) ── */}
      <IntegCard
        icon={BarChart3}
        title="Marketing-követés"
        description="Mérd a saját Google/Facebook hirdetéseid megtérülését — Google Analytics 4 és Facebook Pixel"
        status={ga4Id || facebookPixelId ? 'active' : 'setup'}
      >
        <MarketingTrackingConfig ga4Id={ga4} pixelId={pixel} onGa4Change={setGa4} onPixelChange={setPixel} />
      </IntegCard>

      {/* ── Weboldalba/Facebook oldalba ágyazás ── */}
      <IntegCard
        icon={Code2}
        title="Beágyazás weboldalba"
        description="Illeszd be a foglalót közvetlenül a saját weboldaladba"
        status="active"
      >
        <div className="space-y-5">
          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">Ajánlott — automatikus méretezés</p>
            <p className="text-[12.5px] text-ink-soft mb-2">
              A foglaló mindig pontosan akkora helyet foglal el, amennyi a tartalmához kell — nincs felesleges üres hely vagy görgetés.
            </p>
            <SnippetBox code={embedSmartSnippet} />
          </div>

          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">Kézi (fix méretű iframe)</p>
            <p className="text-[12.5px] text-ink-soft mb-2">
              Akkor használd, ha a weboldal-szerkesztőd nem enged `&lt;script&gt;` kódot beilleszteni. A `height` értéket nyugodtan módosítsd — ha a tartalom nem fér el, a böngésző automatikusan görgethetővé teszi.
            </p>
            <SnippetBox code={embedSnippet} />
          </div>
        </div>
      </IntegCard>

      {/* ── Saját API & webhookok — ŐSZINTE „Hamarosan" üres állapot (nincs hamis kulcs/webhook). ── */}
      <IntegCard
        icon={KeyRound}
        title="API & webhookok"
        description="Nyilvános REST API-kulcsok és esemény-webhookok saját alkalmazásfejlesztéshez"
        status="soon"
      />
    </div>
  )
}
