'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Loader2, Eye, FileText } from 'lucide-react'
import { openEmailPreview } from '@/components/settings/emailPreviewUrl'
import { EmailTemplatesEditor } from '@/components/settings/EmailTemplatesEditor'
import { SettingsGroup } from '@/components/blocks/settings'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor, type TermsSection } from '@/components/settings/TermsSectionsEditor'
import { PrivacyUrlField } from '@/components/settings/PrivacyUrlField'
import type { GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import type { CustomQuestion } from '@/components/settings/CustomQuestionsEditor'
import type { EventTypeItem } from '@/components/settings/EventTypesEditor'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useLocalizedFields } from '@/components/settings/useLocalizedFields'
import type { ComposerBlock } from '@/lib/emailBlocks'
import { useSettingsFormContext } from '@/components/settings/settingsFormContext'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { PopupModal } from '@/components/ui/popup-modal'
import { DeleteBusinessConfirm, DeleteBusinessPage } from '@/components/blocks/settings'

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás.
 *  Opcionális `onPreview` esetén a Mentés mellett egy „Előnézet" gomb is megjelenik. */
function SaveBar({ dirty, submitting, onSave, onPreview }: { dirty: boolean; submitting: boolean; onSave: () => void; onPreview?: () => void }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2.5 rounded-[20px] border border-ui-divider bg-white/70 p-2.5 backdrop-blur sm:static sm:flex-nowrap sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || submitting}
        className="flex h-12 flex-1 items-center justify-center gap-2 px-6 rounded-full bg-ui-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-70 sm:h-11 sm:flex-none"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Mentés...' : 'Mentés'}
      </button>
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="h-12 px-5 rounded-full border border-ui-divider text-ui-text hover:bg-ui-cell font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 sm:h-11"
        >
          <Eye className="h-4 w-4" />
          Előnézet
        </button>
      )}
      {dirty && <span className="w-full text-center text-xs font-medium text-ui-yellow sm:w-auto sm:text-left">Mentetlen változások</span>}
    </div>
  )
}

/** davelopment fül-navigáció (üveg konténer, aktív = ink pill). */
function TabsNav({ tabs, active, onSelect }: { tabs: { id: string; label: string; dirty?: boolean }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="-mx-5 flex gap-1 overflow-x-auto rounded-none border-y border-ui-divider bg-white/60 px-5 py-1.5 no-scrollbar sm:mx-0 sm:rounded-2xl sm:border sm:px-1 sm:py-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors sm:py-2 ${
            active === t.id ? 'bg-ui-dark text-white' : 'text-ui-muted hover:text-ui-text'
          }`}
        >
          {t.label}
          {t.dirty && <span title="Mentetlen változás" className="h-1.5 w-1.5 shrink-0 rounded-full bg-ui-yellow" />}
        </button>
      ))}
    </div>
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
  privacy_url: string
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
  'h-[50px] w-full rounded-[14px] bg-white border border-ui-divider text-ui-text transition-colors focus-visible:ring-2'


export function RestaurantSettingsForm({
  restaurantId,
  restaurantName,
  restaurantLogo = null,
  businessCount = 1,
  initial,
  supportedLocales,
  controlledTab,
  hideTabsNav = false,
}: {
  restaurantId: number | string
  restaurantName: string
  /** a logó (a Vendég e-mailek levelének fejlécében) */
  restaurantLogo?: string | null
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
    documents: ['privacy_url'],
  }
  const LOC_TABS = new Set(['email', 'documents'])
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


      {/* Vendég e-mailek (design 16.6) — a hubban a háromhasábos szerkesztő; a levél
          minden része (adatok, gombok, kapcsolat, lemondás) a sablonból jövő, szerkeszthető blokk */}
      {activeTab === 'email' && embedded && (
        <EmailTemplatesEditor variant="restaurant" loc={loc} sender={restaurantName} logo={restaurantLogo}
          onPreview={(state, intro) => openEmailPreview('restaurant', form, loc.editLocale, state, intro)} />
      )}

      {activeTab === 'documents' && (
      <div className="space-y-[5px]">
      {/* Foglalási feltételek (design 16.12) — a Dokumentumok lap első csoportja; a beleegyező nyilatkozat alatta (a hub) */}
      <SettingsGroup icon={FileText} title="Foglalási feltételek">
        <TermsSectionsEditor value={loc.current.terms_sections} onChange={(v) => loc.setField('terms_sections', v)} locale={loc.editLocale}
          localeBar={<LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />}
          missing={loc.editLocale === 'hu' ? 0 : loc.current.terms_sections.filter((t) => !t.title.trim() || !t.body.trim()).length} />
      </SettingsGroup>
      <PrivacyUrlField value={form.privacy_url} onChange={(v) => setForm((f) => ({ ...f, privacy_url: v }))} />

      {!embedded && <SaveBar dirty={tabDirty('documents')} submitting={submitting} onSave={() => saveTab('documents')} />}
      </div>
      )}

      {/* Fiók / üzlet törlése (design 16.25) */}
      {activeTab === 'danger' && (
        <DeleteBusinessPage kind="restaurant" name={restaurantName} last={isLastBusiness} onDelete={() => setDeleteOpen(true)} />
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

    {/* a megerősítés a közös popupban (design 16.25): a végleges gomb csak a név beírása után */}
    <PopupModal open={deleteOpen} onClose={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }} panel={deleteOpen ? (
      <DeleteBusinessConfirm kind="restaurant" name={restaurantName} last={isLastBusiness} value={deleteConfirm} onValue={setDeleteConfirm} busy={deleting}
        onConfirm={() => void deleteAccount()} onCancel={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }} />
    ) : undefined} />
    </>
  )
}
