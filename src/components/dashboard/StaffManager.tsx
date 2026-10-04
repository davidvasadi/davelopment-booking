'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { StaffMember, Media, Service } from '@/payload/payload-types'
import { fixMediaUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, CalendarDays, Trash2, Search, Download, ChevronDown, Check, UserRound } from 'lucide-react'

import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { SocialLinksEditor } from '@/components/settings/SocialLinksEditor'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { PageHeader } from '@/components/ui/page-header'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { HiringOverlay } from '@/components/dashboard/HiringOverlay'
import type { Employee } from '@/components/dashboard/HiringView'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { compressImage } from '@/lib/compressImage'

/** Avatar-monogram háttér-gradiensek — determinisztikusan a névből (referencia hangulata). */
const AVATAR_GRADIENTS = [
  { bg: 'linear-gradient(140deg,#EEBE8A,#DF9F61)', fg: '#5A3A1A' },
  { bg: 'linear-gradient(140deg,#B4C49A,#9DB07E)', fg: '#33401E' },
  { bg: 'linear-gradient(140deg,#D2A6BE,#BE89A6)', fg: '#5A2A45' },
  { bg: 'linear-gradient(140deg,#9FBAD1,#7E9EBE)', fg: '#1E3140' },
  { bg: 'linear-gradient(140deg,#D1C39F,#BEAD7E)', fg: '#40381E' },
]
function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

const INACTIVE_HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.6), rgba(255,255,255,.6) 7px, rgba(190,180,140,.16) 7px, rgba(190,180,140,.16) 14px)'

type StaffStatus = 'active' | 'inactive' | 'invited'

function statusPill(status: StaffStatus): { label: string; bg: string; color: string; border?: string; dot: string } {
  if (status === 'inactive')
    return { label: 'Inaktív', bg: INACTIVE_HATCH, color: '#8A8779', border: '1px solid var(--dav-line)', dot: '#B7B2A4' }
  if (status === 'invited')
    return { label: 'Meghívott', bg: '#EFF3FB', color: '#3B5BB5', dot: '#5B7FD4' }
  return { label: 'Aktív', bg: '#E7F1E9', color: '#3B6B4B', dot: '#4F9E6A' }
}

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  bio: z.string().optional(),
  // Szakember e-mail — ide megy a hozzá rendelt foglalás értesítője (.ics-melléklettel).
  email: z.string().email('Érvénytelen email cím').optional().or(z.literal('')),
  // Pozíció — eddig CSAK a meghívó-flow-n keresztül (Csapat & jogok) lehetett beállítani; a
  // kézzel felvett munkatársaknak (pl. a tulaj saját magának) sosem volt hova beírni, ezért a
  // Munkatársak/Naptár/foglalás-választó mindenhol üresen mutatta a pozíciójukat.
  role_title: z.string().optional(),
  // Személyenkénti foglalási szabályok (szöveg-mező, mentéskor számmá alakítva; üres = alap).
  booking_buffer_minutes: z.string().optional(),
  min_lead_hours: z.string().optional(),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  salonId: string
  initialStaff: StaffMember[]
  supportedLocales?: (Locale | string)[] | null
  /** staffId → idei, nem-lemondott foglalások száma (VALÓS) */
  bookingsById?: Record<string, number>
  /** staffId → szolgáltatás-nevek (tag-ek, VALÓS) */
  servicesById?: Record<string, string[]>
  /** A szalon összes aktív szolgáltatása (service ↔ staff kiosztáshoz) */
  salonServices?: Service[]
  /** A szalon custom szerepkörei (meghívóhoz). Ha üres/hiányzó → nincs role selector. */
  salonRoles?: { id: string; name: string }[]
  /** Azok az email-ek, amelyekre van függőben lévő meghívó (membership status='invited'). */
  invitedEmails?: Set<string>
  /** staffId → átlagértékelés (VALÓS, ha van staffhoz köthető review) */
  ratingById?: Record<string, number>
  /** összes idei, nem-lemondott foglalás */
  totalBookings?: number
  /** teljes szalon átlagértékelés vagy null */
  avgRating?: number | null
  /** staffId → közelgő műszak címkéje (VALÓS, Shifts-ből) vagy hiányzik → „—" */
  upcomingShiftById?: Record<string, string>
  /** staffId → szabad napok száma az aktuális hónapban */
  freeDaysById?: Record<string, number>
  /** VALÓS munkatárs-adatlap adat (HiringView overlay); ha nincs, a HiringView mock-ot mutat */
  employees?: Employee[]
  /** A szalon tulajdonosa (Users collection) — külön sor a tábla tetején. */
  ownerUser?: { name?: string | null; email?: string | null; avatar_url?: string | null; join_date?: string | null; createdAt?: string | null; role_title?: string | null } | null
  /** A tulajdonos User-id-je — ha van hozzá linkelt (`Staff.user`) rekord, azt jelöljük
   *  "Tulajdonos" jelvénnyel a listában a duplikált szintetikus sor helyett. A linkelés maga
   *  automatikus (regisztrációkor jön létre), itt nincs kézi kapcsoló hozzá. */
  ownerUserId?: string | null
  /** email (kisbetűs) → a személy SAJÁT (Users.avatar_url) profilképe — fallback, ha a tulaj
   *  sosem töltött fel külön staff-avatart ennek a tagnak. */
  avatarUrlByEmail?: Record<string, string>
  /** Ha false, az Új munkatárs / Export / Törlés gombok és a checkbox rejtve. */
  canManage?: boolean
  /** MÁSOK fizetésének megtekintése/kezelése az adatlapon (`staff.salary`) — a sajátját ettől
   *  függetlenül mindenki látja (lásd `viewerEmail`), jogosultság nélkül. */
  canViewOthersSalary?: boolean
  /** A bejelentkezett néző e-mailje — az adatlap ez alapján ismeri fel, hogy a megnyitott
   *  profil a sajátja-e (akkor a fizetés jog nélkül is látszik). */
  viewerEmail?: string | null
  /** Egy extra (a beépített kereten felüli) aktív munkatárs havi többlet-díja Ft-ban — az "Új
   *  munkatárs" felületen jelezzük, hogy ez a hozzáadás növeli-e a havidíjat. */
  extraStaffFeeHuf?: number
  /** Hány aktív munkatárs fér bele a csomag alapdíjába (jelenleg 1) — efölött számít az extra díj. */
  includedStaffCount?: number
}

/** A staff-avatar VAGY (ha nincs) a személy saját profilképe email-egyezéssel. */
function avatarUrl(m: StaffMember, avatarUrlByEmail?: Record<string, string>): string | null {
  if (m.avatar && typeof m.avatar === 'object') return fixMediaUrl((m.avatar as Media).url) ?? null
  const email = (m.email ?? '').toLowerCase()
  return email ? (avatarUrlByEmail?.[email] ?? null) : null
}

/** Első sor a bio-ból → „szerep” alcím a kártyán (a Crextio-referencia mintájára). */
function roleLine(bio?: string | null): string | null {
  if (!bio) return null
  const first = bio.split('\n')[0].trim()
  if (!first) return null
  return first.length > 60 ? `${first.slice(0, 57)}…` : first
}

export default function StaffManager({
  salonId,
  initialStaff,
  salonServices = [],
  salonRoles = [],
  invitedEmails,
  supportedLocales,
  upcomingShiftById = {},
  freeDaysById = {},
  employees,
  ownerUser,
  ownerUserId,
  avatarUrlByEmail,
  canManage = false,
  canViewOthersSalary = false,
  viewerEmail = null,
  extraStaffFeeHuf = 0,
  includedStaffCount = 1,
}: Props) {
  const router = useRouter()

  // SSE / router.refresh() után a szerver új prop-okat ad — szinkronizáljuk a lokális state-et.
  // A staff-listás szerkesztő (`open`) modal esetén ez még indokolt védelem (ne szakítsuk félbe a
  // beviteli űrlapot) — az `empList`-et viszont MINDIG frissítjük, NYITOTT overlay esetén is: a
  // Munkavállalók-adatlap belső Naptár-widgetje pont AKKOR ment (elérhetőség-kivétel), amikor az
  // overlay nyitva van, és a router.refresh() utáni friss `calendar`-adatnak el KELL jutnia hozzá,
  // különben a mentés láthatatlan marad a felületen (a szerveren és a külső foglalón már stimmel).
  useEffect(() => { if (!open) setStaff(initialStaff) }, [initialStaff]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEmpList(employees ?? []) }, [employees])

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [posFilter, setPosFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Sorra kattintva nyílik a Munkavállalók-adatlap overlay (a kattintott sor indexével előre-kiválasztva).
  const [hiringIndex, setHiringIndex] = useState<number | null>(null)
  const [staff, setStaff] = useState(initialStaff)
  const [empList, setEmpList] = useState<Employee[]>(employees ?? [])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Nyelvkészlet a szalon supported_locales-éből (HU mindig benne). A bio localizált mező —
  // szerkesztéskor nyelvenként vihető be a `?locale=` paraméterrel.
  const availableLocales = resolveAvailableLocales(supportedLocales)
  const [editLocale, setEditLocale] = useState<Locale>('hu')
  const [localeLoading, setLocaleLoading] = useState(false)

  const [avatarId, setAvatarId] = useState<number | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModified, setAvatarModified] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [socialLinks, setSocialLinks] = useState<string[]>([])

  const [openCalendar, setOpenCalendar] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true },
  })
  const activeWatch = watch('is_active')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')

  const openAdd = () => {
    reset({ name: '', bio: '', email: '', role_title: '', booking_buffer_minutes: '', min_lead_hours: '', is_active: true })
    setEditing(null)
    setEditLocale('hu')
    setAvatarId(null)
    setAvatarPreview(null)
    setAvatarModified(false)
    setSocialLinks([])
    setSelectedServiceIds([])
    // "— Szerepkör nélkül —" a valódi alapértelmezett — korábban itt hibásan az ELSŐ elérhető
    // szerepre állt, így ha valaki nem figyelt oda, minden új munkatárs AUTOMATIKUSAN megkapta
    // az első szerepet, anélkül hogy ezt szándékosan választotta volna.
    setSelectedRoleId('')
    setOpen(true)
  }

  // Mobilon az "Új munkatárs"/"Export" a fejléc csengő melletti ikonjaiból nyílik (DashboardNav
  // dispatch-eli) — a gombok maguk a toolbarból mobilon rejtve, ld. lent.
  useEffect(() => {
    const handleAdd = () => { if (canManage) openAdd() }
    const handleExport = () => { if (canManage) window.print() }
    window.addEventListener('davelopment:open-staff-add', handleAdd)
    window.addEventListener('davelopment:staff-export', handleExport)
    return () => {
      window.removeEventListener('davelopment:open-staff-add', handleAdd)
      window.removeEventListener('davelopment:staff-export', handleExport)
    }
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (m: StaffMember) => {
    reset({ name: m.name, bio: m.bio ?? '', email: m.email ?? '', role_title: m.role_title ?? '', booking_buffer_minutes: m.booking_buffer_minutes != null ? String(m.booking_buffer_minutes) : '', min_lead_hours: m.min_lead_hours != null ? String(m.min_lead_hours) : '', is_active: m.is_active ?? true })
    setEditing(m)
    setEditLocale('hu')
    const url = avatarUrl(m, avatarUrlByEmail)
    setAvatarPreview(url)
    const media = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media) : null
    setAvatarId(media ? Number(media.id) : null)
    setAvatarModified(false)
    setSocialLinks((m.social_links ?? []).map((s) => s.url))
    // Előre-töltjük: mely szolgáltatásokban szerepel ez a munkatárs
    setSelectedServiceIds(
      salonServices
        .filter(s => (s.staff ?? []).some(sm => String(sm) === String(m.id)))
        .map(s => String(s.id))
    )
    setOpen(true)
  }

  // Szerkesztési nyelv váltása. HU-ra váltva az alap (editing) bio tér vissza; más nyelvre
  // lekérdezzük az adott nyelvi tartalmat (üres → a mező üres, HU fallback érvényes a foglalón).
  const selectEditLocale = async (loc: Locale) => {
    if (loc === editLocale) return
    if (loc === 'hu') {
      setEditLocale('hu')
      setValue('bio', editing?.bio ?? '')
      return
    }
    if (!editing) return
    setLocaleLoading(true)
    try {
      const res = await fetch(`/api/staff/${editing.id}?locale=${loc}&fallback-locale=null&depth=0`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      setEditLocale(loc)
      setValue('bio', doc.bio ?? '')
    } catch {
      toast.error('A nyelvi tartalom betöltése sikertelen')
    } finally {
      setLocaleLoading(false)
    }
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarPreview(URL.createObjectURL(file))
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: 'Staff avatar' }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      const json = await res.json()
      setAvatarId(json.doc.id)
      setAvatarPreview(json.doc.url)
      setAvatarModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setAvatarPreview(null)
      setAvatarId(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    if (avatarId) {
      await fetch(`/api/media/${avatarId}`, { method: 'DELETE', credentials: 'include' })
    }
    setAvatarPreview(null)
    setAvatarId(null)
    setAvatarModified(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      // Idegen nyelv szerkesztése: csak a localizált bio-t PATCH-eljük az adott nyelvre.
      if (editLocale !== 'hu' && editing) {
        const res = await fetch(`/api/staff/${editing.id}?locale=${editLocale}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ bio: data.bio || null }),
        })
        if (!res.ok) throw new Error()
        setOpen(false)
        toast.success('Fordítás mentve')
        return
      }

      const body: Record<string, unknown> = { ...data, salon: salonId }
      const toNum = (v: string | undefined, max: number): number | null => {
        const n = Number(String(v ?? '').replace(',', '.'))
        return String(v ?? '').trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.min(n, max)
      }
      body.booking_buffer_minutes = toNum(data.booking_buffer_minutes, 240)
      body.min_lead_hours = toNum(data.min_lead_hours, 720)
      body.social_links = socialLinks.filter((u) => u.trim()).map((url) => ({ url }))
      if (avatarModified) body.avatar = avatarId ?? null
      else if (avatarId) body.avatar = avatarId
      // Szerepkör: csak új munkatársnál, ha van kiválasztva (a membership-hez, nem a staff rekordhoz)
      if (!editing && selectedRoleId) body.custom_role = selectedRoleId
      const url = editing ? `/api/staff/${editing.id}` : '/api/staff'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      // A /api/staff route a doc-ot KÖZVETLENÜL adja vissza (nem { doc }-ba csomagolva) —
      // mindkét alakot kezeljük, és sose engedünk érvénytelen elemet a listába (különben a
      // toDelete `.find` undefined-en hasal el).
      const saved: StaffMember = (json?.doc ?? json) as StaffMember
      if (!saved?.id) throw new Error('Érvénytelen szerver-válasz')
      setStaff(prev => editing ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved])

      // Szolgáltatás-hozzárendelés frissítése: minden érintett service staff tömbjét PATCH-eljük.
      if (salonServices.length > 0) {
        const staffId = String(saved.id)
        await Promise.allSettled(
          salonServices.map(async (s) => {
            const currentIds = (s.staff ?? []).map(sm => String(sm))
            const shouldBeIn = selectedServiceIds.includes(String(s.id))
            const isIn = currentIds.includes(staffId)
            if (shouldBeIn === isIn) return
            const nextStaff = shouldBeIn
              ? [...currentIds, staffId].map(Number)
              : currentIds.filter(id => id !== staffId).map(Number)
            await fetch(`/api/services/${s.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ staff: nextStaff }),
            })
          })
        )
      }

      setOpen(false)
      toast.success(editing ? 'Frissítve' : 'Munkatárs hozzáadva')
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  // Törlés — SAJÁT megerősítő modal (nem a natív böngésző-confirm).
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toDelete = staff.find((m) => String(m.id) === deleteId) ?? null

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/staff/${deleteId}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Hiba történt')
      }
      setStaff((prev) => prev.filter((m) => String(m.id) !== deleteId))
      // Ha a törölt sor épp ki volt jelölve (checkbox), a kijelölésből is ki kell venni —
      // különben a fejléc "Kijelöltek törlése" gombja beragadva ott marad egy már nem
      // létező id-re mutatva.
      setSelected((prev) => { if (!prev.has(deleteId)) return prev; const next = new Set(prev); next.delete(deleteId); return next })
      toast.success('Törölve')
      setDeleteId(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setDeleting(false)
    }
  }

  // ── Tömeges törlés: a kijelölt munkatársak egyben ──
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  async function confirmBulkDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0) { setBulkOpen(false); return }
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' })),
      )
      const okIds = ids.filter((id, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
      setStaff((prev) => prev.filter((m) => !okIds.includes(String(m.id))))
      setSelected(new Set())
      setBulkOpen(false)
      if (okIds.length < ids.length) {
        const failedRes = results.find((r) => r.status === 'fulfilled' && !(r as PromiseFulfilledResult<Response>).value.ok) as PromiseFulfilledResult<Response> | undefined
        const firstError = failedRes ? await failedRes.value.json().catch(() => null) : null
        toast.error(`${ids.length - okIds.length} törlése nem sikerült${firstError?.error ? ` — ${firstError.error}` : ''}`)
      } else {
        toast.success(`${okIds.length} munkatárs törölve`)
      }
      router.refresh()
    } finally {
      setBulkBusy(false)
    }
  }

  // Foglalható-toggle a kártyán: a MEGLÉVŐ is_active mezőt PATCH-eli (nincs séma-változás).
  const toggleActive = async (m: StaffMember) => {
    const next = m.is_active === false
    setTogglingId(String(m.id))
    setStaff(prev => prev.map(x => x.id === m.id ? { ...x, is_active: next } : x))
    try {
      const res = await fetch(`/api/staff/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setStaff(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !next } : x))
      toast.error('A foglalhatóság módosítása sikertelen')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Stat-csík értékek (VALÓS) ──
  const activeCount = staff.filter((m) => m.is_active !== false).length
  const totalCount = staff.length
  const utilization = totalCount ? Math.round((activeCount / totalCount) * 100) : 0
  const onLeaveCount = totalCount - activeCount
  const now = new Date()
  const newJoiners = staff.filter((m) => {
    if (!m.join_date) return false
    const d = new Date(m.join_date)
    return (now.getTime() - d.getTime()) / 86400000 <= 90
  }).length
  const onLeavePct = totalCount ? Math.round((onLeaveCount / totalCount) * 100) : 0
  const newJoinersPct = totalCount ? Math.round((newJoiners / totalCount) * 100) : 0

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
  const positions = Array.from(new Set(staff.map((m) => (m.role_title ?? '').trim()).filter(Boolean)))
  const filtered = staff.filter((m) => {
    if (statusFilter === 'active' && m.is_active === false) return false
    if (statusFilter === 'inactive' && m.is_active !== false) return false
    if (posFilter !== 'all' && (m.role_title ?? '') !== posFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.role_title ?? '').toLowerCase().includes(q)
  })
  // Ha a tulaj már LINKELVE van egy valódi (foglalható) staff-rekordhoz, azt a rekordot magát
  // jelöljük "Tulajdonos" jelvénnyel a listában — a felül lévő szintetikus "Tulajdonos sor"
  // (ami a User-fiók mezőiből épül, NEM foglalható) ilyenkor felesleges duplikátum, elrejtjük.
  const linkedOwnerStaffId = ownerUserId
    ? staff.find((m) => m.user && (typeof m.user === 'object' ? String((m.user as { id: string | number }).id) : String(m.user)) === String(ownerUserId))?.id ?? null
    : null
  const showSyntheticOwnerRow = !!ownerUser && linkedOwnerStaffId == null

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const GRID = 'grid-cols-[34px_1.7fr_1.2fr_1.1fr_0.85fr_140px]'

  return (
    <>
      {/* ── HEADER: cím felül → alatta a TELJES-SZÉLESSÉGŰ státusz-csík (bal) + 3 nagy szám (jobb) — 1:1 az Áttekintésről ── */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Csapat"
          title="Munkatársak"
          description="A csapat tagjai, bemutatkozásuk és foglalhatóságuk"
        />
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Foglalható', pct: utilization, value: activeCount, suffix: ' fő', background: '#1D1C19', color: '#fff' },
              { label: 'Szabadságon', pct: onLeavePct, value: onLeaveCount, suffix: ' fő', background: '#F1CE45', color: '#1D1C19' },
              { label: 'Új belépő', pct: newJoinersPct, value: newJoiners, suffix: ' fő', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="users" value={totalCount} label="Munkatárs" />
            <CountUpKpi icon="clock" value={activeCount} label="Ma dolgozik" />
            <CountUpKpi icon="gauge" value={utilization} label="Kihasználtság" suffix="%" />
          </div>
        </div>
      </div>

      {/* ── MAPPA-FÜL kártya (davelopment App 67–75): NORMÁL folyású fül + homorú notch-ív (nem takarja a stat-csíkot) ── */}
      <div className="relative">
        {/* Fül: szűrők + kereső — a kártya bal-felső sarkára ül, jobbra homorú ív köti a kártyához */}
        <div className="relative z-10 flex h-[48px] w-fit max-w-[600px] items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:w-full sm:px-6">
          {/* Szűrő: állapot */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Minden állapot</option>
              <option value="active">Aktív</option>
              <option value="inactive">Inaktív</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          {/* Szűrő: pozíció (ha van adat) */}
          {positions.length > 0 && (
            <div className="relative hidden shrink-0 md:block">
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
              >
                <option value="all">Minden pozíció</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            </div>
          )}
          {/* Kereső — kisebb szélesség mobilon */}
          <div className="flex w-[140px] sm:min-w-[110px] sm:flex-1 items-center gap-2.5 rounded-[18px] bg-white px-3 py-2 sm:px-4 shadow-[0_1px_4px_rgba(70,60,20,.06)]">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
            />
          </div>
          {/* Homorú ív a fül jobb végén */}
          <span
            className="pointer-events-none absolute -right-[24px] bottom-0 h-[24px] w-[24px]"
            style={{ background: 'radial-gradient(circle at top right, transparent 23px, rgba(255,255,255,.62) 23.5px)' }}
          />
        </div>

        <div className="rounded-b-[28px] rounded-tr-[28px] bg-[rgba(255,255,255,.9)] p-5 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[18px] sm:p-6">
          {/* Akció-sor */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={openAdd}
                className="hidden h-[38px] items-center gap-2 rounded-[18px] bg-ink-dark px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-ink lg:flex"
              >
                <Plus className="h-[15px] w-[15px]" strokeWidth={2} /> Új munkatárs
              </button>
              <button
                onClick={() => window.print()}
                className="hidden h-[38px] items-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper lg:flex"
              >
                <Download className="h-[15px] w-[15px]" strokeWidth={1.7} /> Export
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => setBulkOpen(true)}
                  className="flex h-[38px] items-center gap-2 rounded-[18px] bg-[#C0392B] px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-[#a93226]"
                >
                  <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} /> Kijelöltek törlése ({selected.size})
                </button>
              )}
            </div>
          )}

          {/* Fejléc-sor (desktop) */}
          <div className={`mt-4 hidden ${GRID} items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid`}>
            <div />
            <div>Név</div>
            <div>Pozíció</div>
            <div>Belépés</div>
            <div>Szabad nap</div>
            <div>Státusz</div>
          </div>

          {/* Tulajdonos sor — csak akkor, ha a tulaj MÉG NINCS linkelve valódi staff-rekordhoz
              (lásd `showSyntheticOwnerRow`); ha van, az a rekord kapja a "Tulajdonos" jelvényt
              lent a listában, nem duplikáljuk. */}
          {showSyntheticOwnerRow && (
            <div
              onClick={() => { const oi = empList.findIndex(e => e.id === 'owner'); setHiringIndex(oi >= 0 ? oi : 0) }}
              role="button"
              title="Adatlap megnyitása"
              className="mt-2 cursor-pointer rounded-[18px] transition-all hover:bg-gold/10"
            >
              {/* DESKTOP */}
              <div className={`hidden ${GRID} items-center gap-3.5 px-3.5 py-2.5 lg:grid`}>
                <div />
                <div className="flex min-w-0 items-center gap-3">
                  {fixMediaUrl(ownerUser.avatar_url) ? (
                    <img src={fixMediaUrl(ownerUser.avatar_url) ?? undefined} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover object-top" />
                  ) : (
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                      <UserRound className="h-5 w-5 text-white/30" strokeWidth={1.2} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{ownerUser.name ?? 'Tulajdonos'}</p>
                    {ownerUser.email && <p className="truncate text-[12px] font-medium text-ink-soft">{ownerUser.email}</p>}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex shrink-0 rounded-[9px] bg-ink-dark px-2.5 py-[5px] text-[12px] font-semibold text-gold">Tulajdonos</span>
                  {ownerUser.role_title && <span className="truncate text-[13.5px] font-medium text-ink">{ownerUser.role_title}</span>}
                </div>
                <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(ownerUser.join_date ?? ownerUser.createdAt)}</div>
                <div className="text-[13.5px] font-medium text-ink-soft">—</div>
                <div className="relative flex items-center gap-1.5">
                  {(() => { const sp = statusPill('active'); return (
                    <span className="inline-flex cursor-default items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold" style={{ background: sp.bg, color: sp.color, border: sp.border }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: sp.dot }} />
                      {sp.label}
                    </span>
                  ) })()}
                  <button onClick={(e) => { e.stopPropagation(); const oi = empList.findIndex(e2 => e2.id === 'owner'); setHiringIndex(oi >= 0 ? oi : 0); setOpenCalendar(true) }} title="Elérhetőség" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><CalendarDays className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>
                </div>
              </div>
              {/* MOBIL */}
              <div className="flex items-center gap-3 px-3.5 py-3 lg:hidden">
                {canManage && <div className="h-[18px] w-[18px] shrink-0" />}
                {fixMediaUrl(ownerUser.avatar_url) ? (
                  <img src={fixMediaUrl(ownerUser.avatar_url) ?? undefined} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                    <UserRound className="h-6 w-6 text-white/30" strokeWidth={1.2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{ownerUser.name ?? 'Tulajdonos'}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-[7px] bg-ink-dark px-2 py-[3px] text-[11px] font-semibold text-gold">Tulajdonos</span>
                    {ownerUser.role_title && <span className="truncate text-[12.5px] font-medium text-ink-soft">{ownerUser.role_title}</span>}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); const oi = empList.findIndex(e2 => e2.id === 'owner'); setHiringIndex(oi >= 0 ? oi : 0); setOpenCalendar(true) }} title="Elérhetőség" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><CalendarDays className="h-[15px] w-[15px]" strokeWidth={1.6} /></button>
              </div>
            </div>
          )}

          {/* Sorok */}
          {filtered.length === 0 && !showSyntheticOwnerRow && (
            <p className="py-10 text-center text-sm text-ink-soft">Nincs találat.</p>
          )}
          {filtered.length === 0 && showSyntheticOwnerRow && (
            <p className="py-6 text-center text-sm text-ink-soft">Nincs más munkatárs.</p>
          )}
          {filtered.map((m, idx) => {
            const url = avatarUrl(m, avatarUrlByEmail)
            const isInvited = invitedEmails?.has((m.email ?? '').toLowerCase()) ?? false
            const staffStatus: StaffStatus = isInvited ? 'invited' : m.is_active !== false ? 'active' : 'inactive'
            const sp = statusPill(staffStatus)
            const inactive = staffStatus === 'inactive'
            const grad = gradientFor(m.name)
            const isToggling = togglingId === String(m.id)
            const isSel = selected.has(String(m.id))
            const position = m.role_title || roleLine(m.bio) || '—'
            const canToggle = canManage && !isInvited
            const isOwnerRow = linkedOwnerStaffId != null && String(m.id) === String(linkedOwnerStaffId)
            return (
              <div
                key={m.id}
                onClick={() => { const ei = empList.findIndex(e => String(e.id) === String(m.id)); setHiringIndex(ei >= 0 ? ei : showSyntheticOwnerRow ? idx + 1 : idx) }}
                role="button"
                title="Adatlap megnyitása"
                style={isSel ? { background: 'var(--dav-accent)' } : inactive ? { background: INACTIVE_HATCH } : undefined}
                className={`mt-2 cursor-pointer rounded-[18px] transition-all ${
                  isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : inactive ? 'ring-1 ring-line' : 'hover:bg-gold/10'
                }`}
              >
                {/* DESKTOP grid-sor */}
                <div className={`hidden ${GRID} items-center gap-3.5 px-3.5 py-2.5 lg:grid`}>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(String(m.id)) }}
                      aria-pressed={isSel}
                      aria-label="Kijelölés"
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                    >
                      {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: url ? grad.bg : 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={m.name} className="h-full w-full object-cover object-top" />
                      ) : (
                        <UserRound className="h-5 w-5 text-white/30" strokeWidth={1.2} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-[14.5px] font-semibold ${inactive ? 'text-ink-soft line-through' : 'text-ink'}`}>{m.name}</p>
                      {m.email && <p className="truncate text-[12px] font-medium text-ink-soft">{m.email}</p>}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    {isOwnerRow && <span className="inline-flex shrink-0 rounded-[9px] bg-ink-dark px-2 py-[3px] text-[11px] font-semibold text-gold">Tulajdonos</span>}
                    <span className="truncate text-[13.5px] font-medium text-ink">{position}</span>
                  </div>
                  <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(m.join_date)}</div>
                  <div>
                    {freeDaysById[String(m.id)] != null ? (
                      <span className="inline-flex items-center gap-1 rounded-[10px] bg-[#F4F2EC] px-2.5 py-1 text-[12.5px] font-semibold text-ink">
                        {freeDaysById[String(m.id)]} nap
                      </span>
                    ) : <span className="text-[13px] text-ink-soft2">—</span>}
                  </div>
                  <div className="relative flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canToggle || isToggling}
                      onClick={(e) => { e.stopPropagation(); if (canToggle) setStatusMenuId(statusMenuId === String(m.id) ? null : String(m.id)) }}
                      className={`inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold disabled:opacity-60 ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ background: sp.bg, color: sp.color, border: sp.border }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: sp.dot }} />
                      {sp.label}
                      {canToggle && <ChevronDown className="h-3 w-3 opacity-60" />}
                    </button>
                    {canToggle && statusMenuId === String(m.id) && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusMenuId(null) }} />
                        <div className="absolute right-0 top-[36px] z-20 w-40 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                          {(['active', 'inactive'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setStatusMenuId(null)
                                if (s !== staffStatus) toggleActive(m)
                              }}
                              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: s === 'inactive' ? '#B7B2A4' : '#4F9E6A' }} />
                              {s === 'inactive' ? 'Inaktív' : 'Aktív'}
                              {staffStatus === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); const empIdx = employees?.findIndex(emp => String(emp.id) === String(m.id)) ?? -1; setHiringIndex(empIdx >= 0 ? empIdx : idx); setOpenCalendar(true) }} title="Elérhetőség" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><CalendarDays className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>
                    {canManage && <button onClick={(e) => { e.stopPropagation(); setDeleteId(String(m.id)) }} title="Törlés" className="flex h-8 w-8 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-white"><Trash2 className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>}
                  </div>
                </div>

                {/* MOBIL kártya-stack */}
                <div className="flex items-center gap-3 px-3.5 py-3 lg:hidden">
                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(String(m.id)) }}
                      aria-pressed={isSel}
                      aria-label="Kijelölés"
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}
                    >
                      {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                    </button>
                  )}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: url ? grad.bg : 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={m.name} className="h-full w-full object-cover object-top" />
                    ) : (
                      <UserRound className="h-6 w-6 text-white/30" strokeWidth={1.2} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {isOwnerRow && <span className="inline-flex rounded-[7px] bg-ink-dark px-2 py-[3px] text-[11px] font-semibold text-gold">Tulajdonos</span>}
                      <span className="truncate text-[12.5px] font-medium text-ink-soft">{position}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); const empIdx = employees?.findIndex(emp => String(emp.id) === String(m.id)) ?? -1; setHiringIndex(empIdx >= 0 ? empIdx : idx); setOpenCalendar(true) }} title="Elérhetőség" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><CalendarDays className="h-[15px] w-[15px]" strokeWidth={1.6} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / Add — oldalsáv */}
      <Sheet open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <SheetContent side="right" className="w-full max-w-[440px] overflow-y-auto p-0">
          <SheetHeader className="border-b border-line px-6 py-5">
            <SheetTitle className="text-[17px] font-bold text-ink">
              {editing ? 'Munkatárs szerkesztése' : 'Új munkatárs'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-5">

            {editing && availableLocales.length > 1 && (
              <LocaleEditBar
                available={availableLocales}
                active={editLocale}
                onSelect={selectEditLocale}
                loading={localeLoading}
              />
            )}

            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Név *</Label>
              <Input className="h-11 rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            )}
            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email <span className="font-normal text-ink-soft2">(a foglalás-értesítőkhöz)</span></Label>
              <Input type="email" className="h-11 rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('email')} placeholder="szakember@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            )}
            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Pozíció</Label>
              <Input className="h-11 rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('role_title')} placeholder="Műszakvezető · Stylist" />
            </div>
            )}
            {editLocale === 'hu' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Szünet foglalások között <span className="font-normal text-ink-soft2">(perc)</span></Label>
                <Input type="number" inputMode="numeric" min={0} max={240} className="h-11 rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('booking_buffer_minutes')} placeholder="Szalon alapja" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Minimum foglalás előre <span className="font-normal text-ink-soft2">(óra)</span></Label>
                <Input type="number" inputMode="decimal" min={0} max={720} step={0.5} className="h-11 rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('min_lead_hours')} placeholder="Nincs korlát" />
              </div>
              <p className="text-[11.5px] text-ink-soft2 sm:col-span-2">Üresen hagyva a szalon alapbeállítása érvényes. A minimum idő csak az online foglalást korlátozza, a te kézi foglalásodat nem.</p>
            </div>
            )}
            {editLocale === 'hu' && !editing && salonRoles.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Szerepkör <span className="font-normal text-ink-soft2">(Csapat & jogokban is megjelenik)</span></Label>
              <div className="relative">
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-line-strong bg-white px-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
                >
                  <option value="">— Szerepkör nélkül —</option>
                  {salonRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              </div>
            </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Bemutatkozás</Label>
              <Textarea className="rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2" {...register('bio')} rows={3} placeholder={editLocale !== 'hu' ? (editing?.bio ?? '') : undefined} />
            </div>
            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Közösségi linkek</Label>
              <SocialLinksEditor
                value={socialLinks}
                onChange={setSocialLinks}
                inputClassName="rounded-xl bg-white border-line-strong text-ink placeholder:text-ink-soft2"
              />
            </div>
            )}
            {editLocale === 'hu' && (
            <label htmlFor="staff_active" className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3.5 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-ink">Aktív</span>
                <span className="mt-0.5 block text-xs text-ink-soft">Foglalható a foglaló oldalon</span>
              </span>
              <span className="relative inline-flex">
                <input type="checkbox" id="staff_active" className="peer sr-only" {...register('is_active')} />
                <span className={`h-[26px] w-[46px] rounded-full transition-colors ${activeWatch ? 'bg-ink-dark' : 'bg-line-strong'}`} />
                <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${activeWatch ? 'left-[23px]' : 'left-[3px]'}`} />
              </span>
            </label>
            )}
            {editLocale === 'hu' && !editing && activeWatch && activeCount >= includedStaffCount && extraStaffFeeHuf > 0 && (
              <p className="rounded-xl border border-gold/40 bg-warn-bg px-4 py-3 text-[12.5px] text-warn">
                Ez a munkatárs aktívként +{extraStaffFeeHuf.toLocaleString('hu-HU')} Ft-tal növeli a havidíjadat (az első munkatárs benne van az alapdíjban, minden további fő külön díjköteles).
              </p>
            )}
            {editLocale === 'hu' && salonServices.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Szolgáltatások <span className="font-normal text-ink-soft2">(melyeket elvégez)</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {salonServices.map(s => {
                    const sel = selectedServiceIds.includes(String(s.id))
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedServiceIds(prev =>
                          sel ? prev.filter(id => id !== String(s.id)) : [...prev, String(s.id)]
                        )}
                        className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-all"
                        style={{
                          background: sel ? '#1D1C19' : 'transparent',
                          color: sel ? '#fff' : '#57564f',
                          border: `1px solid ${sel ? '#1D1C19' : '#d9d4c5'}`,
                        }}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-ink-soft2">Ha nincs kiválasztva, az összes aktív szolgáltatásnál megjelenik</p>
              </div>
            )}
            {editing && editLocale === 'hu' && (
              <button
                type="button"
                onClick={() => { setOpen(false); const empIdx = employees?.findIndex(emp => String(emp.id) === String(editing!.id)) ?? -1; setHiringIndex(empIdx >= 0 ? empIdx : staff.findIndex(s => s.id === editing!.id)); setOpenCalendar(true) }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-paper px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-white"
              >
                <CalendarDays className="h-4 w-4 text-ink-soft" strokeWidth={1.6} />
                Elérhetőség naptár szerkesztése
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || uploadingAvatar}
              className="w-full h-12 rounded-dav-pill bg-ink-dark hover:bg-ink text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mentés...' : editLocale !== 'hu' ? 'Fordítás mentése' : 'Mentés'}
            </button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Törlés megerősítő modal (natív confirm helyett) */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Munkatárs törlése"
        description={toDelete ? `Biztosan törlöd: ${toDelete.name}? A művelet nem vonható vissza.` : 'Biztosan törlöd ezt a munkatársat?'}
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkOpen}
        title="Kijelöltek törlése"
        description={`Biztosan törlöd a kijelölt ${selected.size} munkatársat? A művelet nem vonható vissza.`}
        confirmLabel={`Törlés (${selected.size})`}
        cancelLabel="Mégse"
        destructive
        busy={bulkBusy}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkOpen(false)}
      />

      {/* Munkavállalók-adatlap overlay — a listasorra kattintva nyílik */}
      <HiringOverlay
        open={hiringIndex !== null}
        onClose={() => { setHiringIndex(null); setOpenCalendar(false) }}
        variant="salon"
        employees={empList}
        positions={salonRoles.map(r => ({ label: r.name, level: 'staff' as const }))}
        initialIndex={hiringIndex ?? 0}
        salonId={salonId}
        openCalendar={openCalendar}
        canManage={canManage}
        canEditSalary={canViewOthersSalary}
        viewerEmail={viewerEmail}
        onProfileChange={(id, patch) =>
          setEmpList(prev => prev.map(e => e.id === id ? { ...e, ...patch, hr: { ...e.hr, ...(patch.hr ?? {}) } } : e))
        }
      />
    </>
  )
}
