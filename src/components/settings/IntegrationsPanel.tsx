'use client'

import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Upload, Link2, Webhook, MapPin, Share2, Calendar,
  ChevronDown, ChevronRight, Check, Copy, Loader2, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImportPanel } from './ImportPanel'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  variant: 'salon' | 'restaurant'
  bookingUrl: string
  icalUrl: string
  apiBase: string
  webhookUrl?: string | null
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyBtn({ value, label = 'Másolás' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Másolva' : label}
    </button>
  )
}

// ── URL display row ────────────────────────────────────────────────────────

function UrlRow({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-line bg-[#FBF9F2] px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-soft">{url}</span>
      <CopyBtn value={url} />
    </div>
  )
}

// ── Step list ──────────────────────────────────────────────────────────────

function Steps({ steps }: { steps: (string | ReactNode)[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-[13px] text-ink-soft leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[10px] font-bold text-white">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

// ── Integration card ───────────────────────────────────────────────────────

type CardStatus = 'active' | 'setup' | 'soon'

function IntegCard({
  icon: Icon,
  title,
  description,
  status,
  children,
  defaultOpen = false,
}: {
  icon: typeof Upload
  title: string
  description: string
  status: CardStatus
  children?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const statusCfg: Record<CardStatus, { label: string; cls: string }> = {
    active:  { label: 'Aktív',       cls: 'bg-[#E3F0D8] text-[#4A7A2A]' },
    setup:   { label: 'Beállítható', cls: 'bg-[#FDF3CF] text-[#8A6D12]' },
    soon:    { label: 'Hamarosan',   cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
  }
  const { label, cls } = statusCfg[status]

  return (
    <div className="rounded-[20px] dav-card-glass overflow-hidden">
      <button
        type="button"
        onClick={() => status !== 'soon' && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
          status !== 'soon' ? 'hover:bg-black/[0.02] cursor-pointer' : 'cursor-default',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FBF9F2]">
          <Icon className="h-5 w-5 text-ink-soft2" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-ink">{title}</span>
            <span className={`rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
        </div>
        {status !== 'soon' && (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-soft2 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && children && (
        <div className="border-t border-line px-5 pb-5 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Webhook save ───────────────────────────────────────────────────────────

function WebhookConfig({ apiBase, initialUrl }: { apiBase: string; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ webhook_url: url.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Webhook URL mentve')
    } catch {
      toast.error('Nem sikerült menteni')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-medium text-ink mb-1.5">Zapier / Make webhook URL</p>
        <p className="text-[12.5px] text-ink-soft mb-3">
          Hozz létre egy Zap-et a Zapier-en „Catch Hook" triggerrel, másold be az ott generált URL-t, és mentsd el. Minden új foglalásnál automatikusan POST-ot küldünk erre a végpontra.
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className="flex-1 rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-soft2 focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[12px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function IntegrationsPanel({ variant, bookingUrl, icalUrl, apiBase, webhookUrl }: Props) {
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
        title="iCal / webcal naptár-feed"
        description="Foglalásaid megjelennek az Apple Calendar, Google Naptár vagy Outlook alkalmazásban"
        status="setup"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">Egyedi naptár-link</p>
            <UrlRow url={icalUrl} />
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-ink">Beállítás lépései</p>
            <div className="space-y-3">
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink list-none">
                  <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  iPhone / iPad (Apple Calendar)
                </summary>
                <div className="ml-6 mt-2">
                  <Steps steps={[
                    'Nyisd meg a Naptár appot',
                    <>Menj ide: <strong>Naptárak</strong> → <strong>+</strong> (bal alul) → <strong>Feliratkozás naptárra</strong></>,
                    'Illeszd be a fenti linket',
                    <>Adj meg egy nevet (pl. <em>Foglalások</em>), majd nyomj <strong>Feliratkozás</strong>-t</>,
                    'A foglalások automatikusan megjelennek és szinkronizálódnak',
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
                    <>Kattints a bal oldali <strong>Más naptárak</strong> melletti <strong>+</strong> gombra</>,
                    <>Válaszd: <strong>URL-ről</strong></>,
                    'Illeszd be a fenti linket, majd kattints a Naptár hozzáadása gombra',
                    'A foglalások megjelennek — a szinkron kb. 24 óránként frissül',
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
                    <>Outlook Webes: <strong>Naptár hozzáadása</strong> → <strong>Feliratkozás az internetről</strong></>,
                    'Illeszd be a fenti linket',
                    <>Adj meg egy nevet, majd kattints <strong>Importálás</strong>-ra</>,
                    'Asztali Outlook: Fájl → Fiókbeállítások → Internet-naptárak → Új → link beillesztése',
                  ]} />
                </div>
              </details>
            </div>
          </div>
        </div>
      </IntegCard>

      {/* ── Google Cégem ── */}
      <IntegCard
        icon={MapPin}
        title={'Google Cégem — „Foglalj most”'}
        description={'„Foglalj most" gomb a Google keresési találatokban és Google Maps-en'}
        status="setup"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">A foglalási link, amit be kell illesztened</p>
            <UrlRow url={bookingUrl} />
          </div>
          <Steps steps={[
            <>Nyisd meg a <a href="https://business.google.com" target="_blank" rel="noopener" className="text-gold underline underline-offset-2">business.google.com</a> oldalt és jelentkezz be a céges Google-fiókoddal</>,
            'Válaszd ki a vállalkozásod a listából',
            <>A bal menüben kattints: <strong>Foglalások</strong> (vagy <em>Booking</em>)<br /><span className="text-[12px] text-ink-soft">Ha nem látod, keresd a „Foglalás gomb" menüpontot</span></>,
            <>Válaszd ki a szolgáltatót: <strong>„Saját webhely link"</strong> vagy <strong>„Egyedi link"</strong>, majd illeszd be a fenti URL-t</>,
            <>Mentsd el — a <strong>„Foglalj most"</strong> gomb néhány órán belül megjelenik a Google listingeden</>,
          ]} />
          <a
            href="https://support.google.com/business/answer/9308244"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Google súgó: Foglalás gomb beállítása
          </a>
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
          <WebhookConfig apiBase={apiBase} initialUrl={webhookUrl ?? ''} />

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

      {/* ── Google Calendar OAuth ── */}
      <IntegCard
        icon={Calendar}
        title="Google Calendar kétirányú szinkron"
        description="Foglalások ↔ Google Naptár valós idejű szinkronizálása — elfoglaltságok automatikus blokkolása"
        status="soon"
      />
    </div>
  )
}
