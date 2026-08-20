'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Search, Send, PenLine, ArrowRight, Check, UserX, ChevronDown, ArrowUpDown, FileText, LayoutTemplate, Trash2, X, Users } from 'lucide-react'
import { buttonHover } from '@/lib/motion'
import { PageHeader } from '@/components/ui/page-header'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PopupModal } from '@/components/ui/popup-modal'
import { NewsletterBlockEditor, blocksToHtml, emptyTextBlock, type ComposerBlock } from '@/components/dashboard/NewsletterBlockEditor'
import { cn } from '@/lib/utils'
import { emailLayout, brandHeroBlock, richContentBlock, bottomSpacer, COLORS } from '@/lib/emailLayout'

/**
 * A hírlevél/marketing-kampány dashboard-oldal. A csomagválasztás (ár, keret) a Beállítások →
 * Fizetések oldalra költözött (`PaymentsSettingsPanel`), itt csak egy kompakt összegző +
 * "Bővítés" link látszik. Sorrend: statisztika (fent) → feliratkozók → kampány-előzmény →
 * szerkesztő+élő előnézet (legalul) — a "Hírlevél írása" fejléc-gomb ide görget le.
 */

type Package = 'none' | 'ingyenes' | 'alap' | 'premium'

export type CampaignRow = {
  id: string
  subject: string
  recipient_count: number
  opened_count: number | null
  createdAt: string
  status: 'sent' | 'draft'
  blocksJson?: ComposerBlock[] | null
  targetCustomerIds?: string[] | null
}

export type SubscriberRow = {
  id: string
  name: string
  email: string
  city: string
  country: string | null
  consentAt: string
  status?: 'subscribed' | 'unsubscribed'
}

/** ISO-2 országkód → zászló emoji (Unicode regionális jelző betűk), csak megjelenítéshez. */
function countryFlag(code: string | null): string | null {
  if (!code || code.length !== 2) return null
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return null
  return String.fromCodePoint(...[...upper].map((c) => 127397 + c.charCodeAt(0)))
}

interface Props {
  variant: 'salon' | 'restaurant'
  businessId: string
  businessName: string
  logoUrl?: string | null
  currentPackage: Package
  packages: {
    ingyenes: { cap: number }
    alap: { huf: number; cap: number }
    premium: { huf: number; cap: number }
  }
  subscriberCount: number
  initialSubscribers: SubscriberRow[]
  initialSubscribersHasMore: boolean
  countryOptions: string[]
  usedThisMonth: number
  openedThisMonth: number
  initialCampaigns: CampaignRow[]
}

const SUB_PAGE_SIZE = 20

const VIEW_TABS: { key: 'subscribers' | 'campaigns'; label: string }[] = [
  { key: 'subscribers', label: 'Feliratkozók' },
  { key: 'campaigns', label: 'Kampányok' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Kompakt megnyitási-arány gyűrű a Kampányok táblázathoz — nincs hozzá külön chart-dependency,
 *  egyszerű inline SVG `stroke-dasharray`-jel. A "Megnyitva" szám MELLÉ kerül, nem helyette. */
function OpenRateRing({ pct }: { pct: number }) {
  const r = 8
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(59,59,59,0.1)" strokeWidth="3" />
      <circle cx="10" cy="10" r={r} fill="none" stroke="#FFD85F" strokeWidth="3" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  )
}

/** "Sablon betöltése" — egy davelopment.hu-stílusú, jól strukturált marketing-email alapváz
 *  (logó-helyőrző → cím → intro → kép-helyőrző → CTA gomb → kiemelt előnyök → zárás), amit a
 *  tulaj a saját szövegével/képével tölt fel. Függvény, nem statikus tömb, hogy minden
 *  betöltéskor friss (ütközésmentes) blokk-ID-kat generáljon.
 *
 *  A saját logó NEM automatikus (a footerben ez korábban próbálkozás volt, de a tulajok által
 *  feltöltött logók tetszőleges színűek/hátterűek — egy fix sötét footer-sávon egy világos logó
 *  eltűnhet, egy kártya-konténer meg nem old meg mindent) — ehelyett a LEGUTOLSÓ blokként egy
 *  ÜRES kép-helyőrző van, amit a tulaj szabadon tölt fel a saját logójával, a SAJÁT maga
 *  választotta háttér/stílus mellett, teljes kontrollal. */
function marketingEmailTemplate(): { subject: string; blocks: ComposerBlock[] } {
  const id = (suffix: string) => `tpl-${Date.now()}-${suffix}`
  return {
    subject: 'Újdonság érkezett hozzánk! 🎉',
    blocks: [
      { id: id('1'), type: 'title', html: 'Újdonság érkezett hozzánk! 🎉' },
      { id: id('2'), type: 'text', html: 'Szeretnénk megosztani veled a legfrissebb híreinket — nézd meg, mi változott, és foglalj időpontot még ma!' },
      { id: id('3'), type: 'image', url: '', alt: '' },
      { id: id('4'), type: 'button', label: 'Foglalj időpontot', url: '', align: 'center' },
      { id: id('5'), type: 'divider' },
      { id: id('6'), type: 'bullet_list', html: '<li>Gyors, egyszerű online foglalás</li><li>Emlékeztető a foglalás előtt</li><li>Rugalmas időpont-módosítás</li>' },
      { id: id('7'), type: 'text', html: 'Köszönjük, hogy velünk tartasz — várunk szeretettel!' },
      { id: id('8'), type: 'social_links', links: [{ url: 'https://facebook.com/' }, { url: 'https://instagram.com/' }, { url: 'https://tiktok.com/' }] },
      { id: id('9'), type: 'image', url: '', alt: 'Logó', align: 'center' },
    ],
  }
}

export function NewsletterManager({ variant, businessId, businessName, logoUrl, currentPackage, packages, subscriberCount, initialSubscribers, initialSubscribersHasMore, countryOptions, usedThisMonth, openedThisMonth, initialCampaigns }: Props) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  useEffect(() => setCampaigns(initialCampaigns), [initialCampaigns])

  // Kezdetben kevesebb sort listázunk mobilon (10), mint asztali nézetben (15) — a lapméret a
  // `lg` töréspontnál (1024px) vált, ugyanúgy, mint a checkbox-oszlop `lg:grid`-je lejjebb.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const upd = () => setIsMobile(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  const pageIncrement = isMobile ? 10 : 15

  // A feliratkozó-lista SZERVER-oldalon lapozott + kereshető (`/api/marketing/subscribers`) —
  // nagy vendégkörnél sose töltünk be egyszerre többet, mint egy oldalnyit, keresésnél is a
  // szerver szűr, nem a már letöltött listát vagdossuk kliens-oldalon.
  const [subs, setSubs] = useState(initialSubscribers)
  useEffect(() => setSubs(initialSubscribers), [initialSubscribers])
  const [subPage, setSubPage] = useState(1)
  const [subHasMore, setSubHasMore] = useState(initialSubscribersHasMore)
  useEffect(() => { setSubHasMore(initialSubscribersHasMore); setSubPage(1) }, [initialSubscribers, initialSubscribersHasMore])
  const [subLoading, setSubLoading] = useState(false)

  const [countryFilter, setCountryFilter] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Jogilag NEM töröljük a leiratkozó vendéget a rendszerből — csak `marketing_consent: false`-ra
  // állítjuk (lásd `/api/marketing/unsubscribe/[token]`), a rekord megmarad. Ez a kapcsoló teszi
  // őket visszakereshetővé/monitorozhatóvá a tulajnak (piros kiemeléssel, lásd lentebb).
  const [subStatus, setSubStatus] = useState<'subscribed' | 'unsubscribed'>('subscribed')

  const fetchSubs = useCallback(async (page: number, search: string, country: string, sort: 'asc' | 'desc', status: 'subscribed' | 'unsubscribed', append: boolean) => {
    setSubLoading(true)
    try {
      const params = new URLSearchParams({ kind: variant, businessId, page: String(page), limit: String(SUB_PAGE_SIZE), sort, status })
      if (search.trim()) params.set('search', search.trim())
      if (country) params.set('country', country)
      const res = await fetch(`/api/marketing/subscribers?${params.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült betölteni a feliratkozókat.')
      setSubs(prev => append ? [...prev, ...json.docs] : json.docs)
      setSubHasMore(!!json.hasNextPage)
      setSubPage(page)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült betölteni a feliratkozókat.')
    } finally {
      setSubLoading(false)
    }
  }, [variant, businessId])

  const enabled = currentPackage !== 'none'
  // A hírlevél-csomag választó a Fizetésekből az "API & Integrációk" fülre költözött.
  const settingsHref = variant === 'salon' ? '/dashboard/settings?tab=integrations' : '/restaurant/settings?tab=integrations'

  const composerRef = useRef<HTMLDivElement>(null)
  const subscribersRef = useRef<HTMLDivElement>(null)
  const [subject, setSubject] = useState('')
  // A kezdő üres blokk ID-ja hidratáció-biztos módon `useId()`-vel készül — a `nextId()` (
  // `Date.now()` alapú, `emptyTextBlock()`-ban) szerveren és kliensen MÁS időbélyeget adna az
  // első renderkor, ami hidratálási mismatch-et okozott (a blokk `key`-e/`data-block-id`-ja nem
  // egyezett szerver és kliens között, React ezt nem tudta megjavítani, a blokk újraépült
  // hidratáláskor, ami megzavarta a kijelölést/eseménykezelést). Minden KÉSŐBBI (sín-beszúrt
  // vagy küldés-utáni reset) blokk már csak kliens-oldalon jön létre, ott a `nextId()` biztonságos.
  const initialBlockId = useId()
  const [blocks, setBlocks] = useState<ComposerBlock[]>(() => [{ id: `blk-${initialBlockId}`, type: 'text', html: '' }])
  const bodyHtml = useMemo(() => blocksToHtml(blocks), [blocks])
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  // "Sablon betöltése" — ha már van bármi tartalom (tárgy vagy egy blokk sem üres), előbb
  // megerősítést kérünk, mert a sablon FELÜLÍRJA a jelenlegi szerkesztőt (nem fésüli össze vele).
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false)
  const hasComposerContent = subject.trim().length > 0 || blocks.some((b) => 'html' in b && b.html?.replace(/<[^>]+>/g, '').trim())
  const applyTemplate = () => {
    const tpl = marketingEmailTemplate()
    setSubject(tpl.subject)
    setBlocks(tpl.blocks)
    setDraftId(null)
    setTemplateConfirmOpen(false)
  }
  const loadTemplateClick = () => { if (hasComposerContent) setTemplateConfirmOpen(true); else applyTemplate() }

  // Szerver-oldali vázlat-mentés — a `marketing-campaigns` collectionba ír `status: 'draft'`-
  // tal, hogy a Kampányok listában is megjelenjen (nem csak ezen a gépen, mint a korábbi
  // localStorage-os verzió). A `draftId` azt tartja számon, hogy EZ a piszkozat már létezik-e —
  // ha igen, újramentéskor UGYANAZT a rekordot frissíti, nem hoz létre újat minden kattintásnál.
  const [draftId, setDraftId] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const saveDraft = async () => {
    if (!subject.trim()) { toast.error('A tárgy megadása kötelező a mentéshez.'); return }
    setSavingDraft(true)
    try {
      const res = await fetch('/api/marketing/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: variant, businessId, subject, blocks, draftId, ...(targetIds.length > 0 ? { customerIds: targetIds } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült elmenteni a vázlatot.')
      // Optimista lista-frissítés — NE csak a `router.refresh()`-re támaszkodjunk (az egy
      // aszinkron szerver-újrafetch, ami nem feltétlenül fut le, mire a user visszakattint a
      // sorra); a most mentett tartalmat AZONNAL, helyben is berakjuk a `campaigns` state-be.
      const savedRow: CampaignRow = { id: String(json.id), subject: subject.trim(), recipient_count: 0, opened_count: null, createdAt: new Date().toISOString(), status: 'draft', blocksJson: blocks, targetCustomerIds: targetIds.length > 0 ? targetIds : null }
      setCampaigns(prev => {
        const idx = prev.findIndex(c => c.id === savedRow.id)
        if (idx === -1) return [savedRow, ...prev]
        const next = [...prev]
        next[idx] = { ...next[idx], ...savedRow, createdAt: next[idx].createdAt }
        return next
      })
      setDraftId(String(json.id))
      toast.success('Piszkozat elmentve a Kampányok közé')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült elmenteni a vázlatot.')
    } finally {
      setSavingDraft(false)
    }
  }
  /** Egy kampány-sorra kattintva a tartalma visszatöltődik a szerkesztőbe — piszkozatnál
   *  pontosan onnan folytatódik, ahol elmentették (a `draftId` beállításával a mentés/küldés
   *  UGYANAZT a piszkozat-rekordot frissíti). Egy MÁR KIKÜLDÖTT kampánynál nincs `draftId` —
   *  a megnyitás csak megtekintésre/újrafelhasználásra való, egy mentés vagy újraküldés ÚJ
   *  kampányt hoz létre, a küldés-előzményt (a kiküldött rekordot) nem írja felül. Kiküldött
   *  kampánynál a régi célzást (`targetCustomerIds`) SEM örököljük — ha az eredetileg csak
   *  egy-két főnek ment ki, az újranyitás után "Mindenki"-re áll vissza, nem arra a szűk,
   *  valószínűleg elavult listára (a szándék a TARTALOM újrafelhasználása, nem a régi címzés
   *  megismétlése). */
  const loadCampaign = (c: CampaignRow) => {
    setDraftId(c.status === 'draft' ? c.id : null)
    setSubject(c.subject)
    setBlocks(Array.isArray(c.blocksJson) && c.blocksJson.length > 0 ? c.blocksJson : [emptyTextBlock()])
    setSelected(c.status === 'draft' ? new Set(c.targetCustomerIds ?? []) : new Set())
    if (c.status === 'sent') toast.message('Kiküldött kampány betöltve — a mentés/küldés új kampányt hoz létre')
    scrollToComposer()
  }

  const [view, setView] = useState<'subscribers' | 'campaigns'>('subscribers')
  const [query, setQuery] = useState('')
  const [campaignVisibleCount, setCampaignVisibleCount] = useState(15)
  const [subVisibleCount, setSubVisibleCount] = useState(15)
  // A kijelölés (`selected`) SZÁNDÉKOSAN nem törlődik fül-váltáskor — a Címzettek-választó
  // fül-függetlenül is enged választani, egy véletlen "Kampányok" fülre kattintás nem
  // veszítheti el a már kiválasztott címzetteket.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => { setQuery(''); setCampaignVisibleCount(pageIncrement); setSubVisibleCount(pageIncrement) }, [view, pageIncrement])

  // Kereséskor/szűréskor (Feliratkozók nézetben) a SZERVER szűr — debounce-olva, hogy ne
  // küldjünk kérést minden lenyomott billentyűre. Első mountkor NEM fut (az SSR már betöltötte
  // az 1. oldalt).
  const didInitSearch = useRef(false)
  useEffect(() => {
    if (!didInitSearch.current) { didInitSearch.current = true; return }
    if (view !== 'subscribers') return
    const t = setTimeout(() => { fetchSubs(1, query, countryFilter, sortDir, subStatus, false); setSubVisibleCount(pageIncrement) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryFilter, sortDir, subStatus, view])

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Leiratkozottak tömeges törlése — UGYANAZ a checkbox+"Mind kijelölése" mechanizmus, mint a
  // feliratkozottaknál (`selected`/`toggleSelect`/`toggleSelectAll`), csak a kontextus-gomb
  // "Törlés"-re vált a "Levél"/"Leiratkoztatás" helyett — nincs külön kijelölés-állapot, nincs
  // külön UI, csak a végművelet más (`DELETE /api/customers`, soronként, a meglévő endpointtal).
  const [subBulkDeleteOpen, setSubBulkDeleteOpen] = useState(false)
  const [subBulkDeleteBusy, setSubBulkDeleteBusy] = useState(false)
  const bulkDeleteSubscribers = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) { setSubBulkDeleteOpen(false); return }
    setSubBulkDeleteBusy(true)
    try {
      const targets = subs.filter(s => ids.includes(s.id))
      await Promise.all(targets.map(s => fetch('/api/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: s.email }),
      })))
      setSubs(prev => prev.filter(s => !ids.includes(s.id)))
      setSelected(new Set())
      toast.success(`${targets.length} vendég véglegesen törölve`)
    } catch {
      toast.error('Nem sikerült törölni mindenkit.')
    } finally {
      setSubBulkDeleteBusy(false)
      setSubBulkDeleteOpen(false)
    }
  }

  // Kampányok kijelölése/tömeges törlése — SZÁNDÉKOSAN ugyanaz a minta, mint a feliratkozóknál
  // (checkbox soronként + "Mind kijelölése" + egy kontextus-gomb), nem külön mechanizmus.
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set())
  const toggleSelectCampaign = (id: string) =>
    setSelectedCampaigns(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const [campaignBulkDeleteOpen, setCampaignBulkDeleteOpen] = useState(false)
  const [campaignBulkDeleteBusy, setCampaignBulkDeleteBusy] = useState(false)
  const bulkDeleteCampaigns = async () => {
    const ids = Array.from(selectedCampaigns)
    if (ids.length === 0) { setCampaignBulkDeleteOpen(false); return }
    setCampaignBulkDeleteBusy(true)
    try {
      await Promise.all(ids.map(id => fetch('/api/marketing/campaigns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: variant, businessId, campaignId: id }),
      })))
      setCampaigns(prev => prev.filter(c => !ids.includes(c.id)))
      if (draftId && ids.includes(draftId)) setDraftId(null)
      setSelectedCampaigns(new Set())
      toast.success(`${ids.length} kampány törölve`)
      router.refresh()
    } catch {
      toast.error('Nem sikerült törölni mindegyik kampányt.')
    } finally {
      setCampaignBulkDeleteBusy(false)
      setCampaignBulkDeleteOpen(false)
    }
  }

  // Egy kiküldött kampány TÉNYLEGES címzett-listája (`email-log`-ból, nem a `target_customer_ids`-
  // ból — az csak a küldéskori kijelölést tükrözi, "Mindenki"-nél üres) — hogy lássuk, kik
  // kapták meg ténylegesen, és ne küldjük ki véletlenül újra ugyanazoknak.
  const [recipientsView, setRecipientsView] = useState<{ campaign: CampaignRow; loading: boolean; recipients: { email: string; name: string | null; status: string }[] } | null>(null)
  const openRecipientsView = async (c: CampaignRow) => {
    setRecipientsView({ campaign: c, loading: true, recipients: [] })
    try {
      const params = new URLSearchParams({ kind: variant, businessId, campaignId: c.id })
      const res = await fetch(`/api/marketing/campaigns/recipients?${params.toString()}`, { credentials: 'include' })
      const json = await res.json()
      setRecipientsView({ campaign: c, loading: false, recipients: res.ok ? json.recipients : [] })
      if (!res.ok) toast.error(json.error ?? 'Nem sikerült betölteni a címzetteket.')
    } catch {
      setRecipientsView(prev => (prev ? { ...prev, loading: false } : null))
      toast.error('Nem sikerült betölteni a címzetteket.')
    }
  }

  // Címzett-választó felugró — közvetlenül a "Címzettek" sor alatt lehet válogatni, nem kell
  // felgörgetni a fenti listához. Saját, kis keresés (nem a fő lista state-jét használja, hogy
  // ne zavarja össze a nézet/lapozás állapotát) — ugyanazt a `selected` Set-et írja, így a fenti
  // listával mindig konzisztens marad.
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientResults, setRecipientResults] = useState<SubscriberRow[]>([])
  const [recipientLoading, setRecipientLoading] = useState(false)
  const recipientPickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!recipientPickerOpen) return
    setRecipientLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind: variant, businessId, page: '1', limit: '8', sort: 'desc' })
        if (recipientQuery.trim()) params.set('search', recipientQuery.trim())
        const res = await fetch(`/api/marketing/subscribers?${params.toString()}`, { credentials: 'include' })
        const json = await res.json()
        if (res.ok) setRecipientResults(json.docs)
      } finally {
        setRecipientLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [recipientPickerOpen, recipientQuery, variant, businessId])
  useEffect(() => {
    if (!recipientPickerOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (recipientPickerRef.current && !recipientPickerRef.current.contains(e.target as Node)) setRecipientPickerOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [recipientPickerOpen])

  const cap = currentPackage === 'ingyenes' ? packages.ingyenes.cap : currentPackage === 'alap' ? packages.alap.cap : currentPackage === 'premium' ? packages.premium.cap : 0
  const remaining = Math.max(0, cap - usedThisMonth)
  const notOpened = Math.max(0, usedThisMonth - openedThisMonth)
  const openedPct = cap > 0 ? (openedThisMonth / cap) * 100 : 0
  const notOpenedPct = cap > 0 ? (notOpened / cap) * 100 : 0
  const freePct = Math.max(0, 100 - openedPct - notOpenedPct)
  const openRatePct = usedThisMonth > 0 ? Math.round((openedThisMonth / usedThisMonth) * 100) : 0

  const scrollToComposer = () => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Mobilon a fejléc csengő melletti ikonjai (DashboardNav) váltják ki ezt a két akciót — ott a
  // gombok külön, fekete/üveg körikonokként jelennek meg, itt nem kell duplán megjeleníteni őket
  // (lásd `actionButtons` `hidden lg:flex`-je lejjebb).
  useEffect(() => {
    const openComposer = () => scrollToComposer()
    const openPackage = () => router.push(settingsHref)
    window.addEventListener('davelopment:open-marketing-composer', openComposer)
    window.addEventListener('davelopment:open-marketing-package', openPackage)
    return () => {
      window.removeEventListener('davelopment:open-marketing-composer', openComposer)
      window.removeEventListener('davelopment:open-marketing-package', openPackage)
    }
  }, [router, settingsHref])

  // Mindig CSAK egy gomb-pár látszik ebben a sorban (sose 4 egyszerre) — kijelöléskor a
  // kontextus-gombok (Levél/Leiratkoztatás/Törlés) VÁLTJÁK fel a Csomag/Hírlevél párost, nem
  // hozzáadódnak melléjük — így a sor szélessége sose nő meg annyira, hogy flex-wrap miatt
  // lejjebb tolja a kártyát kijelöléskor.
  const actionButtons = (
    <div className="hidden shrink-0 flex-wrap items-center gap-2.5 lg:flex">
      {view === 'campaigns' && selectedCampaigns.size > 0 ? (
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => setCampaignBulkDeleteOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full bg-[#C0392B] px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#a93226]"
        >
          <Trash2 className="h-4 w-4" /> Törlés ({selectedCampaigns.size})
        </motion.button>
      ) : view === 'subscribers' && subStatus === 'unsubscribed' && selected.size > 0 ? (
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => setSubBulkDeleteOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full bg-[#C0392B] px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#a93226]"
        >
          <Trash2 className="h-4 w-4" /> Törlés ({selected.size})
        </motion.button>
      ) : view === 'subscribers' && selected.size > 0 ? (
        <>
          <motion.button
            type="button"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            onClick={scrollToComposer}
            className="flex h-10 items-center gap-2 rounded-full bg-ink-dark px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PenLine className="h-4 w-4" /> Levél küldése ({selected.size})
          </motion.button>
          <motion.button
            type="button"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            onClick={() => setBulkOpen(true)}
            className="flex h-10 items-center gap-2 rounded-full bg-[#C0392B] px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#a93226]"
          >
            <UserX className="h-4 w-4" /> Leiratkoztatás ({selected.size})
          </motion.button>
        </>
      ) : (
        <>
          <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover">
            <Link
              href={settingsHref}
              className="flex h-10 items-center rounded-full border border-line-strong bg-transparent px-5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink/30"
            >
              Csomag bővítése
            </Link>
          </motion.div>
          <motion.button
            type="button"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            onClick={scrollToComposer}
            className="flex h-10 items-center gap-2 rounded-full bg-ink-dark px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PenLine className="h-4 w-4" /> Új hírlevél
          </motion.button>
        </>
      )}
    </div>
  )

  // Ha van kijelölés (akár a Feliratkozók listából, akár a Címzettek-választóból), a küldés
  // CSAK azokat célozza — egyébként mindenkit, aki feliratkozott. FONTOS: ez NEM köthető a
  // `view`-hoz (melyik fül aktív) — a Címzettek-választó fül-függetlenül is enged kijelölni,
  // egy `view === 'subscribers'` feltétel itt régebben csendben eldobta ezeket a kijelöléseket.
  const targetIds = Array.from(selected)
  const targetCount = targetIds.length > 0 ? targetIds.length : subscriberCount

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: variant, businessId, subject, bodyHtml, blocks, ...(targetIds.length > 0 ? { customerIds: targetIds } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült elküldeni a hírlevelet.')
      toast.success(`Elküldve ${json.sent} címzettnek`)
      setCampaigns(prev => [{ id: `tmp-${Date.now()}`, subject: subject.trim(), recipient_count: json.sent, opened_count: 0, createdAt: new Date().toISOString(), status: 'sent', blocksJson: blocks, targetCustomerIds: targetIds.length > 0 ? targetIds : null }, ...prev])
      // Ha egy piszkozatból küldtük ki, a piszkozat-rekord innentől felesleges (a küldés a
      // send route-on keresztül külön, `status:'sent'` kampányt hoz létre) — töröljük.
      if (draftId) {
        fetch('/api/marketing/drafts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ kind: variant, businessId, draftId }),
        }).catch(() => {})
      }
      setSubject('')
      setBlocks([emptyTextBlock()])
      setSelected(new Set())
      setDraftId(null)
      setSendConfirmOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült elküldeni a hírlevelet.')
      setSendConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  const confirmBulkUnsubscribe = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) { setBulkOpen(false); return }
    setBulkBusy(true)
    try {
      const res = await fetch('/api/marketing/unsubscribe-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: variant, businessId, customerIds: ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült leiratkoztatni.')
      setSubs(prev => prev.filter(s => !ids.includes(s.id)))
      setSelected(new Set())
      toast.success(`Leiratkoztatva: ${json.count ?? ids.length} fő`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült leiratkoztatni.')
    } finally {
      setBulkBusy(false)
      setBulkOpen(false)
    }
  }

  const plainLength = bodyHtml.replace(/<[^>]+>/g, '').trim().length
  const canSend = enabled && subject.trim().length > 0 && plainLength > 0 && targetCount > 0 && usedThisMonth < cap

  const previewHtml = useMemo(() => {
    if (!subject.trim() && !plainLength) return null
    return emailLayout({
      brandName: businessName,
      brandLogoUrl: logoUrl,
      header: brandHeroBlock({ brandName: businessName, brandLogoUrl: logoUrl, icon: 'logo', title: subject.trim() || 'Hírlevél tárgya', subtitle: '' }),
      content: [
        richContentBlock(bodyHtml || '<p>Itt jelenik meg a hírlevél szövege…</p>'),
        `<tr><td style="background:${COLORS.surface};padding:18px 28px;text-align:center"><span style="color:#9A9A9A;font-size:11px;text-decoration:underline">Leiratkozás a hírlevélről</span></td></tr>`,
        bottomSpacer(),
      ].join(''),
    })
  }, [subject, bodyHtml, plainLength, businessName, logoUrl])

  const q = query.trim().toLowerCase()
  const filteredCampaigns = campaigns.filter(c => !q || c.subject.toLowerCase().includes(q))
  const visibleCampaigns = filteredCampaigns.slice(0, campaignVisibleCount)
  // A kampány-lista NEM lapozott szerver-oldalon (max 200 sor, mind betöltve) — "Mind
  // kijelölése" ezért egyszerűen a SZŰRÉSNEK megfelelő összes (nem csak a "több mutatása"
  // limittel épp látható) sort jelöli ki, külön API-hívás nélkül (ellentétben a feliratkozók
  // lapozott listájával, ahol ehhez `idsOnly` szerver-lekérdezés kell).
  const allCampaignsSelected = filteredCampaigns.length > 0 && filteredCampaigns.every(c => selectedCampaigns.has(c.id))
  const toggleSelectAllCampaigns = () => setSelectedCampaigns(allCampaignsSelected ? new Set() : new Set(filteredCampaigns.map(c => c.id)))

  const visibleSubs = subs.slice(0, subVisibleCount)
  const allSelected = visibleSubs.length > 0 && visibleSubs.every(s => selected.has(s.id))
  const [selectingAll, setSelectingAll] = useState(false)
  // "Mind kijelölése" a SZŰRÉSNEK MEGFELELŐ ÖSSZES feliratkozót jelöli ki, nem csak a kliensen
  // épp betöltött (lapozott) sorokat — enélkül egy 484 fős listánál csak az első 15-20 lett
  // volna kijelölve, a többi csendben kimaradt volna a küldésből.
  const toggleSelectAll = async () => {
    if (allSelected) { setSelected(new Set()); return }
    setSelectingAll(true)
    try {
      const params = new URLSearchParams({ kind: variant, businessId, idsOnly: '1', status: subStatus })
      if (query.trim()) params.set('search', query.trim())
      if (countryFilter) params.set('country', countryFilter)
      const res = await fetch(`/api/marketing/subscribers?${params.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (res.ok) setSelected(new Set(json.ids as string[]))
      else toast.error(json.error ?? 'Nem sikerült kijelölni mindenkit.')
    } catch {
      toast.error('Nem sikerült kijelölni mindenkit.')
    } finally {
      setSelectingAll(false)
    }
  }

  const loadMoreSubs = async () => {
    if (subVisibleCount < subs.length) {
      setSubVisibleCount(v => Math.min(v + pageIncrement, subs.length))
      return
    }
    if (subHasMore) {
      await fetchSubs(subPage + 1, query, countryFilter, sortDir, subStatus, true)
      setSubVisibleCount(v => v + pageIncrement)
    }
  }

  return (
    <>
      {/* ── HEADER ── */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Marketing"
          title="Hírlevél"
          description="Küldj marketing-emailt a feliratkozott vendégeidnek."
        />
        {enabled && (
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <StatusPills
              eager
              minSegmentWidth={110}
              className="flex-1 lg:max-w-[760px]"
              segments={[
                { label: 'Megnyitva', pct: openedPct, value: openedThisMonth, suffix: ' email', background: '#F1CE45', color: '#1D1C19' },
                { label: 'Nem nyitva', pct: notOpenedPct, value: notOpened, suffix: ' email', background: '#1D1C19', color: '#fff' },
                { label: 'Szabad keret', pct: freePct, value: remaining, suffix: ' email', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
              ]}
            />
            <div className="flex flex-wrap items-start gap-8 lg:gap-10">
              <CountUpKpi icon="users" value={subscriberCount} label="Feliratkozó" />
              <CountUpKpi icon="layers" value={campaigns.length} label="Kiküldött kampány" />
              <CountUpKpi icon="check" value={openRatePct} label="Nyitási arány" suffix=" %" />
            </div>
          </div>
        )}
      </div>

      {!enabled && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] bg-white px-6 py-14 text-center shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)]">
          <p className="text-[14px] font-medium text-ink-soft">A hírlevél funkció jelenleg ki van kapcsolva.</p>
          <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover">
            <Link
              href={settingsHref}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-dark px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Csomag bekapcsolása <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      )}

      {enabled && (
        <>
          {/* ── MAPPA-FÜL kártya — nézet-váltó (Feliratkozók/Kampányok), jobbra az akció-gombok EGY
              vonalban; ALATTA külön sorban a szűrők (státusz/ország/kereső) — ezeket korábban
              magába a keskeny mappa-fül sávba zsúfoltuk, ami több szűrő hozzáadása után (státusz-
              kapcsoló) már nem fért ki / szétcsúszott kisebb szélességeken. Külön sorban szabadon
              tördelhet, nem feszíti szét a fül alakját. ── */}
          <div ref={subscribersRef} className="relative mb-6 scroll-mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* MAPPA-FÜL héj — 1:1 a Vouchers/Staff oldal bevált stílusa (méret, szín, notch-ív),
                  nem újratalálva. A nézetváltás egy önálló szegmens-pill benne (sima két gomb +
                  egy csúszó `layoutId` háttér). */}
              <div className="relative z-10 flex h-[48px] w-fit items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:px-6">
                <div className="relative flex shrink-0 items-center gap-0.5 rounded-[14px] bg-white/60 p-1">
                  {VIEW_TABS.map((t) => {
                    const active = view === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setView(t.key)}
                        className={cn(
                          'relative whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                          active ? 'text-ink' : 'text-ink-soft2 hover:text-ink-soft',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="viewTabPill"
                            className="absolute inset-0 -z-10 rounded-[10px] bg-white shadow-sm"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        )}
                        {t.label}
                        {t.key === 'campaigns' && campaigns.length > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[9.5px] font-bold leading-none text-ink shadow-[0_1px_3px_rgba(0,0,0,.2)]">
                            {campaigns.length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <span
                  className="pointer-events-none absolute -right-[24px] bottom-0 h-[24px] w-[24px]"
                  style={{ background: 'radial-gradient(circle at top right, transparent 23px, rgba(255,255,255,.62) 23.5px)' }}
                />
              </div>

              {actionButtons}
            </div>

            {/* A szűrők (státusz/ország/kereső) EZEN a fehér kártyán belül, a tábla fölött élnek —
                korábban egy külön, a kártyán KÍVÜLI sorban lebegtek, ami két elszakadt zónának
                látszott (lebegő "pill"-sor + alatta a nagy fehér kártya, közte réssel). Most egy
                folytonos konténer, nincs vizuális törés. */}
            <div className="min-h-[280px] rounded-b-[28px] rounded-tr-[28px] bg-[rgba(255,255,255,.9)] p-5 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[18px] sm:p-6">
              <div className="mb-4 flex flex-nowrap items-center gap-2">
                {view === 'subscribers' && (
                  <div className="flex shrink-0 items-center gap-0.5 rounded-[18px] border border-line-strong bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setSubStatus('subscribed')}
                      className={cn('rounded-[14px] px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200', subStatus === 'subscribed' ? 'bg-ink-dark text-white' : 'text-ink-soft2 hover:text-ink-soft')}
                    >
                      Feliratkozva
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubStatus('unsubscribed')}
                      className={cn('rounded-[14px] px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200', subStatus === 'unsubscribed' ? 'bg-[#C0392B] text-white' : 'text-ink-soft2 hover:text-ink-soft')}
                    >
                      Leiratkozva
                    </button>
                  </div>
                )}
                {view === 'subscribers' && countryOptions.length > 0 && (
                  <div className="relative hidden shrink-0 md:block">
                    <select
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="cursor-pointer appearance-none rounded-[18px] border border-line-strong bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                    >
                      <option value="">Minden ország</option>
                      {countryOptions.map((code) => (
                        <option key={code} value={code}>{countryFlag(code) ? `${countryFlag(code)} ${code}` : code}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
                  </div>
                )}
                {/* Mindig látható, akár mobilon is — de a sor SOSE törik új sorba: mobilon a
                    mező zsugorodik (`min-w-0 flex-1`), hogy kiférjen a státusz-kapcsoló mellett,
                    desktopon (`md:`) fix, kényelmes szélességű. */}
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[18px] border border-line-strong bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-gold/60 md:w-[200px] md:flex-none">
                  <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Keresés"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="shrink-0 text-ink-soft2 hover:text-ink">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lapváltás (Feliratkozók ↔ Kampányok) folyamatos framer crossfade-del, nem
                  ugrásszerűen — a `key={view}` teszi ki-be animálhatóvá az AnimatePresence-t. */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
              {view === 'subscribers' ? (
                // Feliratkozva ↔ Leiratkozva váltás is folyamatos crossfade-del, nem ugrással.
                <AnimatePresence mode="wait">
                <motion.div
                  key={subStatus}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={subLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                  <div className="hidden grid-cols-[24px_1.1fr_1.2fr_100px_1fr_130px] items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={selectingAll}
                      aria-label="Mind kijelölése"
                      title="Mind kijelölése"
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors disabled:opacity-50 ${allSelected ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                    >
                      {allSelected && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                    </button>
                    <div>Név</div>
                    <div>Email</div>
                    <div>Ország</div>
                    <div>Város</div>
                    <button
                      type="button"
                      onClick={() => { const next = sortDir === 'desc' ? 'asc' : 'desc'; setSortDir(next); fetchSubs(1, query, countryFilter, next, subStatus, false) }}
                      className="flex items-center gap-1 text-left transition-colors hover:text-ink"
                      title={sortDir === 'desc' ? 'Legrégebbi elöl' : 'Legújabb elöl'}
                    >
                      Feliratkozva <ArrowUpDown className="h-3 w-3" strokeWidth={2.2} />
                    </button>
                  </div>

                  {subs.length === 0 && (
                    <p className="py-10 text-center text-sm text-ink-soft">
                      {query.trim() ? 'Nincs találat.' : subStatus === 'unsubscribed' ? 'Nincs leiratkozott vendéged.' : 'Még nincs feliratkozott vendéged.'}
                    </p>
                  )}

                  {subs.length > 0 && (
                    <div className="mb-1 flex items-center justify-between gap-2 pb-2 lg:hidden">
                      <button type="button" onClick={toggleSelectAll} disabled={selectingAll} className="text-[12px] font-semibold text-ink-soft disabled:opacity-50">
                        {selectingAll ? 'Kijelölés…' : allSelected ? 'Kijelölés törlése' : 'Mind kijelölése'}
                      </button>
                      {selected.size > 0 && (
                        <div className="flex items-center gap-1.5">
                          {subStatus === 'unsubscribed' ? (
                            <motion.button
                              type="button"
                              variants={buttonHover}
                              initial="rest"
                              whileHover="hover"
                              whileTap="hover"
                              onClick={() => setSubBulkDeleteOpen(true)}
                              className="flex h-8 items-center gap-1.5 rounded-full bg-[#C0392B] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#a93226]"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Törlés ({selected.size})
                            </motion.button>
                          ) : (
                            <>
                              <motion.button
                                type="button"
                                variants={buttonHover}
                                initial="rest"
                                whileHover="hover"
                                whileTap="hover"
                                onClick={scrollToComposer}
                                className="flex h-8 items-center gap-1.5 rounded-full bg-ink-dark px-3.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                              >
                                <PenLine className="h-3.5 w-3.5" /> Levél ({selected.size})
                              </motion.button>
                              <motion.button
                                type="button"
                                variants={buttonHover}
                                initial="rest"
                                whileHover="hover"
                                whileTap="hover"
                                onClick={() => setBulkOpen(true)}
                                className="flex h-8 items-center gap-1.5 rounded-full bg-[#C0392B] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#a93226]"
                              >
                                <UserX className="h-3.5 w-3.5" /> Leiratkoztatás ({selected.size})
                              </motion.button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {visibleSubs.map((s, idx) => {
                    const isSel = selected.has(s.id)
                    const isUnsub = s.status === 'unsubscribed'
                    return (
                      <div
                        key={s.id}
                        style={isSel ? { background: 'var(--dav-accent)' } : undefined}
                        className={cn(
                          'mt-2 rounded-[18px] border-b border-line-strong/70 transition-all last:border-b-0',
                          isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : isUnsub ? 'bg-[#C0392B]/[0.06] hover:bg-[#C0392B]/10' : idx % 2 === 1 ? 'bg-paper/60 hover:bg-gold/10' : 'hover:bg-gold/10',
                        )}
                      >
                        <div className="hidden grid-cols-[24px_1.1fr_1.2fr_100px_1fr_130px] items-center gap-3.5 px-3.5 py-2.5 lg:grid">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelect(s.id) }}
                            aria-pressed={isSel}
                            aria-label="Kijelölés"
                            className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                          >
                            {isSel && <Check className="h-3 w-3 text-gold" strokeWidth={3} />}
                          </button>
                          <p className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
                            {isUnsub && <span className="shrink-0 rounded-full bg-[#C0392B]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.03em] text-[#C0392B]">Leiratkozva</span>}
                            <span className="truncate">{s.name || '—'}</span>
                          </p>
                          <p className="truncate text-[14px] text-ink-soft">{s.email || '—'}</p>
                          <p className="truncate text-[14px] text-ink-soft">
                            {countryFlag(s.country) ? `${countryFlag(s.country)} ${s.country}` : '—'}
                          </p>
                          <p className="truncate text-[14px] text-ink-soft">{s.city || '—'}</p>
                          <p className="text-[14px] text-ink-soft">{fmtDate(s.consentAt)}</p>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-3.5 lg:hidden">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelect(s.id) }}
                            aria-pressed={isSel}
                            aria-label="Kijelölés"
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}
                          >
                            {isSel && <Check className="h-3 w-3 text-gold" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-1.5 truncate text-[16px] font-semibold text-ink">
                              {isUnsub && <span className="shrink-0 rounded-full bg-[#C0392B]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.03em] text-[#C0392B]">Leiratkozva</span>}
                              <span className="truncate">{s.name || s.email || '—'}</span>
                            </p>
                            <p className="truncate text-[14px] text-ink-soft">{s.email}</p>
                            {(s.city || countryFlag(s.country)) && (
                              <p className="mt-0.5 truncate text-[13px] text-ink-soft2">
                                {countryFlag(s.country) && `${countryFlag(s.country)} ${s.country}`}
                                {countryFlag(s.country) && s.city && ' · '}
                                {s.city}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-right text-[13px] text-ink-soft2">{fmtDate(s.consentAt)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {(subVisibleCount < subs.length || subHasMore) && (
                    <motion.button
                      type="button"
                      variants={buttonHover}
                      initial="rest"
                      whileHover="hover"
                      whileTap="hover"
                      disabled={subLoading}
                      onClick={loadMoreSubs}
                      className="mt-4 flex h-10 w-full items-center justify-center rounded-[14px] bg-white text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper disabled:opacity-60"
                    >
                      {subLoading ? 'Betöltés…' : `Több mutatása${subscriberCount > subVisibleCount ? ` (${subscriberCount - subVisibleCount})` : ''}`}
                    </motion.button>
                  )}
                </motion.div>
                </AnimatePresence>
              ) : (
                <>
                  <div className="hidden grid-cols-[24px_1.5fr_120px_120px_140px] items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid">
                    <button
                      type="button"
                      onClick={toggleSelectAllCampaigns}
                      aria-label="Mind kijelölése"
                      title="Mind kijelölése"
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${allCampaignsSelected ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                    >
                      {allCampaignsSelected && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                    </button>
                    <div>Tárgy</div>
                    <div>Címzettek</div>
                    <div>Megnyitva</div>
                    <div>Kiküldve</div>
                  </div>

                  {filteredCampaigns.length === 0 && (
                    <p className="py-10 text-center text-sm text-ink-soft">{campaigns.length === 0 ? 'Még nem küldtél hírlevelet.' : 'Nincs találat.'}</p>
                  )}

                  {filteredCampaigns.length > 0 && (
                    <div className="mb-1 flex items-center justify-between gap-2 pb-2 lg:hidden">
                      <button type="button" onClick={toggleSelectAllCampaigns} className="text-[12px] font-semibold text-ink-soft">
                        {allCampaignsSelected ? 'Kijelölés törlése' : 'Mind kijelölése'}
                      </button>
                      {selectedCampaigns.size > 0 && (
                        <motion.button
                          type="button"
                          variants={buttonHover}
                          initial="rest"
                          whileHover="hover"
                          whileTap="hover"
                          onClick={() => setCampaignBulkDeleteOpen(true)}
                          className="flex h-8 items-center gap-1.5 rounded-full bg-[#C0392B] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#a93226]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Törlés ({selectedCampaigns.size})
                        </motion.button>
                      )}
                    </div>
                  )}

                  {visibleCampaigns.map((c, idx) => {
                    const isDraft = c.status === 'draft'
                    const isSelC = selectedCampaigns.has(c.id)
                    const openPct = !isDraft && c.recipient_count > 0 && c.opened_count != null ? Math.round((c.opened_count / c.recipient_count) * 100) : null
                    return (
                    <div
                      key={c.id}
                      onClick={() => loadCampaign(c)}
                      style={isSelC ? { background: 'var(--dav-accent)' } : undefined}
                      className={cn(
                        'mt-2 cursor-pointer rounded-[18px] border-b border-line-strong/70 px-3.5 py-3 transition-all last:border-b-0',
                        isSelC ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : idx % 2 === 1 ? 'bg-paper/60 hover:bg-gold/10' : 'hover:bg-gold/10',
                      )}
                    >
                      <div className="hidden grid-cols-[24px_1.5fr_120px_120px_140px] items-center gap-3.5 lg:grid">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSelectCampaign(c.id) }}
                          aria-pressed={isSelC}
                          aria-label="Kijelölés"
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSelC ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                        >
                          {isSelC && <Check className="h-3 w-3 text-gold" strokeWidth={3} />}
                        </button>
                        <p className="flex min-w-0 items-center gap-2 truncate text-[15px] font-semibold text-ink">
                          {isDraft && <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em] text-ink">Piszkozat</span>}
                          <span className="truncate">{c.subject || 'Cím nélküli piszkozat'}</span>
                        </p>
                        {isDraft ? (
                          <p className="text-[14px] text-ink-soft">—</p>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openRecipientsView(c) }}
                            className="flex w-fit items-center gap-1 text-[14px] text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
                            title="Kiknek ment ki ez a kampány"
                          >
                            <Users className="h-3 w-3" /> {c.recipient_count.toLocaleString('hu-HU')} fő
                          </button>
                        )}
                        <p className="flex items-center gap-1.5 text-[14px] text-ink-soft">
                          {openPct != null && <OpenRateRing pct={openPct} />}
                          {isDraft || c.opened_count == null ? '—' : `${c.opened_count.toLocaleString('hu-HU')} fő${openPct != null ? ` (${openPct}%)` : ''}`}
                        </p>
                        <p className="text-[14px] text-ink-soft">{fmtDate(c.createdAt)}</p>
                      </div>
                      <div className="flex items-start gap-3 py-0.5 lg:hidden">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSelectCampaign(c.id) }}
                          aria-pressed={isSelC}
                          aria-label="Kijelölés"
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSelC ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}
                        >
                          {isSelC && <Check className="h-3 w-3 text-gold" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-2 truncate text-[16px] font-semibold text-ink">
                            {isDraft && <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em] text-ink">Piszkozat</span>}
                            <span className="truncate">{c.subject || 'Cím nélküli piszkozat'}</span>
                          </p>
                          {!isDraft && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openRecipientsView(c) }}
                              className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-ink-soft underline decoration-line-strong underline-offset-2"
                            >
                              {openPct != null && <OpenRateRing pct={openPct} />}
                              {c.recipient_count.toLocaleString('hu-HU')} fő{c.opened_count != null ? ` · ${c.opened_count} megnyitva${openPct != null ? ` (${openPct}%)` : ''}` : ''}
                            </button>
                          )}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-right text-[13px] text-ink-soft2">{fmtDate(c.createdAt)}</span>
                      </div>
                    </div>
                    )
                  })}

                  {filteredCampaigns.length > campaignVisibleCount && (
                    <motion.button
                      type="button"
                      variants={buttonHover}
                      initial="rest"
                      whileHover="hover"
                      whileTap="hover"
                      onClick={() => setCampaignVisibleCount(v => v + pageIncrement)}
                      className="mt-4 flex h-10 w-full items-center justify-center rounded-[14px] bg-white text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
                    >
                      Több mutatása ({filteredCampaigns.length - campaignVisibleCount})
                    </motion.button>
                  )}
                </>
              )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Szerkesztő — NAGY, önálló canvas (a referencia szerint), nem szűk mezőbe zárva ── */}
          <div ref={composerRef} className="relative scroll-mt-6 overflow-hidden rounded-[28px] bg-white pt-10 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] sm:pt-14">
            {/* A tényleges email-tartalom (Tárgy/Címzettek/blokkok) egy KESKENY, középre igazított
                oszlopban él — nagyjából a kiküldött email valódi szélessége (lásd emailLayout.ts
                max-width:560px-je) —, a fekete sín ettől balra lebeg. A kártya maga MARAD teljes
                szélességű "vászon", csak a tartalom keskenyebb benne (a referencia szerint). */}
            <div className="mx-auto max-w-[640px]">
              <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-8">
                <span className="shrink-0 text-[14px] font-medium text-ink-soft">Tárgy</span>
                <input
                  value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Pl. Új szolgáltatás érkezett!"
                  className="min-w-0 flex-1 border-0 bg-transparent text-right text-sm text-ink outline-none placeholder:text-ink-soft2 sm:text-left"
                />
              </div>

              <div
                className="relative flex cursor-pointer items-center justify-between gap-4 border-b border-line px-6 py-4 transition-colors hover:bg-paper/50 sm:px-8"
                onClick={() => setRecipientPickerOpen((v) => !v)}
                title="Címzettek kiválasztása"
              >
                <span className="shrink-0 text-[14px] font-medium text-ink-soft">Címzettek</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink underline decoration-line-strong underline-offset-2">
                    {targetIds.length > 0 ? `${targetIds.length.toLocaleString('hu-HU')} kiválasztott feliratkozó` : `Mindenki (${subscriberCount.toLocaleString('hu-HU')} fő)`}
                  </span>
                  {targetIds.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelected(new Set()) }}
                      className="text-[12px] font-semibold text-ink-soft underline hover:text-ink"
                    >
                      Törlés
                    </button>
                  )}
                </div>

                {/* Címzett-választó felugró — kereshető lista pipákkal, közvetlenül itt kiválasztható,
                    nem kell felgörgetni a fenti táblázathoz. */}
                <AnimatePresence>
                  {recipientPickerOpen && (
                    <motion.div
                      ref={recipientPickerRef}
                      initial={{ opacity: 0, scale: 0.96, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -6 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                      style={{ transformOrigin: 'top right' }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-6 top-full z-30 mt-2 w-[320px] rounded-2xl border border-line-strong bg-white p-3 shadow-[0_18px_42px_-16px_rgba(0,0,0,.25)] sm:right-8"
                    >
                      <div className="flex items-center gap-2 rounded-[12px] border border-line-strong bg-white px-3 py-2">
                        <Search className="h-3.5 w-3.5 shrink-0 text-ink-soft" strokeWidth={1.8} />
                        <input
                          autoFocus
                          value={recipientQuery}
                          onChange={(e) => setRecipientQuery(e.target.value)}
                          placeholder="Keresés"
                          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft2"
                        />
                      </div>
                      <div className="mt-2 max-h-[280px] space-y-0.5 overflow-y-auto">
                        {recipientLoading && recipientResults.length === 0 && (
                          <p className="py-6 text-center text-[12.5px] text-ink-soft2">Keresés…</p>
                        )}
                        {!recipientLoading && recipientResults.length === 0 && (
                          <p className="py-6 text-center text-[12.5px] text-ink-soft2">Nincs találat.</p>
                        )}
                        {recipientResults.map((s) => {
                          const isSel = selected.has(s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSelect(s.id)}
                              className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-paper"
                            >
                              <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}>
                                {isSel && <Check className="h-2.5 w-2.5 text-gold" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-ink">{s.name || s.email || '—'}</span>
                                {s.name && <span className="block truncate text-[11.5px] text-ink-soft2">{s.email}</span>}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                        <button
                          type="button"
                          onClick={() => subscribersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="text-[11.5px] font-semibold text-ink-soft hover:text-ink"
                        >
                          Teljes lista megnyitása
                        </button>
                        <button type="button" onClick={() => setRecipientPickerOpen(false)} className="text-[11.5px] font-semibold text-ink-soft hover:text-ink">
                          Kész
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="min-h-[520px] px-6 pb-8 pt-4 sm:px-8 sm:pt-8">
                <div className="mb-2 flex justify-end">
                  <motion.button
                    type="button"
                    variants={buttonHover}
                    initial="rest"
                    whileHover="hover"
                    whileTap="hover"
                    onClick={loadTemplateClick}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-[12px] font-semibold text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
                    title="Alap email-sablon betöltése"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" /> Sablon
                  </motion.button>
                </div>
                <NewsletterBlockEditor blocks={blocks} onChange={setBlocks} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/60 px-6 py-4 sm:px-8">
              <div>
                {subscriberCount === 0 && <p className="text-[12px] text-ink-soft2">Még nincs feliratkozott vendéged.</p>}
                {usedThisMonth >= cap && cap > 0 && <p className="text-[12px] text-red-500">Elérted a havi keretet — a hónap hátralévő részében nem tudsz küldeni.</p>}
              </div>
              <div className="flex items-center gap-2.5">
                <motion.button
                  type="button"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  whileTap="hover"
                  disabled={savingDraft}
                  onClick={saveDraft}
                  className="flex h-11 items-center gap-2 rounded-full border border-line-strong bg-transparent px-5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-40"
                >
                  <FileText className="h-4 w-4" /> {draftId ? 'Piszkozat frissítése' : 'Mentés vázlatként'}
                </motion.button>
                <motion.button
                  type="button"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  whileTap="hover"
                  disabled={!canSend}
                  onClick={() => setSendConfirmOpen(true)}
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink-dark px-6 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" /> Küldés ({targetCount.toLocaleString('hu-HU')} címzett)
                </motion.button>
              </div>
            </div>
          </div>

          {/* ── Élő előnézet — UGYANOLYAN széles, mint a szerkesztő-kártya fölötte: eddig egy
              külön krém (`bg-paper`) kártya ÖLELTE körbe a fehér előnézet-dobozt, ami extra
              szegélyt adott hozzá, emiatt a tényleges fehér felület keskenyebbnek látszott,
              mint a composer kártyáé (aminek nincs ilyen külső ráadás-szegélye). Most egyetlen
              fehér kártya, a cím/leírás a kártyán belül kap paddinget, a doboz éle-élig ér. ── */}
          <div className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)]">
            <div className="px-5 pt-5 sm:px-8 sm:pt-8">
              <h2 className="text-[15px] font-semibold text-ink">Élő előnézet</h2>
              <p className="mt-0.5 text-[12px] text-ink-soft">Így fog kinézni a vendégeidnek kiküldött email.</p>
            </div>
            <div className="mt-4 border-t border-line">
              {previewHtml ? (
                <iframe title="Email előnézet" srcDoc={previewHtml} className="h-[520px] w-full" sandbox="" />
              ) : (
                <div className="flex h-[520px] items-center justify-center text-center text-[12.5px] text-ink-soft2">Kezdj el gépelni, hogy lásd az előnézetet…</div>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={sendConfirmOpen}
        title="Hírlevél küldése"
        description={`Biztosan elküldöd ezt a hírlevelet ${targetCount.toLocaleString('hu-HU')} ${targetIds.length > 0 ? 'kiválasztott' : 'feliratkozott'} vendégnek? A művelet nem vonható vissza.`}
        confirmLabel="Küldés"
        cancelLabel="Mégse"
        destructive={false}
        busy={sending}
        onConfirm={send}
        onCancel={() => setSendConfirmOpen(false)}
      />

      <ConfirmDialog
        open={templateConfirmOpen}
        title="Sablon betöltése"
        description="A sablon felülírja a tárgyat és a jelenlegi tartalmat a szerkesztőben. Biztosan folytatod?"
        confirmLabel="Sablon betöltése"
        cancelLabel="Mégse"
        destructive
        onConfirm={applyTemplate}
        onCancel={() => setTemplateConfirmOpen(false)}
      />

      <ConfirmDialog
        open={bulkOpen}
        title="Leiratkoztatás"
        description={`Biztosan leiratkoztatod a kijelölt ${selected.size} vendéget a hírlevélről? Onnantól nem kapnak több hírlevelet, amíg újra fel nem iratkoznak.`}
        confirmLabel={`Leiratkoztatás (${selected.size})`}
        cancelLabel="Mégse"
        destructive
        busy={bulkBusy}
        onConfirm={confirmBulkUnsubscribe}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={subBulkDeleteOpen}
        title="Vendégek végleges törlése"
        description={`Biztosan véglegesen törlöd a kijelölt ${selected.size} vendéget az összes foglalásával együtt? A művelet nem vonható vissza.`}
        confirmLabel={`Végleges törlés (${selected.size})`}
        cancelLabel="Mégse"
        destructive
        busy={subBulkDeleteBusy}
        onConfirm={bulkDeleteSubscribers}
        onCancel={() => setSubBulkDeleteOpen(false)}
      />

      <ConfirmDialog
        open={campaignBulkDeleteOpen}
        title="Kampányok törlése"
        description={`Biztosan törlöd a kijelölt ${selectedCampaigns.size} kampányt? A művelet nem vonható vissza.`}
        confirmLabel={`Törlés (${selectedCampaigns.size})`}
        cancelLabel="Mégse"
        destructive
        busy={campaignBulkDeleteBusy}
        onConfirm={bulkDeleteCampaigns}
        onCancel={() => setCampaignBulkDeleteOpen(false)}
      />

      <PopupModal
        open={!!recipientsView}
        onClose={() => setRecipientsView(null)}
        title="Kiknek ment ki"
        subtitle={recipientsView?.campaign.subject}
      >
        {recipientsView?.loading ? (
          <p className="py-6 text-center text-[13px] text-ink-soft">Betöltés…</p>
        ) : recipientsView?.recipients.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-soft">Nincs adat a címzettekről.</p>
        ) : (
          <div className="space-y-1">
            {recipientsView?.recipients.map((r) => (
              <div key={r.email} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2 hover:bg-paper">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink">{r.name || r.email}</p>
                  {r.name && <p className="truncate text-[12px] text-ink-soft2">{r.email}</p>}
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em]',
                    r.status === 'opened' || r.status === 'clicked' ? 'bg-gold/25 text-ink' : r.status === 'bounced' || r.status === 'failed' ? 'bg-[#C0392B]/15 text-[#C0392B]' : 'bg-paper text-ink-soft',
                  )}
                >
                  {r.status === 'opened' ? 'Megnyitva' : r.status === 'clicked' ? 'Rákattintott' : r.status === 'bounced' ? 'Visszapattant' : r.status === 'failed' ? 'Sikertelen' : r.status === 'delivered' ? 'Kézbesítve' : 'Elküldve'}
                </span>
              </div>
            ))}
          </div>
        )}
      </PopupModal>
    </>
  )
}
