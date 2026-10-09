'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Loader2, Trash2, Eye, ChevronDown } from 'lucide-react'
import { openEmailPreview } from '@/components/settings/emailPreviewUrl'
import { EmailTemplatesEditor } from '@/components/settings/EmailTemplatesEditor'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor, type TermsSection } from '@/components/settings/TermsSectionsEditor'
import type { GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import type { CustomQuestion } from '@/components/settings/CustomQuestionsEditor'
import type { EventTypeItem } from '@/components/settings/EventTypesEditor'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useLocalizedFields } from '@/components/settings/useLocalizedFields'
import type { ComposerBlock } from '@/lib/emailBlocks'
import { useSettingsFormContext } from '@/components/settings/settingsFormContext'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás.
 *  Opcionális `onPreview` esetén a Mentés mellett egy „Előnézet" gomb is megjelenik. */
function SaveBar({ dirty, submitting, onSave, onPreview }: { dirty: boolean; submitting: boolean; onSave: () => void; onPreview?: () => void }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2.5 rounded-[20px] border border-line bg-[var(--dav-glass-strong)] p-2.5 shadow-dav-card backdrop-blur sm:static sm:flex-nowrap sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || submitting}
        className="flex h-12 flex-1 items-center justify-center gap-2 px-6 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-70 sm:h-11 sm:flex-none"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Mentés...' : 'Mentés'}
      </button>
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="h-12 px-5 rounded-dav-pill border border-line-strong text-ink hover:bg-paper font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 sm:h-11"
        >
          <Eye className="h-4 w-4" />
          Előnézet
        </button>
      )}
      {dirty && <span className="w-full text-center text-xs font-medium text-gold sm:w-auto sm:text-left">Mentetlen változások</span>}
    </div>
  )
}

/** davelopment fül-navigáció (üveg konténer, aktív = ink pill). */
function TabsNav({ tabs, active, onSelect }: { tabs: { id: string; label: string; dirty?: boolean }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="-mx-5 flex gap-1 overflow-x-auto rounded-none border-y border-line bg-[var(--dav-glass)] px-5 py-1.5 no-scrollbar sm:mx-0 sm:rounded-2xl sm:border sm:px-1 sm:py-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-dav-pill px-4 py-2.5 text-[13px] font-semibold transition-colors sm:py-2 ${
            active === t.id ? 'bg-ink-dark text-white' : 'text-ink-soft2 hover:text-ink'
          }`}
        >
          {t.label}
          {t.dirty && <span title="Mentetlen változás" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
        </button>
      ))}
    </div>
  )
}

/** davelopment kapcsoló: be = ink track + sárga gomb, ki = világos. */
function ToggleSwitch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-soft">{description}</span>}
      </span>
      <span className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${checked ? 'bg-ink-dark' : 'bg-[#DAD6C8]'}`}>
        <span
          className={`absolute top-[3px] h-[21px] w-[21px] rounded-full shadow-sm transition-all ${
            checked ? 'right-[3px] bg-white' : 'left-[3px] bg-white'
          }`}
        />
      </span>
    </button>
  )
}

type Settings = {
  name: string
  slug: string
  city: string
  address: string
  phone: string
  email: string
  website: string
  social_links: string[]
  cover_focal_x: number
  cover_focal_y: number
  cover_zoom: number
  turn_duration_minutes: number
  slot_step_minutes: number
  last_seating_buffer_minutes: number
  lead_time_hours: number
  booking_window_days: number
  require_phone: boolean
  notify_new_bookings: boolean
  booking_email_subject: string
  booking_email_intro: ComposerBlock[]
  cancel_email_subject: string
  cancel_email_intro: ComposerBlock[]
  reminder_email_subject: string
  reminder_email_intro: ComposerBlock[]
  feedback_email_subject: string
  feedback_email_intro: ComposerBlock[]
  notify_email_subject: string
  notify_email_intro: ComposerBlock[]
  email_show_phone: boolean
  email_contact_phone: string
  email_show_email: boolean
  email_show_address: boolean
  email_show_directions: boolean
  email_directions_address: string
  email_show_terms: boolean
  legal_name: string
  tax_number: string
  company_reg_number: string
  registered_seat: string
  terms_sections: TermsSection[]
  good_to_know: GoodToKnowItem[]
  event_types: EventTypeItem[]
  custom_questions: CustomQuestion[]
  description: string
}

// Crextio/Apple mező: tiszta fehér + meleg hajszálvékony keret + arany fókusz-gyűrű (NINCS krém fill).
const inputClass =
  'h-[50px] w-full rounded-[14px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'

// A Nyitvatartás/Foglalások kártya-mintája: bordered + fejléc-elválasztó + 15px semibold cím.
/** `collapsible` esetén a szekció alapból csukott (`defaultOpen=false`, ha nincs felülírva) —
 *  a hosszú, ritkán szerkesztett listás szerkesztők (Jó tudni, Egyedi kérdések, Foglalási
 *  feltételek) így nem töltik ki felesleges hellyel az oldalt minden megnyitáskor. */
function Section({ title, children, full, id, collapsible, defaultOpen = false }: { title: string; children: React.ReactNode; full?: boolean; id?: string; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!collapsible || defaultOpen)
  // A nyitott/csukott állapot megjegyzése (localStorage) — csak kliens-oldali effektben
  // olvasunk, hogy az SSR-render és a hidratáció ne térjen el (nincs hydration-mismatch).
  useEffect(() => {
    if (!collapsible || !id) return
    try {
      const stored = window.localStorage.getItem(`davelopment-section-open:${id}`)
      if (stored !== null) setOpen(stored === '1')
    } catch { /* localStorage nem elérhető — marad a defaultOpen */ }
  }, [collapsible, id])
  const toggle = () => {
    setOpen((o) => {
      const next = !o
      if (collapsible && id) {
        try { window.localStorage.setItem(`davelopment-section-open:${id}`, next ? '1' : '0') } catch { /* no-op */ }
      }
      return next
    })
  }
  return (
    <div id={id} className={`rounded-[26px] dav-card-glass overflow-hidden font-onest scroll-mt-6 ${full ? 'lg:col-span-2' : ''}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={toggle}
          className={`flex w-full items-center justify-between px-5 py-4 sm:px-6 text-left ${open ? 'border-b border-line' : ''}`}
        >
          <span className="text-[15px] font-semibold text-ink">{title}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
      ) : (
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <span className="text-[15px] font-semibold text-ink">{title}</span>
        </div>
      )}
      {open && <div className="px-5 py-5 space-y-4 sm:px-6">{children}</div>}
    </div>
  )
}

export function RestaurantSettingsForm({
  restaurantId,
  restaurantName,
  businessCount = 1,
  initial,
  supportedLocales,
  controlledTab,
  hideTabsNav = false,
}: {
  restaurantId: number | string
  restaurantName: string
  businessCount?: number
  initial: Settings
  supportedLocales?: (Locale | string)[] | null
  /** Ha megadva, a Beállítások-hub bal listája vezérli az aktív fület (nincs belső fül-sor). */
  controlledTab?: string
  hideTabsNav?: boolean
}) {
  // Több-üzlet: ha a fióknak több üzlete van, csak EZT az éttermet töröljük (a fiók marad).
  const isLastBusiness = businessCount <= 1
  const router = useRouter()
  const [form, setForm] = useState<Settings>(initial)
  const [saved, setSaved] = useState<Settings>(initial) // utoljára elmentett állapot (dirty-hez)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // ── A foglalón kínált nyelvek (a Foglalóoldal-szerkesztő állítja; HU mindig fix alap) ──
  const savedSupported = resolveAvailableLocales(supportedLocales).filter((l) => l !== 'hu')

  // ── Localizált tartalom (email tárgy/intro, „jó tudni", feltételek) per-nyelv ──
  const loc = useLocalizedFields({
    collection: 'restaurants',
    id: restaurantId,
    supported: ['hu', ...savedSupported],
    huValues: {
      description: initial.description,
      booking_email_subject: initial.booking_email_subject,
      booking_email_intro: initial.booking_email_intro,
      cancel_email_subject: initial.cancel_email_subject,
      cancel_email_intro: initial.cancel_email_intro,
      reminder_email_subject: initial.reminder_email_subject,
      reminder_email_intro: initial.reminder_email_intro,
      feedback_email_subject: initial.feedback_email_subject,
      feedback_email_intro: initial.feedback_email_intro,
      notify_email_subject: initial.notify_email_subject,
      notify_email_intro: initial.notify_email_intro,
      terms_sections: initial.terms_sections.map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
      good_to_know: initial.good_to_know.map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
      event_types: initial.event_types.map((e) => ({ icon: e.icon ?? 'party', label: e.label ?? '', enabled: e.enabled ?? true })),
      custom_questions: initial.custom_questions.map((q) => ({
        id: q.id ?? crypto.randomUUID(),
        label: q.label ?? '',
        type: q.type ?? 'text',
        options: (q.options ?? []).map((o) => ({ value: o.value ?? '' })),
        required: q.required ?? false,
      })),
    },
  })

  // ── Fülek + mentetlen-változás védelem ──────────────────────────
  // Melyik mező melyik fülhöz tartozik (dirty-követés + per-tab mentés).
  // A localizált mezőket (good_to_know, terms_sections, booking_email_*) a `loc` hook kezeli.
  const TAB_FIELDS: Record<string, (keyof Settings)[]> = {
    email: ['email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address', 'email_show_terms'],
    documents: [],
    ownerEmail: [],
  }
  const LOC_TABS = new Set(['email', 'ownerEmail', 'documents'])
  const [internalTab, setActiveTab] = useState('email')
  // Vezérelt mód: ha a Beállítások-hub Providere körénk renderel, a context/prop dönt a fülről
  // ÉS elrejtjük a saját vízszintes fül-sort; különben a belső állapot + saját fülsor.
  const hubCtx = useSettingsFormContext()
  const embedded = hubCtx != null
  const activeTab = hubCtx?.controlledTab ?? controlledTab ?? internalTab
  // Fülváltáskor, ha van mentetlen változás, ide tesszük a célfület és rákérdezünk.
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const tabDirty = (tab: string): boolean => {
    const fields = TAB_FIELDS[tab] ?? []
    const fieldDirty = fields.some((k) => form[k] !== saved[k])
    const locDirty = LOC_TABS.has(tab) && loc.dirty
    return fieldDirty || locDirty
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const deleteAccount = async () => {
    if (deleteConfirm.trim() !== restaurantName.trim()) return
    setDeleting(true)
    try {
      const res = await fetch('/api/restaurant/delete-account', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = (await res.json().catch(() => null)) as { accountDeleted?: boolean } | null
      // Több-üzlet: ha csak ezt az éttermet töröltük, maradunk a dashboardon a következő
      // aktív üzlettel; ha a teljes fiók törlődött, megyünk a login-ra.
      if (data?.accountDeleted) {
        router.push('/login')
      } else {
        router.push('/restaurant')
        router.refresh()
      }
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  // A megadott mezőket PATCH-eli, majd frissíti a `saved` baseline-t.
  const persist = async (fields: (keyof Settings)[]): Promise<boolean> => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      for (const k of fields) body[k] = form[k]
      const res = await fetch('/api/restaurant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error('Hiba történt a mentés során')
        return false
      }
      setSaved((s) => {
        const next = { ...s }
        for (const k of fields) (next[k] as Settings[keyof Settings]) = form[k]
        return next
      })
      toast.success('Beállítások mentve')
      router.refresh()
      return true
    } catch {
      toast.error('Hiba történt a mentés során')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const saveTab = async (tab: string): Promise<boolean> => {
    const okFields = await persist(TAB_FIELDS[tab] ?? [])
    let okLoc = true
    if (LOC_TABS.has(tab) && loc.dirty) okLoc = await loc.saveLocale()
    return okFields && okLoc
  }
  const saveAll = () =>
    persist(Object.values(TAB_FIELDS).flat())

  // Egy fül változásainak elvetése — vissza az utoljára mentett állapotra. A hub közös mentés-sávja
  // ÉS a fülváltás-ConfirmDialog is ezt hívja (a localizált mezőket a `loc` hook kezeli, nem itt).
  const discardTab = (tab: string) => {
    setForm((f) => {
      const next = { ...f }
      for (const k of (TAB_FIELDS[tab] ?? [])) (next[k] as Settings[keyof Settings]) = saved[k]
      return next
    })
    // A localizált mezőket (jó tudni, feltételek, email-sablonok, egyedi kérdések) a `loc` hook
    // KÜLÖN cache-eli — enélkül a „Mégse" ezeket sose állította volna vissza, csak a sima
    // mezőket, ami úgy nézett ki, mintha a gomb nem csinálna semmit.
    if (LOC_TABS.has(tab)) loc.discardLocale()
  }

  // Fülváltás: ha az aktuális fülön van mentetlen változás, rákérdezünk.
  const requestTab = (id: string) => {
    if (id === activeTab) return
    if (tabDirty(activeTab)) setPendingTab(id)
    else setActiveTab(id)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void saveAll()
  }

  const tabs = [
    { id: 'email', label: 'Email', dirty: tabDirty('email') },
    { id: 'documents', label: 'Dokumentumok', dirty: tabDirty('documents') },
    { id: 'danger', label: 'Veszélyzóna' },
  ]

  // ── Beágyazott mód: az aktív fül mentetlen-állapotát FELFELÉ jelezzük a hub közös mentés-sávjának,
  //    és regisztráljuk a mentés/elvetés műveletet. A műveletek friss closure-t olvasnak ref-en át,
  //    így az egyszeri regisztráció is a legutóbbi állapottal (aktív fül, mezők) fut.
  const currentDirty = tabDirty(activeTab)
  const activeTabRef = useRef(activeTab); activeTabRef.current = activeTab
  const saveTabRef = useRef(saveTab); saveTabRef.current = saveTab
  const discardRef = useRef(discardTab); discardRef.current = discardTab
  const reportDirty = hubCtx?.reportDirty
  const registerApi = hubCtx?.registerApi
  useEffect(() => { reportDirty?.(currentDirty) }, [currentDirty, reportDirty])
  useEffect(() => {
    registerApi?.({
      save: () => saveTabRef.current(activeTabRef.current),
      discard: () => discardRef.current(activeTabRef.current),
    })
  }, [registerApi])

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-5">
      {!embedded && !hideTabsNav && <TabsNav tabs={tabs} active={activeTab} onSelect={requestTab} />}

      {/* A tulajnak szóló „Értesítő” sablon — a hubban az Értesítések fülön, nem a vendég-levelek között. */}
      {activeTab === 'ownerEmail' && (
        <Section title="Értesítő e-mail új foglalásról">
          <EmailTemplatesEditor
            variant="restaurant"
            loc={loc}
            scope="owner"
            onPreview={(state, intro) => openEmailPreview('restaurant', form, loc.editLocale, state, intro)}
          />
        </Section>
      )}

      {activeTab === 'email' && (
      <div className="space-y-[5px]">
        {/* Email-sablonok — típusonkénti (visszaigazolás/lemondás/emlékeztető/visszajelzés) tárgy + bevezető */}
        <Section title="Email-sablonok">
          <EmailTemplatesEditor
            variant="restaurant"
            loc={loc}
            scope={embedded ? 'guest' : 'all'}
            onPreview={(state, intro) => openEmailPreview('restaurant', form, loc.editLocale, state, intro)}
          />
        </Section>

        {/* Kapcsolat & útvonal */}
        <Section title="Kapcsolat & útvonal">
          <p className="text-xs text-ink-soft">
            A visszaigazoló email alján egy „Módosítanád a foglalást? Keress minket" blokk jelenik meg a bekapcsolt elemekkel.
          </p>

          <div className="rounded-[16px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_phone} onChange={(v) => set('email_show_phone', v)} label="Telefonszám" />
              {form.email_show_phone && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputClass}
                    value={form.email_contact_phone}
                    onChange={(e) => set('email_contact_phone', e.target.value)}
                    placeholder="Módosítási telefonszám (ha üres, a nyilvános)"
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_email} onChange={(v) => set('email_show_email', v)} label="Email cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_address} onChange={(v) => set('email_show_address', v)} label="Cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_directions} onChange={(v) => set('email_show_directions', v)} label="Útvonaltervezés gomb" description="Google Mapsben nyitja meg a helyet." />
              {form.email_show_directions && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputClass}
                    value={form.email_directions_address}
                    onChange={(e) => set('email_directions_address', e.target.value)}
                    placeholder="Cím vagy Google Maps-link (ha üres, a fenti cím)"
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_terms} onChange={(v) => set('email_show_terms', v)} label="Foglalási feltételek linkje" description="Csak akkor jelenik meg, ha van megadva foglalási feltétel." />
            </div>
          </div>
        </Section>

        {!embedded && <SaveBar dirty={tabDirty('email')} submitting={submitting} onSave={() => saveTab('email')} onPreview={() => openEmailPreview('restaurant', { ...form, booking_email_intro: loc.current.booking_email_intro }, loc.editLocale)} />}
      </div>
      )}

      {activeTab === 'documents' && (
      <div className="space-y-[5px]">
      <Section id="booking-terms" title="Foglalási feltételek" collapsible>
        <p className="text-xs text-ink-soft">
          Szakaszonként add meg a feltételeket (cím + szöveg). Megjelenik a nyilvános foglaló oldalon és a visszaigazoló emailben. Hagyd üresen, ha nincs.
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <TermsSectionsEditor value={loc.current.terms_sections} onChange={(v) => loc.setField('terms_sections', v)} locale={loc.editLocale} />
      </Section>

      {!embedded && <SaveBar dirty={tabDirty('documents')} submitting={submitting} onSave={() => saveTab('documents')} />}
      </div>
      )}

      {activeTab === 'danger' && (
      <div className="overflow-hidden rounded-[26px] border border-bad/30 bg-white font-onest shadow-dav-card">
        <div className="border-b border-bad/20 px-5 py-4 sm:px-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bad">Veszélyzóna</h3>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {isLastBusiness
                ? 'Minden adat (étterem, foglalások, asztalok, nyitvatartás) véglegesen törlődik.'
                : 'Csak ezt az éttermet törli (foglalások, asztalok, nyitvatartás). A fiókod és a többi üzleted megmarad.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-dav-pill border-[1.5px] border-bad/40 px-5 text-sm font-semibold text-bad transition-colors hover:bg-bad-bg sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}
          </button>
        </div>
      </div>
      )}
    </form>

    {/* Fülváltás mentetlen változással — Mentés / Elvetés / Mégse */}
    <ConfirmDialog
      open={pendingTab !== null}
      title="Mentetlen változások"
      description="Ezen a fülön van mentetlen módosításod. Mit szeretnél tenni, mielőtt átváltasz?"
      destructive={false}
      confirmLabel="Mentés"
      tertiaryLabel="Elvetés"
      cancelLabel="Mégse"
      busy={submitting}
      onConfirm={async () => {
        const ok = await saveTab(activeTab)
        if (ok && pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
      }}
      onTertiary={() => {
        // Elvetés: az aktuális fül mezőit visszaállítjuk az utoljára mentett állapotra.
        discardTab(activeTab)
        if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
      }}
      onCancel={() => setPendingTab(null)}
    />

    {deleteOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
        onClick={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }}
      >
        <div
          className="w-full max-w-md rounded-[26px] border border-line bg-white p-7 shadow-dav-card lg:p-9"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-bad-bg">
            <Trash2 className="h-6 w-6 text-bad" />
          </div>
          <h3 className="text-[22px] font-medium tracking-[-0.01em] text-ink">
            {isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Ez a művelet <span className="font-semibold text-ink">visszafordíthatatlan</span>.{' '}
            {isLastBusiness
              ? 'Az étterem, a foglalások, asztalok és nyitvatartás véglegesen törlődnek — ez az utolsó üzleted, ezért a teljes fiók is megszűnik.'
              : 'Csak ez az étterem törlődik (a foglalásaival, asztalaival, nyitvatartásával); a fiókod és a többi üzleted megmarad.'}
          </p>
          <p className="mb-2 mt-5 text-xs text-ink-soft">
            A megerősítéshez írd be az étterem nevét: <span className="font-semibold text-ink">{restaurantName}</span>
          </p>
          <Input
            className={inputClass}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={restaurantName}
            autoComplete="off"
            autoFocus
          />
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm.trim() !== restaurantName.trim()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-dav-pill bg-bad text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Törlés...' : 'Végleges törlés'}
            </button>
            <button
              type="button"
              onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}
              disabled={deleting}
              className="h-11 rounded-dav-pill border-[1.5px] border-line-strong px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink/40"
            >
              Mégse
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
