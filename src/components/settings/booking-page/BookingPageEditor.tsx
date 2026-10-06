'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Globe, Loader2, Monitor, Smartphone, Upload, X } from 'lucide-react'
import { Toggle } from '@/components/settings/SettingsToggle'
import { SocialLinksEditor } from '@/components/settings/SocialLinksEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import { SupportedLocalesPicker } from '@/components/settings/SupportedLocalesPicker'
import { compressImage } from '@/lib/compressImage'
import { LOCALE_LABELS, resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToPreview, type PreviewToEditor } from '@/lib/editorBridge'
import { cn } from '@/lib/utils'

/**
 * Beállítások → Foglalóoldal: Framer-szerű élő szerkesztő.
 *
 * A vásznon a VALÓDI foglalóoldal fut (`/{slug}?editor=1` iframe, ld. SalonPublicView),
 * fix szélességen renderelve és a helyre kicsinyítve. Bármire kattintasz → kijelölődik →
 * minden szerkesztés a jobb oldali panelben történik. A még nem mentett állapot (draft)
 * `postMessage`-dzsel azonnal megjelenik az előnézetben; mentés a Beállítások közös
 * „Mentetlen változások” sávjából (`registerApi` / `onDirtyChange`).
 */

export type EditorStaff = {
  id: string
  name: string
  role_title: string
  bio: string
  social_links: string[]
}

export type BookingPageEditorInitial = {
  slug: string
  supportedLocales: Locale[]
  name: string
  address: string
  city: string
  phone: string
  email: string
  website: string
  description: string
  socialLinks: string[]
  coverId: number | null
  coverUrl: string | null
  coverFocalX: number
  coverFocalY: number
  coverZoom: number
  logoId: number | null
  logoUrl: string | null
  goodToKnow: GoodToKnowItem[]
  showCatalogCounts: boolean
  servicesExpandedOnMain: boolean
  /** A teljes `booking_rules` csoport — a Payload PATCH az egész csoportot cseréli, ezért
   *  mentéskor ebbe fésüljük bele a módosított mezőket. */
  bookingRules: Record<string, unknown>
  staff: EditorStaff[]
}

type Draft = Omit<BookingPageEditorInitial, 'slug' | 'bookingRules'>
/** Nyelvenként fordítható mezők (a magyar a `Draft`-ban él). */
type LocDraft = { description: string; goodToKnow: GoodToKnowItem[]; staffBio: Record<string, string> }

type Device = 'desktop' | 'mobile'
const FRAME: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 390, h: 844 },
}

const fieldCls =
  'w-full rounded-[12px] border border-line-strong bg-white px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-soft2/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 lg:text-[14px]'

const ELEMENT_TITLES: Record<string, string> = {
  cover: 'Borítókép', logo: 'Logó', name: 'Üzlet neve', address: 'Cím', desc: 'Leírás', counts: 'Számláló sáv',
  langs: 'Nyelvek', contact: 'Kapcsolat', 'sec:services': 'Szolgáltatások', 'sec:staff': 'Munkatársak',
  'sec:voucher': 'Ajándékutalvány', 'sec:reviews': 'Google-értékelések', gtk: 'Jó tudni',
}

const draftFrom = (i: BookingPageEditorInitial): Draft => {
  const { slug: _slug, bookingRules: _br, ...rest } = i
  return rest
}

export function BookingPageEditor({
  initial,
  onDirtyChange,
  registerApi,
  onNavigate,
}: {
  initial: BookingPageEditorInitial
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
  /** Másik Beállítások-fülre ugrás (pl. Ajándékutalvány → Fizetés). */
  onNavigate?: (tab: string) => void
}) {
  const router = useRouter()
  const [baseline, setBaseline] = useState<Draft>(() => draftFrom(initial))
  const [draft, setDraft] = useState<Draft>(baseline)
  const [locBaseline, setLocBaseline] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [locDrafts, setLocDrafts] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [lang, setLang] = useState<Locale>('hu')
  const [langLoading, setLangLoading] = useState(false)
  const [langMenu, setLangMenu] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [sel, setSel] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const languages = useMemo(() => resolveAvailableLocales(draft.supportedLocales), [draft.supportedLocales])
  const loc = lang === 'hu' ? null : locDrafts[lang] ?? null

  // ── Mentetlen állapot ──
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || JSON.stringify(locDrafts) !== JSON.stringify(locBaseline)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setLoc = (patch: Partial<LocDraft>) => setLocDrafts((all) => ({ ...all, [lang]: { ...(all[lang] as LocDraft), ...patch } }))
  const setStaff = (id: string, patch: Partial<EditorStaff>) =>
    setDraft((d) => ({ ...d, staff: d.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))

  // ── Nyelvváltás: a fordítható mezők lusta betöltése az adott nyelven (fallback nélkül) ──
  const selectLang = async (next: Locale) => {
    setLangMenu(false)
    if (next === lang) return
    if (next === 'hu' || locDrafts[next]) { setLang(next); return }
    setLangLoading(true)
    try {
      const res = await fetch(`/api/salon/settings?locale=${next}&fallback-locale=null`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      const staffBio: Record<string, string> = {}
      await Promise.all(draft.staff.map(async (m) => {
        const r = await fetch(`/api/staff/${m.id}?locale=${next}`, { credentials: 'include' })
        const s = r.ok ? await r.json() : null
        staffBio[m.id] = typeof s?.bio === 'string' ? s.bio : ''
      }))
      const loaded: LocDraft = {
        description: typeof doc.description === 'string' ? doc.description : '',
        goodToKnow: (Array.isArray(doc.good_to_know) ? doc.good_to_know : []).map((g: Record<string, unknown>) => ({
          icon: (g.icon as string) ?? 'info', title: (g.title as string) ?? '', body: (g.body as string) ?? '',
        })),
        staffBio,
      }
      setLocBaseline((b) => ({ ...b, [next]: loaded }))
      setLocDrafts((d) => ({ ...d, [next]: loaded }))
      setLang(next)
    } catch {
      toast.error('A nyelv betöltése nem sikerült')
    } finally {
      setLangLoading(false)
    }
  }

  // ── Előnézet: a draft → SalonViewData-patch ──
  const previewPatch = useMemo(() => {
    const description = (loc?.description || draft.description).trim().slice(0, 160) || null
    const goodToKnow = loc && loc.goodToKnow.some((g) => g.title || g.body) ? loc.goodToKnow : draft.goodToKnow
    const staffEdits: Record<string, unknown> = {}
    for (const m of draft.staff) {
      staffEdits[m.id] = {
        name: m.name,
        role_title: m.role_title,
        bio: (loc?.staffBio[m.id] || m.bio) || null,
        social_links: m.social_links.filter((u) => u.trim()).map((url) => ({ url })),
      }
    }
    return {
      name: draft.name,
      address: draft.address || null,
      city: draft.city || null,
      description,
      coverUrl: draft.coverUrl,
      coverFocalX: draft.coverFocalX,
      coverFocalY: draft.coverFocalY,
      coverZoom: draft.coverZoom,
      logoUrl: draft.logoUrl,
      showCatalogCounts: draft.showCatalogCounts,
      card: {
        phone: draft.phone || null,
        email: draft.email || null,
        website: draft.website || null,
        socialLinks: draft.socialLinks.filter((u) => u.trim()),
        goodToKnow,
        servicesExpandedOnMain: draft.servicesExpandedOnMain,
      },
      staffEdits,
    }
  }, [draft, loc])

  // Az előnézet üzenetei: `ready` → küldjük a draftot + kijelölést; `pick` → kijelölés.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage<PreviewToEditor>(e) || e.source !== frameRef.current?.contentWindow) return
      if (e.data.type === 'ready') setReady(true)
      else if (e.data.type === 'pick') setSel(e.data.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'draft', patch: previewPatch }) }, [ready, previewPatch])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'select', id: sel }) }, [ready, sel])

  // ── Mentés ──
  const save = useCallback(async (): Promise<boolean> => {
    const patchJson = async (url: string, body: Record<string, unknown>) => {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
    }
    try {
      const b = baseline
      const d = draft
      const body: Record<string, unknown> = {}
      const changed = <K extends keyof Draft>(k: K) => JSON.stringify(d[k]) !== JSON.stringify(b[k])
      if (changed('name')) body.name = d.name
      if (changed('address')) body.address = d.address
      if (changed('city')) body.city = d.city
      if (changed('phone')) body.phone = d.phone
      if (changed('email')) body.email = d.email
      if (changed('website')) body.website = d.website
      if (changed('description')) body.description = d.description
      if (changed('socialLinks')) body.social_links = d.socialLinks.filter((u) => u.trim()).map((url) => ({ url: url.trim() }))
      if (changed('coverId')) body.cover_image = d.coverId
      if (changed('coverFocalX') || changed('coverFocalY') || changed('coverZoom')) {
        body.cover_focal_x = d.coverFocalX
        body.cover_focal_y = d.coverFocalY
        body.cover_zoom = d.coverZoom
      }
      if (changed('logoId')) body.logo = d.logoId
      if (changed('goodToKnow')) body.good_to_know = d.goodToKnow
      if (changed('supportedLocales')) body.supported_locales = d.supportedLocales
      if (changed('showCatalogCounts') || changed('servicesExpandedOnMain')) {
        body.booking_rules = {
          ...initial.bookingRules,
          show_catalog_counts_on_public: d.showCatalogCounts,
          services_expanded_on_main: d.servicesExpandedOnMain,
        }
      }
      if (Object.keys(body).length > 0) await patchJson('/api/salon/settings', body)

      for (const m of d.staff) {
        const before = b.staff.find((x) => x.id === m.id)
        if (!before || JSON.stringify(before) === JSON.stringify(m)) continue
        await patchJson(`/api/staff/${m.id}`, {
          name: m.name,
          role_title: m.role_title,
          bio: m.bio,
          social_links: m.social_links.filter((u) => u.trim()).map((url) => ({ url: url.trim() })),
        })
      }

      for (const [code, value] of Object.entries(locDrafts) as [Locale, LocDraft][]) {
        const before = locBaseline[code]
        if (!before || JSON.stringify(before) === JSON.stringify(value)) continue
        if (before.description !== value.description || JSON.stringify(before.goodToKnow) !== JSON.stringify(value.goodToKnow)) {
          await patchJson(`/api/salon/settings?locale=${code}`, { description: value.description, good_to_know: value.goodToKnow })
        }
        for (const [id, bio] of Object.entries(value.staffBio)) {
          if (before.staffBio[id] !== bio) await patchJson(`/api/staff/${id}?locale=${code}`, { bio })
        }
      }

      setBaseline(d)
      setLocBaseline(locDrafts)
      router.refresh()
      // Az előnézet a mentett állapotot a szerverről is újratölti (cache-invalidálás után).
      setReady(false)
      frameRef.current?.contentWindow?.location.reload()
      return true
    } catch (e) {
      toast.error(`Mentés sikertelen${e instanceof Error && e.message ? `: ${e.message}` : ''}`)
      return false
    }
  }, [baseline, draft, locBaseline, locDrafts, initial.bookingRules, router])

  const discard = useCallback(() => {
    setDraft(baseline)
    setLocDrafts(locBaseline)
  }, [baseline, locBaseline])

  useEffect(() => { registerApi?.({ save, discard }) }, [registerApi, save, discard])

  // ── Kép feltöltése (borító / logó) — ugyanaz az út, mint a régi profil-űrlapon ──
  const [uploading, setUploading] = useState<'cover' | 'logo' | null>(null)
  const upload = async (kind: 'cover' | 'logo', file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('A kép mérete legfeljebb 10 MB lehet.'); return }
    setUploading(kind)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const { doc } = await res.json()
      if (kind === 'cover') setDraft((d) => ({ ...d, coverId: doc.id, coverUrl: doc.url, coverFocalX: 50, coverFocalY: 50, coverZoom: 1 }))
      else setDraft((d) => ({ ...d, logoId: doc.id, logoUrl: doc.url }))
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(null)
    }
  }

  // ── Vászon-méretezés: az előnézet a valódi szélességen fut, a helyre kicsinyítve ──
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasW, setCanvasW] = useState(0)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setCanvasW(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const frame = FRAME[device]
  const scale = canvasW > 0 ? Math.min(1, canvasW / frame.w) : 0
  const src = `/${initial.slug}?editor=1${lang !== 'hu' ? `&lang=${lang}` : ''}`
  // Új nyelv = új iframe-betöltés: a `ready` üzenetig nem küldünk semmit.
  useEffect(() => { setReady(false) }, [src])

  const staffId = sel?.startsWith('staff:') ? sel.slice(6) : null
  const member = staffId ? draft.staff.find((m) => m.id === staffId) ?? null : null
  const title = member ? member.name : sel ? ELEMENT_TITLES[sel] ?? 'Elem' : 'Az oldal elemei'

  return (
    <div className="space-y-4">
      {/* Fejléc: eszköz + szerkesztett nyelv */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-soft">Kattints bármire az oldalon — jobbra szerkesztheted.</p>
        <div className="flex items-center gap-2">
          <div className="hidden gap-1 rounded-full border border-line bg-white/60 p-1 lg:flex">
            {([['mobile', Smartphone, 'Mobil nézet'], ['desktop', Monitor, 'Asztali nézet']] as const).map(([d, Icon, label]) => (
              <button
                key={d}
                type="button"
                aria-label={label}
                onClick={() => setDevice(d)}
                className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-colors', device === d ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangMenu((o) => !o)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white/75 px-4 text-[13px] font-semibold text-ink"
            >
              {langLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" strokeWidth={1.8} />}
              {LOCALE_LABELS[lang]}
            </button>
            {langMenu && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-[18px] border border-line bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(70,60,20,.35)]">
                {languages.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => selectLang(code)}
                    className={cn('flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left text-[13.5px] font-medium', lang === code ? 'bg-ink-dark text-white' : 'text-ink hover:bg-black/[0.04]')}
                  >
                    {LOCALE_LABELS[code]}<span className="text-[11px] opacity-60">{code.toUpperCase()}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-line" />
                <button type="button" onClick={() => { setLangMenu(false); setSel('langs') }} className="flex h-10 w-full items-center rounded-[12px] px-3 text-left text-[13px] font-semibold text-ink-soft hover:bg-black/[0.04]">
                  Nyelvek kezelése…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* Vászon */}
        <div ref={canvasRef} className="min-w-0 flex-1">
          <div className="relative mx-auto" style={{ width: frame.w * scale, height: frame.h * scale }}>
            {scale > 0 && (
              <iframe
                ref={frameRef}
                key={src}
                src={src}
                title="Foglalóoldal előnézet"
                className={cn('absolute left-0 top-0 origin-top-left border-0 bg-[#111]', device === 'mobile' ? 'rounded-[40px] ring-[10px] ring-[#0E0E10]' : 'rounded-[18px] ring-1 ring-line')}
                style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}
              />
            )}
          </div>
        </div>

        {/* Tulajdonság-panel */}
        <aside className="w-full shrink-0 space-y-4 rounded-[26px] dav-card-glass p-5 xl:w-[340px]">
          {sel && (
            <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
              <ChevronLeft className="h-3.5 w-3.5" /> Az oldal elemei
            </button>
          )}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft2">{sel ? 'Kijelölt elem' : 'Foglalóoldal'}</div>
            <div className="mt-1 text-[21px] font-normal tracking-[-0.01em] text-ink">{title}</div>
          </div>

          {!sel && (
            <div className="space-y-2">
              {(['cover', 'logo', 'name', 'address', 'desc', 'counts', 'contact', 'sec:services', 'sec:staff', 'gtk', 'langs'] as const).map((id) => (
                <Row key={id} label={ELEMENT_TITLES[id]} onClick={() => setSel(id)} />
              ))}
            </div>
          )}

          {sel === 'name' && (
            <Field label="Üzlet neve"><input className={fieldCls} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
          )}

          {sel === 'address' && (
            <>
              <Field label="Cím"><input className={fieldCls} value={draft.address} onChange={(e) => set('address', e.target.value)} /></Field>
              <Field label="Város"><input className={fieldCls} value={draft.city} onChange={(e) => set('city', e.target.value)} /></Field>
            </>
          )}

          {sel === 'desc' && (
            <Field label={`Leírás (${LOCALE_LABELS[lang]})`} hint="A foglalóoldalon az első 160 karakter látszik.">
              <textarea
                rows={5}
                className={cn(fieldCls, 'resize-y leading-relaxed')}
                value={loc ? loc.description : draft.description}
                placeholder={loc ? draft.description : undefined}
                onChange={(e) => (loc ? setLoc({ description: e.target.value }) : set('description', e.target.value))}
              />
            </Field>
          )}

          {sel === 'cover' && (
            <>
              <ImagePicker
                url={draft.coverUrl}
                busy={uploading === 'cover'}
                onPick={(f) => upload('cover', f)}
                onRemove={() => setDraft((d) => ({ ...d, coverId: null, coverUrl: null }))}
                tall
              />
              {draft.coverUrl && (
                <>
                  <Slider label="Fókusz vízszintesen" value={draft.coverFocalX} min={0} max={100} onChange={(v) => set('coverFocalX', v)} />
                  <Slider label="Fókusz függőlegesen" value={draft.coverFocalY} min={0} max={100} onChange={(v) => set('coverFocalY', v)} />
                  <Slider label="Nagyítás" value={Math.round(draft.coverZoom * 100)} min={100} max={200} suffix="%" onChange={(v) => set('coverZoom', v / 100)} />
                </>
              )}
            </>
          )}

          {sel === 'logo' && (
            <ImagePicker url={draft.logoUrl} busy={uploading === 'logo'} onPick={(f) => upload('logo', f)} onRemove={() => setDraft((d) => ({ ...d, logoId: null, logoUrl: null }))} />
          )}

          {sel === 'counts' && (
            <ToggleRow label="Szolgáltatások és szakemberek száma" hint="A foglalóoldal tetején, középen (mobilon a logó alatt)." checked={draft.showCatalogCounts} onChange={() => set('showCatalogCounts', !draft.showCatalogCounts)} />
          )}

          {sel === 'langs' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Ezeken a nyelveken választhat a vendég. Hiányzó fordítás helyén a magyar szöveg látszik.</p>
              <SupportedLocalesPicker value={draft.supportedLocales} onChange={(v) => set('supportedLocales', v)} />
            </>
          )}

          {sel === 'contact' && (
            <>
              <Field label="Telefon"><input className={fieldCls} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="E-mail"><input className={fieldCls} value={draft.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Weboldal"><input className={fieldCls} value={draft.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Közösségi linkek" hint="Csak illeszd be a linket — az ikont felismerjük.">
                <SocialLinksEditor value={draft.socialLinks} onChange={(v) => set('socialLinks', v)} inputClassName={fieldCls} />
              </Field>
            </>
          )}

          {sel === 'sec:services' && (
            <>
              <ToggleRow label="Kibontva a főnézeten" hint="Rögtön látszik a teljes katalógus, külön gomb nélkül." checked={draft.servicesExpandedOnMain} onChange={() => set('servicesExpandedOnMain', !draft.servicesExpandedOnMain)} />
              <LinkButton href="/dashboard/services">Szolgáltatások és árak</LinkButton>
            </>
          )}

          {sel === 'sec:staff' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Kattints egy munkatársra a bemutatkozása és a közösségi linkjei szerkesztéséhez. Csak azok látszanak, akikhez legalább egy szolgáltatás tartozik.</p>
              <div className="space-y-2">
                {draft.staff.map((m) => <Row key={m.id} label={m.name} onClick={() => setSel(`staff:${m.id}`)} />)}
              </div>
              <LinkButton href="/dashboard/staff">Munkatársak kezelése</LinkButton>
            </>
          )}

          {member && (
            <>
              <Field label="Név"><input className={fieldCls} value={member.name} onChange={(e) => setStaff(member.id, { name: e.target.value })} /></Field>
              <Field label="Titulus"><input className={fieldCls} value={member.role_title} onChange={(e) => setStaff(member.id, { role_title: e.target.value })} /></Field>
              <Field label={`Bemutatkozás (${LOCALE_LABELS[lang]})`} hint="Foglaláskor a kiválasztott szakember csíkjára koppintva kinyílik.">
                <textarea
                  rows={4}
                  className={cn(fieldCls, 'resize-y leading-relaxed')}
                  value={loc ? loc.staffBio[member.id] ?? '' : member.bio}
                  placeholder={loc ? member.bio : undefined}
                  onChange={(e) => (loc ? setLoc({ staffBio: { ...loc.staffBio, [member.id]: e.target.value } }) : setStaff(member.id, { bio: e.target.value }))}
                />
              </Field>
              <Field label="Közösségi linkek">
                <SocialLinksEditor value={member.social_links} onChange={(v) => setStaff(member.id, { social_links: v })} inputClassName={fieldCls} />
              </Field>
              <LinkButton href="/dashboard/staff">Munkaidő, szolgáltatások, min. foglalási idő</LinkButton>
            </>
          )}

          {sel === 'gtk' && (
            <GoodToKnowEditor
              value={loc ? loc.goodToKnow : draft.goodToKnow}
              onChange={(v) => (loc ? setLoc({ goodToKnow: v }) : set('goodToKnow', v))}
              locale={lang}
            />
          )}

          {sel === 'sec:voucher' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Az utalvány beállításai (összegek, típusok, céges vásárlás) a Fizetés fülön vannak.</p>
              <NavButton onClick={() => onNavigate?.('payments')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {sel === 'sec:reviews' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A megjelenő értékelések az összekapcsolt Google-profilból jönnek.</p>
              <NavButton onClick={() => onNavigate?.('google')}>Google-profil</NavButton>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ── Panel-építőkockák ── */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] leading-relaxed text-ink-soft2">{hint}</span>}
    </label>
  )
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-between rounded-[14px] border border-line bg-white px-3.5 text-left text-[13.5px] font-medium text-ink transition-colors hover:border-ink/20"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft2" />
    </button>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function Slider({ label, value, min, max, suffix = '%', onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-[12px] font-semibold text-ink-soft"><span>{label}</span><span className="tabular-nums">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#1D1C19]" />
    </label>
  )
}

function ImagePicker({ url, busy, onPick, onRemove, tall = false }: { url: string | null; busy: boolean; onPick: (f: File) => void; onRemove: () => void; tall?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <div className={cn('relative overflow-hidden rounded-[18px] border border-line bg-[#3A3830]', tall ? 'h-32' : 'h-20 w-20')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className={cn('h-full w-full', tall ? 'object-cover' : 'object-contain bg-white')} />}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white text-[13px] font-semibold text-ink">
          <Upload className="h-4 w-4" /> {url ? 'Kép cseréje' : 'Kép feltöltése'}
        </button>
        {url && (
          <button type="button" onClick={onRemove} aria-label="Kép eltávolítása" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#F3C9C2] bg-white text-bad">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink-dark px-4 text-center text-[13px] font-semibold text-white">
      {children} <ChevronRight className="h-4 w-4" />
    </a>
  )
}

function NavButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-ink-dark px-4 text-[13px] font-semibold text-white">
      {children} <ChevronRight className="h-4 w-4" />
    </button>
  )
}
