'use client'

import { sortRows, useTableSort } from '@/lib/tableSort'
import { useEffect, useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Download, FileText, MoreHorizontal, Pencil, Plus, Send, ShieldCheck, Trash2, UserCog, UserRound, Users, X, type LucideIcon } from 'lucide-react'
import { Button, Card, Checkbox, EmptyState, FIELD, IconButton, IconCircle, Menu, MenuItem, Meta, Note, PageHead, SegmentBar, SearchField, Select, OptionCard } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { Popup } from '@/components/shared/Popup'
import { InviteFlow } from '@/components/dashboard/InviteFlow'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { ChipToolbar } from '@/components/blocks/toolbar'
import { SaveBar } from '@/components/blocks/settings'
import { StaffProfile } from '@/components/blocks/calendar'
import {
  InfoRow, StaffExportModal, TEAM_EXPORT_DEFAULT, MobileStaffList, STAFF_TOPICS, StaffAccordion, StaffBulkBar, StaffEditNav, StaffEditSections, StaffHoursCard, StaffListCard, StaffPhoto, StaffSummary, StaffTable, TOPIC_CARDS, TipPill,
  type StaffCardRow, type StaffEditValue, type StaffTableRow,
} from '@/components/blocks/team'
import { employeesCsv, downloadCsv, todayStamp } from '@/lib/csv'
import { uploadMedia } from '@/lib/uploadMedia'
import type { UploadState } from '@/components/blocks/upload'
import { MONTHS_SHORT } from '@/lib/schedule'
import type { Locale } from '@/lib/i18n'
import type { TeamMemberVM, TeamRoleOption, TeamStatus } from '@/lib/teamTypes'
import { StaffInvoicingPanel } from './StaffInvoicingPanel'

interface Props {
  restaurant?: boolean
  /** a szalonban szakemberenként számláznak — a munkatársnál „Saját számlázás” téma */
  staffInvoicing?: boolean
  businessId: string
  members: TeamMemberVM[]
  /** szalon: a szolgáltatások (a munkatárs foglalási beállításaihoz) */
  services?: { id: string; name: string }[]
  /** az üzlet egyedi szerepei (meghívó, szerep-váltás) */
  roles: TeamRoleOption[]
  locales?: Locale[]
  canManage?: boolean
  /** mások bérének megtekintése / szerkesztése (a sajátját mindenki látja) */
  canSalary?: boolean
  /** a néző a tulajdonos (a tulaj-sor szerkesztése) */
  isOwnerViewer?: boolean
  canEditAvailability?: boolean
  viewerEmail?: string | null
  /** szalon: az extra munkatárs havidíja és a csomagban foglalt létszám */
  extraFee?: { fee: number; included: number }
}

const STATUS: Record<TeamStatus, { pill: 'ok' | 'pending' | 'neutral'; label: string }> = {
  active: { pill: 'ok', label: 'Aktív' }, invited: { pill: 'pending', label: 'Meghívott' }, suspended: { pill: 'neutral', label: 'Felfüggesztett' },
}
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const PAGE = 10
/** egészséges heti felső határ: 48 óra (Mt. és az EU munkaidő-irányelve, túlórával együtt) — fölötte piros, alatta zöld */
const HEALTHY_WEEK = 48
/** az ablakok rugós belépője (PopupModal genie) — munkatárs-, nézet- és témaváltáskor */
const POP: Variants = { hidden: { opacity: 0, scale: 0.94, y: 10 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9 } } }
const TOPIC_ICON: Record<string, LucideIcon> = Object.fromEntries(STAFF_TOPICS)
/** a szerkesztő témáinak rövid leírása (a nagy ablak fejlécében) */
const TOPIC_LEAD: Record<string, string> = {
  'Alapadatok': 'Név, elérhetőség, születésnap és belépés — mellette a hivatalos adatok a bérszámfejtéshez.',
  'Munkaidő': 'A heti alap munkaidő: ebből foglalhatnak hozzá, és ebből készül a Naptárban a beosztása.',
  'Foglalás': 'Mit és milyen szabályokkal foglalhatnak hozzá online.',
  'Bér és borravaló': 'Napidíj vagy órabér és a heti óraszám — a havi becslés magától számolódik.',
  'Bemutatkozás': 'A foglalóoldalon a neve alatt jelenik meg — nyelvenként szerkeszthető.',
  'Dokumentumok': 'Szerződés, egészségügyi kiskönyv, igazolások — fotóként, csak a kezelők látják.',
  'Saját számlázás': 'Vállalkozóként a saját nevére számláz: a saját számlázója, adószáma és Stripe-fiókja — a pénz és a számla az övé.',
}
const CARD_PAGE = 4
const huDate = (v: string | null) => { if (!v) return '—'; const [y, m, d] = v.split('-').map(Number); return y && m && d ? `${y}. ${MONTHS_SHORT[m - 1]} ${d}.` : v }
const short = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : String(n)
const json = (body: unknown) => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include' as const, body: JSON.stringify(body) })

/** A szerkesztő kiinduló értéke egy munkatársból. */
const toEdit = (m: TeamMemberVM): StaffEditValue => ({
  name: m.name, position: m.position === 'Tulajdonos' && m.owner ? '' : m.position, phone: m.phone, email: m.email, birthday: m.birthday?.slice(0, 10) ?? '', joinDate: m.joinDate ?? '',
  taxId: m.taxId ?? '', taxNumber: m.taxNumber ?? '', address: m.address ?? '',
  bookable: m.bookable, buffer: m.buffer, minLead: m.minLead, serviceIds: m.serviceIds,
  payType: m.payType, payRate: m.payRate != null ? String(m.payRate) : '', weeklyTarget: m.weeklyTarget, tipEligible: m.tipEligible,
  bio: m.bio, socialLinks: m.socialLinks, hours: null, documents: m.documents,
})

/**
 * Munkatársak (design 10.1–10.6): a lista táblázatban (megoszlás, szűrők, kijelölés + tömeges műveletek, lapozó), egy
 * munkatársra kattintva a nézete (bal lista, közép fotó + lenyíló részek + órák, jobb a fő kártya), a „Szerkesztés”-re
 * a középső és a jobb oszlop helyén a szerkesztő (témák, lebegő mentés). Mobilon egymás alatt, a szerkesztő alulról.
 * Meghívás, szerep-váltás, meghívó újraküldése, felfüggesztés, törlés, export. Szalon és étterem közös (10.6 eltérések).
 */
export function TeamView({ restaurant = false, businessId, members, services = [], roles, locales = ['hu'], canManage = false, canSalary = false, isOwnerViewer = false, canEditAvailability = false, viewerEmail = null, extraFee, staffInvoicing = false }: Props) {
  const router = useRouter()
  const [list, setList] = useState(members)
  useEffect(() => { setList(members) }, [members])

  // ── nézet: lista (10.1) · munkatárs (10.2) · szerkesztés (10.4) ──
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sel = list.find((m) => m.id === openKey) ?? null
  const open = (id: string | null) => { setOpenKey(id); setEdit(null); setAcc(null); setMobileOpen(!!id); window.scrollTo({ top: 0 }) }
  // a Naptárból érkezve (?profil=<id>) rögtön az adott munkatárs nézete nyílik
  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get('profil')
    if (!id) return
    if (members.some((m) => m.id === id)) open(id)
    url.searchParams.delete('profil')
    window.history.replaceState(null, '', url.pathname + url.search)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── szűrés ──
  const [query, setQuery] = useState('')
  // mobil: a fejléc kereső-ikonja nyitja a keresőmezőt (nem áll állandóan a lista fölött)
  const [mobileSearch, setMobileSearch] = useState(false)
  useEffect(() => {
    const on = () => setMobileSearch(true)
    window.addEventListener('davelopment:open-staff-search', on)
    return () => window.removeEventListener('davelopment:open-staff-search', on)
  }, [])
  const [pos, setPos] = useState('all')
  const [status, setStatus] = useState<'all' | TeamStatus | 'review'>('all')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(1)
  const { sort: teamSort, th: teamTh } = useTableSort<string>()
  const [cardPage, setCardPage] = useState(1)
  const positions = useMemo(() => [...new Set(list.map((m) => m.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu')), [list])
  const roleNames = useMemo(() => [...new Set(list.map((m) => m.role).filter((r) => r && r !== '—'))], [list])
  const filtered = list.filter((m) => {
    if (pos !== 'all' && m.position !== pos) return false
    if (status === 'review' ? !m.review : status !== 'all' && m.status !== status) return false
    if (role !== 'all' && m.role !== role) return false
    const q = query.trim().toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.position.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })
  useEffect(() => { setPage(1); setCardPage(1) }, [query, pos, status, role])
  const count = (s: TeamStatus) => list.filter((m) => m.status === s).length
  const reviewN = list.filter((m) => m.review).length

  // ── jogok ──
  const isSelf = (m: TeamMemberVM) => !!viewerEmail && !!m.email && viewerEmail.toLowerCase() === m.email.toLowerCase()
  const canEdit = (m: TeamMemberVM) => (m.id === 'owner' ? isOwnerViewer || (!restaurant && canManage) : canManage)
  const canSeePay = (m: TeamMemberVM) => !m.owner && (canSalary || isSelf(m))

  // ── kijelölés + tömeges műveletek ──
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const selMembers = list.filter((m) => selected.includes(m.id))
  const [busy, setBusy] = useState(false)

  const patchStatus = async (m: TeamMemberVM, next: 'active' | 'suspended') => {
    const res = restaurant
      ? await fetch(`/api/team/members/${m.id}`, json({ status: next }))
      : await fetch(`/api/staff/${m.id}`, json({ is_active: next === 'active' }))
    if (!res.ok) throw new Error()
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, status: next, bookable: restaurant ? x.bookable : next === 'active' } : x)))
  }
  const setStatusOf = async (targets: TeamMemberVM[], next: 'active' | 'suspended') => {
    const ok = targets.filter((m) => !m.owner && m.id !== 'owner' && m.status !== 'invited')
    if (!ok.length) return
    setBusy(true)
    const results = await Promise.allSettled(ok.map((m) => patchStatus(m, next)))
    const failed = results.filter((r) => r.status === 'rejected').length
    setBusy(false)
    if (failed) toast.error(`${failed} módosítása nem sikerült`)
    else toast.success(next === 'suspended' ? (ok.length > 1 ? `${ok.length} munkatárs felfüggesztve` : 'Felfüggesztve') : 'Visszaállítva aktívra')
    router.refresh()
  }
  const resend = async (targets: TeamMemberVM[]) => {
    const ok = targets.filter((m) => m.status === 'invited' && m.membershipId)
    if (!ok.length) { toast.error('A kijelöltek közt nincs függő meghívó'); return }
    setBusy(true)
    const results = await Promise.allSettled(ok.map((m) => fetch(`/api/team/members/${m.membershipId}/resend`, { method: 'POST', credentials: 'include' }).then((r) => { if (!r.ok) throw new Error() })))
    setBusy(false)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${failed} meghívó küldése nem sikerült`)
    else toast.success(ok.length > 1 ? `${ok.length} meghívó újraküldve` : 'Meghívó újraküldve')
  }
  // export (10.1): a többi oldal Export-ablakának mintájára — kiket, mely mezőkkel
  const [exp, setExp] = useState<{ scope: 'all' | 'selected'; fields: string[] } | null>(null)
  const exportList = (targets: TeamMemberVM[]) => setExp({ scope: targets.length && targets.length < list.length && targets.every((t) => selected.includes(t.id)) ? 'selected' : 'all', fields: TEAM_EXPORT_DEFAULT })
  const download = () => {
    if (!exp) return
    downloadCsv(`munkatarsak-${todayStamp()}.csv`, employeesCsv(exp.scope === 'selected' ? selMembers : filtered, exp.fields))
    setExp(null)
  }

  // szerep-váltás (egyedi szerep) — a belépési joggal rendelkezőknek
  const [roleFor, setRoleFor] = useState<TeamMemberVM[] | null>(null)
  const [roleId, setRoleId] = useState('')
  const saveRole = async () => {
    const ok = (roleFor ?? []).filter((m) => m.membershipId && !m.owner)
    if (!roleId || !ok.length) { setRoleFor(null); return }
    setBusy(true)
    const results = await Promise.allSettled(ok.map((m) => fetch(`/api/team/members/${m.membershipId}`, json({ custom_role: roleId })).then((r) => { if (!r.ok) throw new Error() })))
    setBusy(false)
    const failed = results.filter((r) => r.status === 'rejected').length
    const name = roles.find((r) => r.id === roleId)?.label ?? ''
    setList((l) => l.map((x) => (ok.some((m) => m.id === x.id) ? { ...x, role: name, customRoleId: roleId } : x)))
    if (failed) toast.error(`${failed} módosítása nem sikerült`)
    else toast.success('Szerep módosítva')
    setRoleFor(null)
    router.refresh()
  }

  // törlés
  const [del, setDel] = useState<TeamMemberVM | null>(null)
  const confirmDelete = async () => {
    if (!del) return
    setBusy(true)
    try {
      const res = await fetch(restaurant ? `/api/team/members/${del.id}` : `/api/staff/${del.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'A törlés sikertelen')
      setList((l) => l.filter((x) => x.id !== del.id))
      setSelected((s) => s.filter((k) => k !== del.id))
      if (openKey === del.id) open(null)
      toast.success('Törölve')
      setDel(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A törlés sikertelen')
    } finally {
      setBusy(false)
    }
  }
  const [bulkSuspend, setBulkSuspend] = useState(false)

  // ── meghívás (16.4): a közös folyamat (InviteFlow) — a Beállítások › Csapat & jogok is ezt használja ──
  const freeStaff = list.filter((m) => !m.owner && !m.membershipId && !m.email && m.id !== 'owner').map((m) => ({ id: m.id, name: m.name }))
  const [inviteOpen, setInviteOpen] = useState(false)
  const openInvite = () => setInviteOpen(true)
  useEffect(() => {
    const on = () => { if (canManage) openInvite() }
    window.addEventListener('davelopment:open-staff-add', on)
    return () => window.removeEventListener('davelopment:open-staff-add', on)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const bookableN = list.filter((m) => m.bookable && m.status !== 'suspended').length

  // ── szerkesztés (10.4) ──
  const [edit, setEdit] = useState<{ id: string; base: StaffEditValue; v: StaffEditValue; avatarId: number | null | undefined; img: string | null; hoursIds: (string | undefined)[] } | null>(null)
  const [topic, setTopic] = useState('Alapadatok')
  // feltöltés közben (design 21.6.2): helyi előnézet, százalék, „Kicsinyítés”, hiba
  const [photoUp, setPhotoUp] = useState<UploadState | null>(null)
  const [docUp, setDocUp] = useState<UploadState | null>(null)
  const [loc, setLoc] = useState<Locale>('hu')
  const [tr, setTr] = useState<Partial<Record<Locale, string>>>({})
  // a betöltött (mentett) fordítások — csak az eltérő megy mentésre, és csak az számít módosításnak
  const [trBase, setTrBase] = useState<Partial<Record<Locale, string>>>({})
  const [locBusy, setLocBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const salonStaff = (m: TeamMemberVM) => !restaurant && m.id !== 'owner'

  const startEdit = (m: TeamMemberVM) => {
    const v = toEdit(m)
    setEdit({ id: m.id, base: v, v, avatarId: undefined, img: m.img, hoursIds: [] })
    setTopic('Alapadatok')
    setLoc('hu')
    setTr({})
    setTrBase({})
    setPhotoUp(null)
    setDocUp(null)
    // szalon: a heti munkaidő (a saját heti rekordok; ha nincs, a szalon nyitvatartása)
    if (salonStaff(m)) {
      Promise.all([
        fetch(`/api/availability?where[staff][equals]=${m.id}&where[recurring][equals]=true&limit=50`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/availability?where[salon][equals]=${businessId}&where[recurring][equals]=true&limit=300`, { credentials: 'include' }).then((r) => r.json()),
      ]).then(([own, salon]: { docs?: { id: string | number; staff?: unknown; day_of_week?: string; is_available?: boolean; start_time?: string; end_time?: string; exception_date?: string | null }[] }[]) => {
        const mine = (own.docs ?? []).filter((r) => !r.exception_date)
        const def = (salon.docs ?? []).filter((r) => !r.staff && !r.exception_date)
        const days = DAY_KEYS.map((k) => {
          const a = mine.find((r) => r.day_of_week === k), b = def.find((r) => r.day_of_week === k), src = a ?? b
          return { on: mine.length ? !!a && a.is_available !== false : !!b && b.is_available !== false, start: src?.start_time ?? '09:00', end: src?.end_time ?? '17:00' }
        })
        const hours = { custom: mine.length > 0, days }
        const ids = DAY_KEYS.map((k) => { const a = mine.find((r) => r.day_of_week === k); return a ? String(a.id) : undefined })
        setEdit((e) => (e && e.id === m.id ? { ...e, base: { ...e.base, hours }, v: { ...e.v, hours }, hoursIds: ids } : e))
      }).catch(() => toast.error('A munkaidő betöltése sikertelen'))
    }
  }
  const switchLoc = async (l: Locale) => {
    if (!edit || l === loc) return
    if (l === 'hu' || tr[l] !== undefined) { setLoc(l); return }
    setLocBusy(true)
    try {
      const res = await fetch(`/api/staff/${edit.id}?locale=${l}&fallback-locale=null&depth=0`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      setTr((t) => ({ ...t, [l]: doc.bio ?? '' }))
      setTrBase((t) => ({ ...t, [l]: doc.bio ?? '' }))
      setLoc(l)
    } catch {
      toast.error('A nyelvi tartalom betöltése sikertelen')
    } finally {
      setLocBusy(false)
    }
  }
  const editM = edit ? list.find((m) => m.id === edit.id) ?? null : null
  const changes = edit ? (Object.keys(edit.v) as (keyof StaffEditValue)[]).filter((k) => JSON.stringify(edit.v[k]) !== JSON.stringify(edit.base[k])).length + (edit.avatarId !== undefined ? 1 : 0) + Object.keys(tr).filter((l) => tr[l as Locale] !== trBase[l as Locale]).length : 0
  // a szerkesztőben a bemutatkozás a kiválasztott nyelven
  const shown: StaffEditValue | null = edit ? (loc === 'hu' ? edit.v : { ...edit.v, bio: tr[loc] ?? '' }) : null
  const onEditChange = (nv: StaffEditValue) => setEdit((e) => (e ? { ...e, v: loc === 'hu' ? nv : { ...nv, bio: e.v.bio } } : e))
  const setBio = (nv: StaffEditValue) => { if (loc !== 'hu') setTr((t) => ({ ...t, [loc]: nv.bio })); onEditChange(nv) }

  const onPhoto = async (file: File) => {
    try {
      const up = await uploadMedia(file, setPhotoUp)
      setEdit((e) => (e ? { ...e, avatarId: up.id, img: up.url } : e))
      setPhotoUp(null)
    } catch (err) {
      setPhotoUp((u) => ({ src: u?.src ?? '', pct: 0, proc: false, error: err instanceof Error ? err.message : 'A feltöltés nem sikerült.' }))
    }
  }
  const onDocAdd = async (file: File) => {
    try {
      const up = await uploadMedia(file, setDocUp)
      setEdit((e) => (e ? { ...e, v: { ...e.v, documents: [...e.v.documents, { label: file.name.replace(/\.[^.]+$/, ''), url: up.url, fileId: up.id }] } } : e))
      setDocUp(null)
    } catch (err) {
      setDocUp((u) => ({ src: u?.src ?? '', pct: 0, proc: false, error: err instanceof Error ? err.message : 'A feltöltés nem sikerült.' }))
    }
  }

  const save = async () => {
    if (!edit || !editM) return
    const v = edit.v
    if (!v.name.trim()) { toast.error('A név kötelező'); return }
    if (v.hours?.custom && v.hours.days.some((d) => d.on && (!TIME_RE.test(d.start) || !TIME_RE.test(d.end) || d.start >= d.end))) { setTopic('Munkaidő'); toast.error('A munkaidőben a kezdés legyen korábban, mint a vége'); return }
    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    const common = {
      name: v.name.trim(), phone: v.phone || null, birthday: v.birthday || null, join_date: v.joinDate || null, address: v.address || null,
      tax_id: v.taxId || null, tax_number: v.taxNumber || null, weekly_hours: v.weeklyTarget, bio: v.bio || null,
    }
    const docs = v.documents.filter((d) => d.fileId != null).map((d) => ({ label: d.label, file: d.fileId }))
    setSaving(true)
    try {
      if (editM.id === 'owner') {
        const res = await fetch('/api/user/profile', json({ ...common, ...(restaurant ? {} : { role_title: v.position.trim() || null }) }))
        if (!res.ok) throw new Error()
      } else if (restaurant) {
        const res = await fetch(`/api/team/members/${editM.id}`, json({
          ...common, ...(v.position.trim() && v.position.trim() !== editM.position ? { position: v.position.trim() } : {}),
          documents: docs, ...(edit.avatarId !== undefined ? { avatar: edit.avatarId } : {}),
          ...(canSalary ? { pay_type: v.payType, pay_rate: num(v.payRate), tip_eligible: v.tipEligible } : {}),
        }))
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch(`/api/staff/${editM.id}`, json({
          ...common, email: v.email.trim() || null, role_title: v.position.trim() || null, is_active: v.bookable,
          booking_buffer_minutes: v.buffer, min_lead_hours: v.minLead,
          social_links: v.socialLinks.filter((u) => u.trim()).map((url) => ({ url: url.trim() })), documents: docs,
          ...(edit.avatarId !== undefined ? { avatar: edit.avatarId } : {}),
          ...(canSalary ? { salary: num(v.payRate) } : {}),
        }))
        if (!res.ok) throw new Error()
        // a bemutatkozás fordításai (csak a megnyitott nyelvek)
        await Promise.all(Object.entries(tr).filter(([l, bio]) => bio !== trBase[l as Locale]).map(([l, bio]) => fetch(`/api/staff/${editM.id}?locale=${l}`, json({ bio: bio || null }))))
        // szolgáltatás-hozzárendelés: az érintett szolgáltatások munkatárs-listája
        if (JSON.stringify(v.serviceIds) !== JSON.stringify(edit.base.serviceIds)) {
          const add = v.serviceIds.filter((s) => !edit.base.serviceIds.includes(s)), rem = edit.base.serviceIds.filter((s) => !v.serviceIds.includes(s))
          await Promise.all([...add, ...rem].map(async (sid) => {
            const cur = await fetch(`/api/services/${sid}?depth=0`, { credentials: 'include' }).then((r) => r.json()) as { staff?: (string | number)[] }
            const ids = (cur.staff ?? []).map(String)
            const next = add.includes(sid) ? [...new Set([...ids, editM.id])] : ids.filter((x) => x !== editM.id)
            await fetch(`/api/services/${sid}`, json({ staff: next.map(Number) }))
          }))
        }
        // heti munkaidő (Availability rekordok) — kikapcsolva a szalon nyitvatartása érvényes
        if (v.hours && JSON.stringify(v.hours) !== JSON.stringify(edit.base.hours)) {
          if (!v.hours.custom) {
            await Promise.all(edit.hoursIds.filter(Boolean).map((id) => fetch(`/api/availability/${id}`, { method: 'DELETE', credentials: 'include' })))
          } else {
            await Promise.all(v.hours.days.map((d, i) => {
              const body = { salon: Number(businessId), staff: Number(editM.id), day_of_week: DAY_KEYS[i], recurring: true, is_available: d.on, start_time: d.start, end_time: d.end }
              const id = edit.hoursIds[i]
              return id ? fetch(`/api/availability/${id}`, json(body)) : fetch('/api/availability', { ...json(body), method: 'POST' })
            }))
          }
        }
      }
      toast.success('Mentve')
      setEdit(null)
      router.refresh()
    } catch {
      toast.error('A mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  // mobilon a szerkesztő alulról nyíló ablakban (10.5 / 4), desktopon a nézet helyén (10.4)
  const [mobileEdit, setMobileEdit] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setMobileEdit(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const editing = !!edit && !!editM && !mobileEdit

  // ── nézet-adatok ──
  const [acc, setAcc] = useState<string | null>(null)
  const now = new Date()
  const curMonth = now.getMonth()
  const team = list.filter((m) => m.status === 'active' && (restaurant || m.bookable))
  const avgSeries = Array.from({ length: 12 }, (_, i) => (team.length ? Math.round(team.reduce((s, m) => s + m.series[i], 0) / team.length) : 0))
  const utilOf = (m: TeamMemberVM): Pick<StaffCardRow, 'util' | 'utilLabel'> => restaurant || !m.bookable
    ? { util: m.weeklyTarget ? Math.min(100, Math.round((m.weekHours / m.weeklyTarget) * 100)) : null, utilLabel: `${m.weekHours}${m.weeklyTarget ? ` / ${m.weeklyTarget}` : ''} óra a héten` }
    : { util: m.weekUtil, utilLabel: m.weekUtil == null ? 'Nincs beosztása a héten' : `${m.weekUtil}% foglalt a héten` }
  const svcNames = (m: TeamMemberVM) => services.filter((s) => m.serviceIds.includes(s.id)).map((s) => s.name)
  const subOf = (m: TeamMemberVM) => [m.position || (m.owner ? 'Tulajdonos' : ''), m.joinDate ? `${m.joinDate.slice(0, 4)} óta` : ''].filter(Boolean).join(' · ')

  const summary = (m: TeamMemberVM, mobile = false) => {
    const mo = m.month
    const segments = restaurant
      ? [{ label: 'Műszak', value: String(mo.shifts), weight: 30, tone: 'yellow' as const }, { label: 'Óra', value: String(mo.hours), weight: 30, tone: 'dark' as const }, { label: 'Borravaló', value: mo.tips ? `${short(mo.tips)} Ft` : '—', weight: 24, tone: 'hatch' as const }, { label: 'Beteg', value: `${mo.sickDays} nap`, weight: 16, tone: 'grey' as const }]
      : [{ label: 'Foglalás', value: String(mo.bookings), weight: 38, tone: 'yellow' as const }, { label: 'Bevétel', value: mo.revenue ? `${short(mo.revenue)} Ft` : '—', weight: 38, tone: 'dark' as const }, { label: 'Elmaradt', value: String(mo.noShow), weight: 24, tone: 'grey' as const }]
    const upto = Math.max(1, curMonth)
    return (
      <StaffSummary avatar={mobile} half={mobile} name={m.name} img={m.img} sub={subOf(m)} services={restaurant ? [] : svcNames(m)} bio={m.bio} segments={segments}
        chart={{ title: restaurant ? 'Ledolgozott órák havonta' : 'Foglalások havonta', name: m.name.split(' ')[0], unit: restaurant ? 'óra' : 'foglalás', year: String(now.getFullYear()), sel: curMonth, me: m.series.slice(0, Math.max(upto, curMonth) + 1), avg: avgSeries.slice(0, Math.max(upto, curMonth) + 1), months: MONTHS_SHORT.slice(0, Math.max(upto, curMonth) + 1) }}
        phone={m.phone || null} email={m.email || null} onEdit={canEdit(m) ? () => startEdit(m) : undefined} className={mobile ? 'mt-3' : ''} />
    )
  }
  const accordion = (m: TeamMemberVM, className = '') => {
    const pay = m.payRate ? (m.payType === 'hourly' ? m.month.hours * m.payRate : m.month.daysWorked * m.payRate) : 0
    const sections = [
      { title: 'Alapadatok', content: <><InfoRow k="Telefon" v={m.phone || '—'} /><InfoRow k="E-mail" v={m.email || '—'} /><InfoRow k="Születésnap" v={huDate(m.birthday?.slice(0, 10) ?? null)} /><InfoRow k="Belépés" v={huDate(m.joinDate)} /><InfoRow k="Szerep" v={m.role} /></> },
      ...(restaurant ? [] : [{ title: 'Szolgáltatások', content: svcNames(m).length ? <div className="flex flex-wrap gap-1">{svcNames(m).map((n) => <span key={n} className="text-ui-meta text-ui-text">{n}</span>).reduce<React.ReactNode[]>((a, el, i) => (i ? [...a, <span key={`s${i}`} className="text-ui-muted">·</span>, el] : [el]), [])}</div> : <Meta>Nincs hozzárendelt szolgáltatás.</Meta> }]),
      { title: 'Munkaidő', content: <><InfoRow k="Heti óra (szerződés)" v={m.weeklyTarget ? `${m.weeklyTarget} ó` : '—'} /><InfoRow k="E héten beosztva" v={`${m.weekHours} ó`} /><InfoRow k="E hónapban" v={`${m.month.daysWorked} nap · ${m.month.hours} ó`} />{m.breaks.length > 0 && <InfoRow k="Napi szünet" v={m.breaks.map((b) => `${b.start}–${b.end}`).join(', ')} />}<InfoRow k="Szabadság / beteg" v={`${m.month.vacationDays} / ${m.month.sickDays} nap`} /></> },
      ...(canSeePay(m) ? [{ title: 'Bér és borravaló', content: <><InfoRow k={m.payType === 'hourly' ? 'Órabér' : 'Napidíj'} v={m.payRate ? `${m.payRate.toLocaleString('hu-HU')} Ft` : '—'} /><InfoRow k="E havi bér (eddig)" v={pay ? `${pay.toLocaleString('hu-HU')} Ft` : '—'} />{restaurant && <InfoRow k="Borravaló (e hó)" v={m.tipEligible ? `${m.month.tips.toLocaleString('hu-HU')} Ft` : 'nem jogosult'} />}</> }] : []),
      ...(m.id === 'owner' ? [] : [{ title: 'Dokumentumok', content: m.documents.length ? <div className="space-y-1">{m.documents.map((d, i) => <InfoRow key={i} k={d.label || 'Dokumentum'} v={d.url ? <a href={d.url} download className="underline underline-offset-2">Letöltés</a> : '—'} />)}</div> : <Meta>Még nincs feltöltve dokumentum.</Meta> }]),
    ]
    return <StaffAccordion sections={sections} open={acc} onToggle={(t) => setAcc((a) => (a === t ? null : t))} className={className} />
  }

  const statusOf = (m: TeamMemberVM) => STATUS[m.status]
  // rendezés az oszlopcímre kattintva
  const sortedMembers = sortRows(filtered, teamSort, (m, k) => (k === 'name' ? m.name : k === 'position' ? m.position : k === 'login' ? (m.joinDate ? new Date(m.joinDate) : null) : k === 'hours' ? m.weekHours : k === 'role' ? m.role : statusOf(m).label))
  const tableRows: StaffTableRow[] = sortedMembers.slice((page - 1) * PAGE, page * PAGE).map((m) => ({
    key: m.id, name: m.name, img: m.img, position: m.position, email: m.email, join: huDate(m.joinDate),
    // a határ a szerződéses heti óra, ha nincs megadva, az egészséges 48; fölötte túlóra: piros, „(+n)”
    hours: `${m.weekHours} / ${m.weeklyTarget ?? HEALTHY_WEEK}`, over: m.weekHours > (m.weeklyTarget ?? HEALTHY_WEEK) ? m.weekHours - (m.weeklyTarget ?? HEALTHY_WEEK) : null,
    tone: m.weekHours > (m.weeklyTarget ?? HEALTHY_WEEK) ? 'bad' : m.weekHours > 0 ? 'ok' : undefined,
    role: m.role, status: statusOf(m).pill, statusLabel: statusOf(m).label, owner: m.owner || m.id === 'owner', muted: m.status === 'suspended', review: m.review,
  }))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const label = filtered.length ? `${(page - 1) * PAGE + 1}–${Math.min(filtered.length, page * PAGE)} / ${filtered.length} munkatárs` : '0'
  const cardRows: StaffCardRow[] = filtered.slice((cardPage - 1) * CARD_PAGE, cardPage * CARD_PAGE).map((m) => ({ key: m.id, name: m.name, position: m.position, img: m.img, ...utilOf(m) }))
  const cardPages = Math.max(1, Math.ceil(filtered.length / CARD_PAGE))

  // a sor végi ⋯ menü
  const [menu, setMenu] = useState<string | null>(null)
  const rowActions = (r: StaffTableRow) => {
    const m = list.find((x) => x.id === r.key)
    if (!m || !canManage) return null
    return (
      <span className="relative" onClick={(e) => e.stopPropagation()}>
        <IconButton icon={MoreHorizontal} size="sm" variant="ghost" label="Műveletek" onClick={() => setMenu((k) => (k === m.id ? null : m.id))} />
        {menu === m.id && <>
          <span className="fixed inset-0 z-10" onClick={() => setMenu(null)} aria-hidden />
          <Menu className="absolute right-0 top-10 z-20 w-56">
            {canEdit(m) && <MenuItem icon={Pencil} onClick={() => { setMenu(null); open(m.id); startEdit(m) }}>Szerkesztés</MenuItem>}
            {m.membershipId && !m.owner && roles.length > 0 && <MenuItem icon={UserCog} onClick={() => { setMenu(null); setRoleId(m.customRoleId ?? roles[0].id); setRoleFor([m]) }}>Szerep módosítása</MenuItem>}
            {m.status === 'invited' && m.membershipId && <MenuItem icon={Send} onClick={() => { setMenu(null); void resend([m]) }}>Meghívó újraküldése</MenuItem>}
            {!m.owner && m.id !== 'owner' && m.status === 'active' && <MenuItem icon={Ban} onClick={() => { setMenu(null); void setStatusOf([m], 'suspended') }}>Felfüggesztés</MenuItem>}
            {!m.owner && m.id !== 'owner' && m.status === 'suspended' && <MenuItem icon={ShieldCheck} onClick={() => { setMenu(null); void setStatusOf([m], 'active') }}>Visszaállítás</MenuItem>}
            {!m.owner && m.id !== 'owner' && <MenuItem icon={Trash2} danger onClick={() => { setMenu(null); setDel(m) }}>{m.status === 'invited' ? 'Meghívó visszavonása' : 'Törlés'}</MenuItem>}
          </Menu>
        </>}
      </span>
    )
  }

  // ── fejléc ──
  const total = list.length || 1
  const bar = (mobile = false) => <SegmentBar className={mobile ? 'mt-4' : undefined} segments={[
    { label: 'Aktív', value: mobile ? String(count('active')) : `${count('active')} fő`, weight: (count('active') / total) * 100 || 4, tone: 'dark' },
    { label: 'Meghívott', value: mobile ? String(count('invited')) : `${count('invited')} fő`, weight: (count('invited') / total) * 100 || 4, tone: 'yellow' },
    { label: mobile ? 'Felf.' : 'Felfüggesztett', value: mobile ? String(count('suspended')) : `${count('suspended')} fő`, weight: (count('suspended') / total) * 100 || 4, tone: 'hatch' },
  ]} />
  const headActions = canManage ? <><Button variant="glass" icon={Download} onClick={() => exportList(filtered)}>Export</Button><Button variant="yellow" icon={Plus} onClick={openInvite}>Meghívás</Button></> : undefined
  const chips: [string, number][] = [['Mind', list.length], ['Aktív', count('active')], ['Meghívott', count('invited')], ...(count('suspended') ? [['Felfüggesztett', count('suspended')] as [string, number]] : [])]
  const chipIdx = status === 'all' ? 0 : status === 'active' ? 1 : status === 'invited' ? 2 : status === 'suspended' ? 3 : 0
  const onChip = (i: number) => setStatus((['all', 'active', 'invited', 'suspended'] as const)[i])

  const dateInput = (value: string, set: (v: string) => void) => (
    <DatePickerPopover value={value || '1990-01-01'} onChange={set} yearRange={[1930, now.getFullYear() + 1]} onClear={value ? () => set('') : undefined} triggerClassName={`${FIELD} h-9 w-full text-left`}>
      {value ? huDate(value) : <span className="text-ui-muted">Nincs megadva</span>}
    </DatePickerPopover>
  )
  const editOptions = (m: TeamMemberVM) => ({
    restaurant, positions, services, salary: canSalary && !m.owner && m.id !== 'owner', account: m.id === 'owner',
    breaks: m.breaks.length ? m.breaks.map((b) => `${b.start}–${b.end}`).join(', ') : null, dateInput,
    bioTop: salonStaff(m) ? <LocaleEditBar available={locales} active={loc} onSelect={(l) => void switchLoc(l)} loading={locBusy} /> : undefined,
    onDocAdd: m.id === 'owner' ? undefined : (f: File) => void onDocAdd(f), docUpload: docUp,
  })
  // szakemberenkénti számlázásnál (Fizetés & számlázás › Ki számláz?) a munkatársnak saját számlázás témája is van
  const topics = (m: TeamMemberVM) => [...STAFF_TOPICS, ...(staffInvoicing && !restaurant && m.id !== 'owner' ? [['Saját számlázás', FileText] as [string, LucideIcon]] : [])].filter(([t]) => {
    if (m.id === 'owner') return t === 'Alapadatok' || t === 'Bemutatkozás'
    if (restaurant && (t === 'Foglalás' || t === 'Munkaidő')) return false
    if (t === 'Bér és borravaló') return canSalary && !m.owner
    if (t === 'Munkaidő') return canEditAvailability
    return true
  })

  // ── 10.3: egyedül (csak a tulajdonos) ──
  if (list.length <= 1 && list[0]) {
    const me = list[0]
    return (
      <div className="p-4 lg:p-0">
        <PageHead title="Munkatársak" actions={headActions} />
        <div className="grid gap-[5px] lg:grid-cols-[280px_minmax(0,1fr)]">
          <StaffProfile person={{ name: me.name, role: me.position || 'Tulajdonos', img: me.img }} phone={me.phone || null}
            rows={[['Belépés', huDate(me.joinDate)], ['Telefon', me.phone || '—'], ['Heti óra', me.weeklyTarget ? `${me.weeklyTarget} ó` : '—']]}
            stats={[['Ledolgozott', `${me.month.hours} ó`, Math.min(100, me.weeklyTarget ? (me.month.hours / (me.weeklyTarget * 4.3)) * 100 : 0), 'yellow'], ['Beteg', `${me.month.sickDays} nap`, Math.min(100, me.month.sickDays * 10), 'dark'], ['Szabadság', `${me.month.vacationDays} nap`, Math.min(100, me.month.vacationDays * 10), 'grey']]}
            onEdit={canEdit(me) ? () => { open(me.id); startEdit(me) } : undefined} />
          <EmptyState icon={Users} title="Egyedül dolgozol?" action={canManage ? <Button variant="yellow" icon={Plus} onClick={openInvite}>Munkatárs meghívása</Button> : undefined}>
            {restaurant
              ? 'Ha csapattal dolgozol, hívd meg őket: mindenki saját belépést kap, és csak azt látja, amit a szerepe enged; a beosztásuk a Naptárban készül.'
              : 'Egyedül is minden működik — a te naptárad a foglalóoldal. Ha csapattal dolgozol, hívd meg őket: mindenki saját belépést és saját naptárat kap, és csak azt látja, amit a szerepe enged.'}
          </EmptyState>
        </div>
        {dialogs()}
      </div>
    )
  }

  // ── ablakok ──
  function dialogs() {
    return (
      <>
        <InviteFlow open={inviteOpen} onClose={() => setInviteOpen(false)} restaurant={restaurant} businessId={businessId} roles={roles.map((r) => ({ id: r.id, label: r.label, desc: r.desc }))} freeStaff={freeStaff} extraFee={extraFee} bookable={bookableN} />
        {exp && (
          <Popup onClose={() => setExp(null)}>
            <StaffExportModal fields={exp.fields} onFields={(f) => setExp({ ...exp, fields: f })} scope={exp.scope} onScope={(sc) => setExp({ ...exp, scope: sc })}
              counts={{ all: filtered.length, selected: selMembers.length }} restaurant={restaurant} pay={canSalary} onDownload={download} onClose={() => setExp(null)} />
          </Popup>
        )}
        {roleFor && (
          <PopupModal open onClose={() => setRoleFor(null)} title="Szerep módosítása" subtitle={roleFor.length > 1 ? `${roleFor.length} munkatárs` : roleFor[0]?.name}
            footer={<div className="flex justify-end gap-2"><Button variant="cell" onClick={() => setRoleFor(null)}>Mégse</Button><Button onClick={() => void saveRole()} loading={busy}>Mentés</Button></div>}>
            <div className="space-y-1">
              {roles.map((r) => (
                <button key={r.id} type="button" onClick={() => setRoleId(r.id)} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                  <OptionCard radio title={r.label} selected={roleId === r.id}>{r.desc}</OptionCard>
                </button>
              ))}
            </div>
            {roleFor.some((m) => !m.membershipId) && <Note className="mt-3">Akinek nincs belépése (nem kapott meghívót), annak nincs szerepe — őt előbb hívd meg.</Note>}
          </PopupModal>
        )}
        <ConfirmDialog open={!!del} title={del?.status === 'invited' ? 'Meghívó visszavonása' : 'Munkatárs törlése'} description={del ? `${del.name} — a művelet nem vonható vissza.` : undefined}
          confirmLabel={del?.status === 'invited' ? 'Visszavonás' : 'Törlés'} busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDel(null)} zIndexClass="z-[100]" />
        <ConfirmDialog open={bulkSuspend} title="Kijelöltek felfüggesztése" description={`${selMembers.filter((m) => m.status === 'active' && !m.owner).length} munkatárs nem lép be és nem foglalható, amíg vissza nem állítod.`}
          confirmLabel="Felfüggesztés" busy={busy} onConfirm={async () => { await setStatusOf(selMembers, 'suspended'); setBulkSuspend(false); setSelected([]) }} onCancel={() => setBulkSuspend(false)} zIndexClass="z-[100]" />
        {/* mobil (10.5 / 4): a szerkesztő alulról, egy hasábban */}
        <PopupModal open={!!edit && !!editM && mobileEdit} onClose={() => setEdit(null)} title={editM ? `${editM.name.split(' ')[0]} szerkesztése` : ''}
          footer={<Button className="w-full" onClick={() => void save()} loading={saving} disabled={!changes}>Mentés</Button>}>
          {edit && editM && shown && <StaffEditSections stacked only={topics(editM).flatMap(([t]) => TOPIC_CARDS[t])} value={shown} onChange={setBio} options={editOptions(editM)} />}
        </PopupModal>
      </>
    )
  }


  const bulk = canManage ? (
    <StaffBulkBar count={selected.length} onClear={() => setSelected([])} actions={[
      ...(roles.length ? [{ label: 'Szerep módosítása', onClick: () => { setRoleId(roles[0].id); setRoleFor(selMembers) } }] : []),
      { label: 'Meghívó újraküldése', onClick: () => void resend(selMembers) },
      { label: 'Export', onClick: () => exportList(selMembers) },
      { label: 'Felfüggesztés', danger: true, onClick: () => setBulkSuspend(true) },
    ]} />
  ) : undefined

  // a nézet eszköztárának szűrő-ikonja (10.2): pozíció, szerep, átnézendők
  const morePanel = (
    <div className="space-y-3">
      <div><Meta className="mb-1.5">Pozíció</Meta><Select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Pozíció"><option value="all">Mind</option>{positions.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
      <div><Meta className="mb-1.5">Szerep</Meta><Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Szerep"><option value="all">Mind</option>{roleNames.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
      {reviewN > 0 && <Checkbox label={`Csak az átnézendők (${reviewN})`} checked={status === 'review'} onChange={() => setStatus(status === 'review' ? 'all' : 'review')} />}
      {(pos !== 'all' || role !== 'all' || status === 'review') && <Button variant="cell" size="sm" onClick={() => { setPos('all'); setRole('all'); if (status === 'review') setStatus('all') }}>Alaphelyzet</Button>}
    </div>
  )
  const filters = (
    <div className="flex flex-wrap items-center gap-1.5">
      {positions.length > 0 && <Select toolbar value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Pozíció" className="w-[160px]"><option value="all">Pozíció</option>{positions.map((p) => <option key={p} value={p}>{p}</option>)}</Select>}
      <Select toolbar value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Állapot" className="w-[160px]">
        <option value="all">Állapot</option><option value="active">Aktív</option><option value="invited">Meghívott</option><option value="suspended">Felfüggesztett</option>{reviewN > 0 && <option value="review">Átnézendő ({reviewN})</option>}
      </Select>
      {roleNames.length > 1 && <Select toolbar value={role} onChange={(e) => setRole(e.target.value)} aria-label="Szerep" className="w-[160px]"><option value="all">Szerep</option>{roleNames.map((r) => <option key={r} value={r}>{r}</option>)}</Select>}
      <SearchField className="w-[180px]" value={query} onChange={setQuery}>Keresés</SearchField>
    </div>
  )

  return (
    <div className="p-4 lg:p-0">
      {/* ── desktop ── */}
      <div className="max-lg:hidden">
        {!sel ? (
          <>
            {/* 10.1: a lista */}
            <PageHead title="Munkatársak" actions={headActions} />
            <div className="mb-[5px] flex flex-wrap items-end justify-between gap-4">
              <div className="w-[min(420px,100%)]">{bar()}</div>
              {filters}
            </div>
            <StaffTable th={teamTh} rows={tableRows} openKey={null} selected={selected} onOpen={(k) => open(k)} onToggle={toggle}
              onToggleAll={() => { const keys = tableRows.filter((r) => !r.owner).map((r) => r.key); setSelected((s) => (keys.every((k) => s.includes(k)) ? s.filter((k) => !keys.includes(k)) : [...new Set([...s, ...keys])])) }}
              actions={canManage ? rowActions : () => null} page={page} pages={pages} label={label} onPage={setPage} bulk={bulk}
              empty={<Meta className="px-3 py-10 text-center">Nincs a szűrésnek megfelelő munkatárs.</Meta>} />
          </>
        ) : (
          <>
            {/* 10.2 / 10.4: a munkatárs nézete és szerkesztője */}
            {/* szerkesztésből a nézetébe lép vissza, a nézetből a listába */}
            {editing
              ? <PageHead back={[sel.name, 'Szerkesztés']} onBack={() => setEdit(null)} />
              : <PageHead back={['Munkatársak', sel.name]} onBack={() => open(null)} />}
            <ChipToolbar search="Munkatárs keresése" chips={chips} active={chipIdx} query={query} onQuery={setQuery} onChip={onChip} dot={pos !== 'all' || role !== 'all' || status === 'review'} filters={morePanel} />
            <div className="relative grid gap-[5px] xl:grid-cols-[240px_minmax(0,1fr)]">
              <StaffListCard rows={cardRows} openKey={sel.id} total={`${filtered.length} fő`} page={cardPage} pages={cardPages} label={`${(cardPage - 1) * CARD_PAGE + 1}–${Math.min(filtered.length, cardPage * CARD_PAGE)} / ${filtered.length}`} onPage={setCardPage}
                onOpen={(k) => { const m = list.find((x) => x.id === k); open(k); if (editing && m && canEdit(m)) startEdit(m) }} />
              {/* munkatárs- és nézet-váltáskor a jobb oldal az ablakok rugós („genie”) belépőjével érkezik */}
              <motion.div key={`${sel.id}-${editing ? 'edit' : 'view'}`} variants={POP} initial="hidden" animate="show" className="min-w-0 origin-top">
                {editing && edit && editM && shown ? (
                  <div className="grid h-full gap-[5px] xl:grid-cols-[230px_minmax(0,1fr)]">
                    <StaffEditNav img={edit.img} name={edit.v.name || editM.name} position={edit.v.position || editM.position} topics={topics(editM)} topic={topic} onTopic={setTopic}
                      onPhoto={editM.id === 'owner' ? undefined : (f) => void onPhoto(f)} upload={photoUp} social={edit.v.socialLinks}
                      suspend={editM.owner || editM.id === 'owner' || editM.status === 'invited' || !canManage ? null : editM.status === 'suspended' ? 'Visszaállítás' : 'Munkatárs felfüggesztése'}
                      onSuspend={() => void setStatusOf([editM], editM.status === 'suspended' ? 'active' : 'suspended')} />
                    {/* egy nagy ablak: fejléc (téma, mire való), alatta a téma mezői hasábokban; témaváltáskor rugósan vált */}
                    <Card tone="white" pad="lg" className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <IconCircle icon={TOPIC_ICON[topic] ?? (topic === 'Saját számlázás' ? FileText : UserRound)} tone="cell" size="lg" />
                          <div className="min-w-0">
                            <div className="text-ui-sub font-light text-ui-text">{topic}</div>
                            <Meta className="mt-0.5">{TOPIC_LEAD[topic]}</Meta>
                          </div>
                        </div>
                        <IconButton icon={X} label="Vissza a nézetbe" variant="cell" size="sm" onClick={() => setEdit(null)} />
                      </div>
                      <motion.div key={topic} variants={POP} initial="hidden" animate="show" className="mt-6 origin-top">
                        {topic === 'Saját számlázás' ? <StaffInvoicingPanel staffId={String(editM.id)} name={editM.name} /> : <StaffEditSections bare only={TOPIC_CARDS[topic]} value={shown} onChange={setBio} options={editOptions(editM)} />}
                      </motion.div>
                    </Card>
                  </div>
                ) : (
                  <div className="grid gap-[5px] xl:grid-cols-[210px_minmax(0,1fr)]">
                    <div className="flex flex-col gap-[5px]">
                      <StaffPhoto src={sel.img} name={sel.name} />
                      {accordion(sel)}
                      <StaffHoursCard hours={sel.month.hours} prev={sel.month.hoursPrev} trend={sel.month.trend} trendPrev={sel.month.trendPrev} className="min-h-[180px] flex-1" />
                    </div>
                    {summary(sel)}
                  </div>
                )}
              </motion.div>
              {editing && changes > 0 && <div className="pointer-events-none sticky bottom-6 z-30 h-0 xl:col-span-2"><SaveBar label={`${changes} módosítás`} className="bottom-0" busy={saving} onSave={() => void save()} onDiscard={() => setEdit(null)} /></div>}
            </div>
          </>
        )}
      </div>

      {/* ── mobil (10.5): a lista; koppintásra a teljes nézete, a Szerkesztésre alulról a szerkesztő ── */}
      <div className="lg:hidden">
        {sel && mobileOpen ? (
          <>
            <PageHead back={['Munkatársak', sel.name.split(' ')[0]]} onBack={() => open(null)} className="mb-0" />
            <motion.div key={sel.id} variants={POP} initial="hidden" animate="show" className="origin-top">
              {summary(sel, true)}
              <StaffHoursCard hours={sel.month.hours} prev={sel.month.hoursPrev} trend={sel.month.trend} trendPrev={sel.month.trendPrev} className="mt-[5px] min-h-[180px]" />
              {accordion(sel, 'mt-[5px]')}
            </motion.div>
          </>
        ) : (
          <>
            <PageHead title="Munkatársak" className="mb-0" />
            {bar(true)}
            {mobileSearch && (
              <div className="mt-4 flex items-center gap-1.5">
                <SearchField autoFocus className="min-w-0 flex-1" value={query} onChange={setQuery}>Munkatárs keresése</SearchField>
                <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={() => { setQuery(''); setMobileSearch(false) }} />
              </div>
            )}
            <MobileStaffList className="mt-[5px]" onOpen={(k) => open(k)} rows={filtered.map((m) => ({
              key: m.id, name: m.name, img: m.img,
              meta: restaurant ? `${m.position || m.role} · nem foglalható` : [m.position || (m.owner ? 'Tulajdonos' : ''), m.status === 'active' && m.weekUtil != null ? `${m.weekUtil}% foglalt a héten` : ''].filter(Boolean).join(' · '),
              status: m.status === 'invited' ? 'pending' : m.status === 'suspended' ? 'neutral' : undefined,
              trailing: restaurant && m.status === 'active' && m.id !== 'owner' ? <TipPill on={m.tipEligible} /> : undefined,
            }))} />
          </>
        )}
      </div>
      {dialogs()}
    </div>
  )
}
