'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Code2, Copy, Share2 } from 'lucide-react'
import { Button, Field, FieldRow, IconButton, IconCircle, Input, ListRow, Meta, Modal, Segmented, Textarea } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { Switch } from '@/components/ui/toggle-switch'
import { IntegrationsPage, SettingsGroup } from '@/components/blocks/settings'
import { ImportPanel } from './ImportPanel'
import type { FeatureModules } from '@/lib/featureModules'

/**
 * Beállítások › API & integrációk (design 16.15.2) — a design `IntegrationsPage` blokkja élő adattal: naptár-feliratkozás,
 * Zapier / Make webhook (a foglalás-eseményeket a `webhookOnBooking` hook küldi; próba-küldés: `/api/integrations/
 * webhook-test`), GA4 / Meta Pixel, és az import (a varázsló a közös felugró ablakban). A lap alján, amíg a megosztó
 * panel (Áttekintés › Indulás) élesbe nem kerül: az Instagram / Facebook „Foglalj” gomb és a weboldalba ágyazás.
 * A mentés (webhook, mérés, „Foglalj” önbevallás) a hub közös sávján megy.
 */

interface Props {
  /** a foglalóoldal QR-kódjának kezelője (felugró ablak) */
  qr?: React.ReactNode
  variant: 'salon' | 'restaurant'
  businessId: string
  bookingUrl: string
  icalUrl: string
  embedUrl: string
  embedSmartSnippet: string
  apiBase: string
  webhookUrl?: string | null
  ga4Id?: string | null
  facebookPixelId?: string | null
  initialFeatureModules?: FeatureModules
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}

const copy = (text: string, what = 'Link') => { void navigator.clipboard?.writeText(text).then(() => toast.success(`${what} másolva`)).catch(() => toast.error('A másolás nem sikerült')) }
const validWebhook = (v: string) => { try { return new URL(v).protocol === 'https:' } catch { return false } }

export function IntegrationsPanel({ variant, businessId, bookingUrl, icalUrl, embedUrl, embedSmartSnippet, apiBase, webhookUrl, ga4Id, facebookPixelId, initialFeatureModules, onDirtyChange, registerApi, qr }: Props) {
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="700" style="border:0"></iframe>`
  const [webhook, setWebhook] = useState(webhookUrl ?? '')
  const [ga4, setGa4] = useState(ga4Id ?? '')
  const [pixel, setPixel] = useState(facebookPixelId ?? '')
  const [fbConfirmed, setFbConfirmed] = useState(!!initialFeatureModules?.facebook_booking_confirmed)
  const [platform, setPlatform] = useState(0)
  const [social, setSocial] = useState(0)
  const [embedMode, setEmbedMode] = useState(0)
  const [testBusy, setTestBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  // az eszköz szerinti naptár-fül (Apple / Android → Google / egyéb)
  useEffect(() => { const ua = navigator.userAgent; setPlatform(/iP(hone|ad|od)|Macintosh/.test(ua) ? 1 : 0) }, [])

  const webhookError = webhook.trim() && !validWebhook(webhook.trim()) ? 'Csak https:// kezdetű cím lehet.' : undefined
  const dirty = webhook !== (webhookUrl ?? '') || ga4 !== (ga4Id ?? '') || pixel !== (facebookPixelId ?? '') || fbConfirmed !== !!initialFeatureModules?.facebook_booking_confirmed
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useRef({ webhook, ga4, pixel, fbConfirmed })
  ref.current = { webhook, ga4, pixel, fbConfirmed }
  useEffect(() => {
    registerApi?.({
      save: async () => {
        const c = ref.current
        if (c.webhook.trim() && !validWebhook(c.webhook.trim())) { setShowErrors(true); toast.error('A webhook címe nem jó'); return false }
        try {
          const res = await fetch(apiBase, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({
              webhook_url: c.webhook.trim() || null,
              marketing_tracking: { ga4_measurement_id: c.ga4.trim() || null, facebook_pixel_id: c.pixel.trim() || null },
              ...(initialFeatureModules ? { feature_modules: { ...initialFeatureModules, facebook_booking_confirmed: c.fbConfirmed } } : {}),
            }),
          })
          if (!res.ok) throw new Error()
          setShowErrors(false)
          return true
        } catch { toast.error('Nem sikerült menteni'); return false }
      },
      discard: () => { setWebhook(webhookUrl ?? ''); setGa4(ga4Id ?? ''); setPixel(facebookPixelId ?? ''); setFbConfirmed(!!initialFeatureModules?.facebook_booking_confirmed); setShowErrors(false) },
    })
  }, [webhookUrl, ga4Id, facebookPixelId, initialFeatureModules]) // eslint-disable-line react-hooks/exhaustive-deps

  const testWebhook = async () => {
    if (webhookError) { setShowErrors(true); return }
    setTestBusy(true)
    try {
      const r = await fetch('/api/integrations/webhook-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind: variant, businessId, url: webhook.trim() }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'A küldés nem sikerült')
      toast.success(`Minta-foglalás elküldve (${j.status})`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'A küldés nem sikerült') } finally { setTestBusy(false) }
  }

  const socialSteps = social === 0
    ? ['Instagram › a business profilod › Profil szerkesztése', 'Műveletgombok › Gomb hozzáadása › Időpont foglalása', 'Illeszd be a fenti linket › Kész']
    : ['A Facebook-oldalad › Gomb hozzáadása (a borítókép alatt)', 'Időpont foglalása › Hivatkozás webhelyre', 'Illeszd be a fenti linket › Mentés']
  const snippet = embedMode === 0 ? embedSmartSnippet : embedSnippet

  return (
    <>
      <IntegrationsPage save={false} qr={qr}
        ical={{ url: icalUrl, onCopy: () => copy(icalUrl) }} platform={platform} onPlatform={setPlatform}
        webhook={{ value: webhook, onChange: setWebhook, error: showErrors || webhookError ? webhookError : undefined, onTest: () => void testWebhook(), testBusy }}
        tracking={{ ga4, onGa4: setGa4, pixel, onPixel: setPixel }}
        onImport={() => setImportOpen(true)} sampleHref={`/api/import-csv/sample?kind=${variant}`}
        extra={<>
          <SettingsGroup icon={Share2} title="„Foglalj” gomb — Instagram és Facebook">
            <div className="mt-1 flex items-center gap-1.5"><Input value={bookingUrl} readOnly className="min-w-0 flex-1" /><IconButton icon={Copy} label="Link másolása" variant="yellow" onClick={() => copy(bookingUrl)} /></div>
            <Segmented tone="cell" size="sm" className="mt-3" options={['Instagram', 'Facebook']} active={social} onSelect={setSocial} />
            <div className="mt-2 space-y-1">
              {socialSteps.map((t, i) => <ListRow key={t} filled leading={<IconCircle tone="dark" size="sm">{i + 1}</IconCircle>} title={t} />)}
            </div>
            <FieldRow boxed label="Beállítottam" hint="a Meta oldalán történik — itt csak jelölöd" className="mt-2"><Switch checked={fbConfirmed} onChange={setFbConfirmed} ariaLabel="Foglalj gomb beállítva" /></FieldRow>
          </SettingsGroup>
          <SettingsGroup icon={Code2} title="Beágyazás a saját weboldaladba">
            <Segmented tone="cell" size="sm" className="mt-1" options={['Automatikus méret', 'Fix méretű iframe']} active={embedMode} onSelect={setEmbedMode} />
            <Meta className="mt-2">{embedMode === 0 ? 'Ajánlott — a foglaló mindig akkora helyet foglal, amennyi a tartalmához kell.' : 'Ha a weboldal-szerkesztőd nem enged <script> kódot. A magasságot nyugodtan módosítsd.'}</Meta>
            <Field label="Kód" className="mt-2"><Textarea value={snippet} readOnly rows={4} className="font-mono text-ui-label" /></Field>
            <Button variant="cell" size="sm" icon={Copy} className="mt-2" onClick={() => copy(snippet, 'Kód')}>Kód másolása</Button>
          </SettingsGroup>
        </>} />

      <PopupModal open={importOpen} onClose={() => setImportOpen(false)} panel={importOpen ? (
        <Modal size="xl" title="Adatok importálása" subtitle="Vendégek, foglalások és más adatok egy másik rendszerből — CSV vagy Excel" onClose={() => setImportOpen(false)}>
          <ImportPanel kind={variant} sampleHref={`/api/import-csv/sample?kind=${variant}`} />
        </Modal>
      ) : undefined} />
    </>
  )
}
