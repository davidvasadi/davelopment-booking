'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Salon } from '@/payload/payload-types'
import { FileText } from 'lucide-react'
import { openEmailPreview } from '@/components/settings/emailPreviewUrl'
import { EmailTemplatesEditor } from '@/components/settings/EmailTemplatesEditor'
import { SettingsGroup } from '@/components/blocks/settings'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor } from '@/components/settings/TermsSectionsEditor'
import { PrivacyUrlField } from '@/components/settings/PrivacyUrlField'
import type { CustomQuestionType } from '@/components/settings/CustomQuestionsEditor'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useLocalizedFields } from '@/components/settings/useLocalizedFields'
import { parseEmailBlocks } from '@/lib/emailBlocks'
import { useSettingsFormContext } from '@/components/settings/settingsFormContext'
import { resolveAvailableLocales } from '@/lib/i18n'
import { PopupModal } from '@/components/ui/popup-modal'
import { DeleteBusinessConfirm, DeleteBusinessPage } from '@/components/blocks/settings'





const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Csak kisbetű, szám és kötőjel'),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  privacy_url: z.string().optional(),
  booking_buffer_minutes: z.number().min(0).max(120),
  booking_window_days: z.number().min(1).max(365),
  require_phone: z.boolean(),
  notify_new_bookings: z.boolean(),
  email_show_phone: z.boolean(),
  email_contact_phone: z.string().optional(),
  email_show_email: z.boolean(),
  email_show_address: z.boolean(),
  email_show_directions: z.boolean(),
  email_directions_address: z.string().optional(),
  email_show_terms: z.boolean(),
  legal_name: z.string().optional(),
  tax_number: z.string().optional(),
  company_reg_number: z.string().optional(),
  registered_seat: z.string().optional(),
})
type FormData = z.infer<typeof schema>



export default function SalonSettingsForm({ salon, businessCount = 1, controlledTab }: { salon: Salon; businessCount?: number; controlledTab?: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  // Több-üzlet: ha a fióknak több üzlete van, csak EZT a szalont töröljük (a fiók marad).
  const isLastBusiness = businessCount <= 1

  const initialValues: FormData = {
    name: salon.name,
    slug: salon.slug,
    address: salon.address ?? '',
    city: salon.city ?? '',
    postal_code: salon.postal_code ?? '',
    phone: salon.phone ?? '',
    email: salon.email ?? '',
    website: salon.website ?? '',
    privacy_url: salon.privacy_url ?? '',
    booking_buffer_minutes: salon.booking_buffer_minutes ?? 0,
    booking_window_days: salon.booking_window_days ?? 60,
    require_phone: salon.require_phone ?? true,
    notify_new_bookings: salon.notify_new_bookings ?? true,
    email_show_phone: salon.email_show_phone ?? true,
    email_contact_phone: salon.email_contact_phone ?? '',
    email_show_email: salon.email_show_email ?? false,
    email_show_address: salon.email_show_address ?? false,
    email_show_directions: salon.email_show_directions ?? false,
    email_directions_address: salon.email_directions_address ?? '',
    email_show_terms: salon.email_show_terms ?? true,
    legal_name: salon.legal_name ?? '',
    tax_number: salon.tax_number ?? '',
    company_reg_number: salon.company_reg_number ?? '',
    registered_seat: salon.registered_seat ?? '',
  }
  const { handleSubmit, watch, setValue, getValues, reset, formState: { dirtyFields } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })
  // Utoljára elmentett baseline (az „Elvetés"-hez fülenként). Mentéskor frissül.
  const defaultsRef = useRef<FormData>(initialValues)
  // ── A foglalón kínált nyelvek (a Foglalóoldal-szerkesztő állítja; HU mindig fix alap) ──
  const savedSupported = resolveAvailableLocales(salon.supported_locales).filter((l) => l !== 'hu')

  // ── Localizált tartalom (email tárgy/intro, „jó tudni", feltételek) per-nyelv ──
  const loc = useLocalizedFields({
    collection: 'salons',
    id: salon.id,
    supported: ['hu', ...savedSupported],
    huValues: {
      description: salon.description ?? '',
      booking_email_subject: salon.booking_email_subject ?? '',
      booking_email_intro: parseEmailBlocks(salon.booking_email_intro),
      cancel_email_subject: salon.cancel_email_subject ?? '',
      cancel_email_intro: parseEmailBlocks(salon.cancel_email_intro),
      reminder_email_subject: salon.reminder_email_subject ?? '',
      reminder_email_intro: parseEmailBlocks(salon.reminder_email_intro),
      feedback_email_subject: salon.feedback_email_subject ?? '',
      feedback_email_intro: parseEmailBlocks(salon.feedback_email_intro),
      notify_email_subject: salon.notify_email_subject ?? '',
      notify_email_intro: parseEmailBlocks(salon.notify_email_intro),
      terms_sections: (salon.terms_sections ?? []).map((s) => ({ ...(s.id ? { id: s.id } : {}), title: s.title ?? '', body: s.body ?? '' })),
      good_to_know: (salon.good_to_know ?? []).map((g) => ({ ...(g.id ? { id: g.id } : {}), icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
      event_types: [], // szalon-only: nincs esemény-típus (étterem-funkció)
      custom_questions: (salon.custom_questions ?? []).map((q) => ({
        id: q.id ?? crypto.randomUUID(),
        label: q.label ?? '',
        type: (q.type ?? 'text') as CustomQuestionType,
        options: (q.options ?? []).map((o) => ({ value: o.value ?? '' })),
        required: q.required ?? false,
      })),
    },
  })

  // ── Fülek + mentetlen-változás védelem ──────────────────────────
  // A localizált mezőket (good_to_know, terms_sections, booking_email_*) a `loc` hook
  // kezeli per-nyelv — NEM kerülnek a normál fülmentésbe.
  const TAB_FIELDS: Record<string, (keyof FormData)[]> = {
    email: ['email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address', 'email_show_terms'],
    documents: ['privacy_url'],
  }
  // Mely fülön van localizált tartalom (a `loc.dirty` is számít a fül „mentetlen" jelzésénél).
  const LOC_TABS = new Set(['email', 'documents'])
  const [internalTab, setActiveTab] = useState('email')
  // Vezérelt mód: ha a Beállítások-hub Providere körénk renderel, a context/prop dönt a fülről
  // ÉS elrejtjük a saját vízszintes fül-sort; különben a belső állapot + saját fülsor.
  const hubCtx = useSettingsFormContext()
  const embedded = hubCtx != null
  const activeTab = hubCtx?.controlledTab ?? controlledTab ?? internalTab
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const tabDirty = (tab: string): boolean => {
    const fieldDirty = (TAB_FIELDS[tab] ?? []).some((k) => dirtyFields[k])
    const locDirty = LOC_TABS.has(tab) && loc.dirty
    return fieldDirty || locDirty
  }

  // Az adott fül mezőit menti.
  const persist = async (fields: (keyof FormData)[]): Promise<boolean> => {
    setSubmitting(true)
    try {
      const values = getValues()
      const body: Record<string, unknown> = {}
      for (const k of fields) body[k] = values[k]
      const res = await fetch('/api/salon/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error('Hiba történt a mentés során')
        return false
      }
      // Sikeres mentés — baseline frissítése, dirty nullázódik.
      reset(values, { keepValues: true })
      defaultsRef.current = values
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
    // A localizált tartalmat (ha az aktív szerkesztési nyelv ≠ HU vagy dirty) is mentjük.
    let okLoc = true
    if (LOC_TABS.has(tab) && loc.dirty) okLoc = await loc.saveLocale()
    return okFields && okLoc
  }

  // Egy fül változásainak elvetése — vissza az utoljára mentett baseline-ra (a hub közös mentés-sávja
  // ÉS a fülváltás-ConfirmDialog is ezt hívja). A localizált mezőket a `loc` hook kezeli.
  const discardTab = (tab: string) => {
    for (const k of (TAB_FIELDS[tab] ?? [])) {
      setValue(k, defaultsRef.current[k], { shouldDirty: false })
    }
    // A localizált mezőket (jó tudni, feltételek, email-sablonok, egyedi kérdések) a `loc` hook
    // KÜLÖN cache-eli — enélkül a „Mégse" ezeket sose állította volna vissza, csak a sima
    // react-hook-form mezőket, ami úgy nézett ki, mintha a gomb nem csinálna semmit.
    if (LOC_TABS.has(tab)) loc.discardLocale()
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = (await res.json().catch(() => null)) as { accountDeleted?: boolean } | null
      // Ha csak egy üzletet töröltünk (van még másik), maradunk a dashboardon az új aktív
      // üzlettel; ha a teljes fiók törlődött, megyünk a login-ra.
      if (data?.accountDeleted) {
        router.push('/login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  // Globális mentés: minden fül mezője egyben.
  const onSubmit = () => persist(Object.values(TAB_FIELDS).flat())

  // ── Beágyazott mód: az aktív fül mentetlen-állapotát FELFELÉ jelezzük a hub közös mentés-sávjának,
  //    és regisztráljuk a mentés/elvetés műveletet. A műveletek friss closure-t olvasnak ref-en át.
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">


      {/* Vendég e-mailek (design 16.6) — a hubban a háromhasábos szerkesztő; a levél
          minden része (adatok, gombok, kapcsolat, lemondás) a sablonból jövő, szerkeszthető blokk */}
      {activeTab === 'email' && embedded && (
        <EmailTemplatesEditor variant="salon" loc={loc} sender={salon.name} logo={salon.logo && typeof salon.logo === 'object' ? (salon.logo as { url?: string | null }).url ?? null : null}
          onPreview={(state, intro) => openEmailPreview('salon', watch(), loc.editLocale, state, intro)} />
      )}

      {activeTab === 'documents' && (
      <div className="space-y-[5px]">
      {/* Foglalási feltételek (design 16.12) — a Dokumentumok lap első csoportja; a beleegyező nyilatkozat alatta (a hub) */}
      <SettingsGroup icon={FileText} title="Foglalási feltételek">
        <TermsSectionsEditor value={loc.current.terms_sections} onChange={(v) => loc.setField('terms_sections', v)} locale={loc.editLocale}
          localeBar={<LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />}
          missing={loc.editLocale === 'hu' ? 0 : loc.current.terms_sections.filter((t) => !t.title.trim() || !t.body.trim()).length} />
      </SettingsGroup>
      <PrivacyUrlField value={watch('privacy_url') ?? ''} onChange={(v) => setValue('privacy_url', v, { shouldDirty: true })} />
      </div>
      )}

      {/* Fiók / üzlet törlése (design 16.25) */}
      {activeTab === 'danger' && (
        <DeleteBusinessPage kind="salon" name={salon.name ?? ''} last={isLastBusiness} onDelete={() => setDeleteOpen(true)} />
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
      <DeleteBusinessConfirm kind="salon" name={salon.name ?? ''} last={isLastBusiness} value={deleteConfirm} onValue={setDeleteConfirm} busy={deleting}
        onConfirm={() => void deleteAccount()} onCancel={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }} />
    ) : undefined} />
    </>
  )
}
