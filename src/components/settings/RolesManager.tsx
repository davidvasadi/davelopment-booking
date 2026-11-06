'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BarChart3, Bell, Briefcase, CalendarDays, Clock, CreditCard, FileText, Gift, Megaphone, Settings, Shield, Users, X, Armchair,
  type LucideIcon,
} from 'lucide-react'
import { CAPABILITY_META, type Capability } from '@/lib/permissions'
import { Pill } from '@/components/ui-kit'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RolesEditor, type PermGroup, type RoleItem } from '@/components/blocks/settings'

/**
 * Beállítások › Csapat & jogok › Szerepek (design 16.3) — az élő szerep-szerkesztő a közös `RolesEditor` blokkal: bal
 * oldalt a szerepek (Tulajdonos zárolt), új szerep üresen vagy sablonból; jobbra név, leírás, tagok, a jogcsoportok
 * („mind” kapcsoló, chipek) és a foglalás-értesítés szintje; változáskor lebegő mentés. A szerep-definíció szerkesztése
 * owner-only (a szerver is kényszeríti), másnak csak megtekintés.
 */

export interface RoleRow {
  id: string
  name: string
  description?: string | null
  capabilities?: Capability[] | null
  booking_notify_level?: 'off' | 'own' | 'all' | null
}

type RoleTemplate = {
  id: string
  name: string
  desc: string
  caps: Capability[]
  /** A sablon a Foglalás-értesítés szintjét is előtölti — nincs alapértelmezett érték nélkül
   *  hagyva, mint a `booking_notify_level` mező (ami sose kapott sablon-előtöltést eddig). */
  bookingNotifyLevel: 'off' | 'own' | 'all'
}

const SALON_TEMPLATES: RoleTemplate[] = [
  {
    id: 'manager',
    name: 'Üzletvezető',
    desc: 'Teljes üzletirányítás — analitika, csapat, beállítások, audit',
    caps: [
      'overview.view', 'analytics.view',
      'bookings.view', 'bookings.manage',
      'schedule.manage',
      'guests.view', 'guests.manage',
      'catalog.view', 'catalog.manage',
      'availability.view', 'availability.manage',
      'vouchers.view', 'vouchers.manage',
      'marketing.view', 'marketing.manage',
      'staff.view', 'staff.manage',
      'tips.view', 'tips.manage',
      'settings.profile', 'team.view', 'audit.view',
    ],
    bookingNotifyLevel: 'all',
  },
  {
    id: 'receptionist',
    name: 'Recepcionista',
    desc: 'Foglalások + vendégek kezelése, szolgáltatások megtekintése',
    caps: [
      'overview.view',
      'bookings.view', 'bookings.manage',
      'guests.view', 'guests.manage',
      'catalog.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'all',
  },
  {
    id: 'stylist',
    name: 'Stylist / Szakember',
    desc: 'Saját naptár szerkesztése + foglalások megtekintése (önálló időbeosztás)',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.manage.own',
      'analytics.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'own',
  },
  {
    id: 'assistant',
    name: 'Asszisztens',
    desc: 'Saját naptár megtekintése és profil szerkesztése',
    caps: [
      'overview.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'off',
  },
]

const RESTAURANT_TEMPLATES: RoleTemplate[] = [
  {
    id: 'manager',
    name: 'Üzletvezető',
    desc: 'Teljes üzletirányítás — analitika, csapat, beállítások, audit',
    caps: [
      'overview.view', 'analytics.view',
      'bookings.view', 'bookings.manage',
      'schedule.manage',
      'guests.view', 'guests.manage',
      'tables.view', 'tables.manage',
      'availability.view', 'availability.manage',
      'vouchers.view', 'vouchers.manage',
      'marketing.view', 'marketing.manage',
      'staff.view', 'staff.manage',
      'tips.view', 'tips.manage',
      'settings.profile', 'team.view', 'audit.view',
    ],
    bookingNotifyLevel: 'all',
  },
  {
    id: 'scheduler',
    name: 'Beosztásvezető',
    desc: 'Teljes csapatnaptár kezelése, munkatársak és foglalások megtekintése',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.manage',
      'staff.view',
      'tables.view',
      'analytics.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'all',
  },
  {
    id: 'head_waiter',
    name: 'Főpincér',
    desc: 'Foglalások és vendégek kezelése, asztalok megtekintése, saját naptár',
    caps: [
      'overview.view',
      'bookings.view', 'bookings.manage',
      'guests.view',
      'tables.view',
      'schedule.view.own',
      'analytics.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'all',
  },
  {
    id: 'waiter',
    name: 'Felszolgáló',
    desc: 'Foglalások megtekintése, saját naptár (olvasás) és profil',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.view.own',
      'analytics.view.own',
      'settings.own_profile',
    ],
    bookingNotifyLevel: 'off',
  },
]


// a jogcsoportok ikonjai (a design 16.3 szerint) és a chipek rövid feliratai
const GROUP_ICON: Record<string, LucideIcon> = {
  Foglalás: CalendarDays, Naptár: Clock, Vendégek: Users, Szolgáltatások: Briefcase, Asztalok: Armchair, Nyitvatartás: Clock, Utalványok: Gift,
  Marketing: Megaphone, Munkatársak: Users, Statisztika: BarChart3, Beállítások: Settings, Csapat: Users, Számlázás: CreditCard, Audit: FileText, Veszélyzóna: X,
}
const SHORT: Partial<Record<Capability, string>> = {
  'bookings.view': 'Foglalások megtekintése', 'bookings.manage': 'Foglalások kezelése',
  'schedule.view.own': 'Saját naptár — megtekintés', 'schedule.manage.own': 'Saját naptár — szerkesztés', 'schedule.manage': 'Teljes csapatnaptár kezelése',
  'guests.view': 'Vendégek megtekintése', 'guests.manage': 'Vendégek kezelése',
  'catalog.view': 'Megtekintés', 'catalog.manage': 'Kezelés', 'tables.view': 'Megtekintés', 'tables.manage': 'Kezelés',
  'availability.view': 'Megtekintés', 'availability.manage': 'Kezelés', 'vouchers.view': 'Megtekintés', 'vouchers.manage': 'Kezelés',
  'marketing.view': 'Megtekintés', 'marketing.manage': 'Kampány-küldés',
  'staff.view': 'Megtekintés', 'staff.manage': 'Kezelés', 'staff.salary': 'Mások fizetése',
  'analytics.view': 'Teljes cég', 'analytics.view.own': 'Saját', 'tips.view': 'Tippek', 'tips.manage': 'Tippek alkalmazása',
  'settings.own_profile': 'Saját profil', 'settings.profile': 'Üzleti beállítások', 'roles.view': 'Jogosultságok megtekintése',
  'team.view': 'Csapat megtekintése', 'team.manage': 'Meghívás / szerep', 'billing.manage': 'Előfizetés', 'payments.manage': 'Előleg / Stripe',
  'audit.view': 'Audit-napló', danger: 'Üzlet törlése',
}
const NOTIFY: ['off' | 'own' | 'all', string][] = [['off', 'Nem kér'], ['own', 'Csak a sajátjáról'], ['all', 'Az összesről']]

type Draft = { id: string | 'new'; name: string; desc: string; caps: Capability[]; notify: 'off' | 'own' | 'all' }
const draftOf = (r: RoleRow): Draft => ({ id: r.id, name: r.name, desc: r.description ?? '', caps: (r.capabilities ?? []).filter((c) => c !== 'overview.view'), notify: r.booking_notify_level ?? 'off' })

export function RolesManager({ variant, businessId, initialRoles, myCapabilities, isOwner = false, header, members = [] }: {
  variant: 'salon' | 'restaurant'
  businessId: string
  initialRoles: RoleRow[]
  myCapabilities: Capability[]
  /** Szerep-DEFINÍCIÓ szerkesztése owner-only (a szerver is) — más csak megtekinti (anti-eszkaláció). */
  isOwner?: boolean
  /** a nézet fejléce (cím + Tagok / Szerepek váltó) — a Beállítások adja */
  header?: React.ReactNode
  /** a tagok szerepenként (a szerep tagjainak avatarjai és száma) */
  members?: { roleId: string | null; owner?: boolean; name: string; img?: string | null }[]
}) {
  const templates = variant === 'salon' ? SALON_TEMPLATES : RESTAURANT_TEMPLATES
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles)
  const [selected, setSelected] = useState<string>(initialRoles[0]?.id ?? 'owner')
  const [draft, setDraft] = useState<Draft | null>(initialRoles[0] ? draftOf(initialRoles[0]) : null)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const metas = useMemo(() => CAPABILITY_META.filter((c) => c.value !== 'overview.view' && (!c.variant || c.variant === variant)), [variant])
  const ownerSel = selected === 'owner'
  const base = ownerSel ? null : selected === 'new' ? null : roles.find((r) => r.id === selected) ?? null
  const dirty = !!draft && (draft.id === 'new' || !base || JSON.stringify(draftOf(base)) !== JSON.stringify({ ...draft, caps: [...draft.caps] }))
  const changes = !draft || !base ? (draft?.id === 'new' ? 1 : 0) : (draft.name !== base.name ? 1 : 0) + (draft.desc !== (base.description ?? '') ? 1 : 0) + (draft.notify !== (base.booking_notify_level ?? 'off') ? 1 : 0)
    + metas.filter((m) => draft.caps.includes(m.value) !== (base.capabilities ?? []).includes(m.value)).length

  const caps = ownerSel ? metas.map((m) => m.value) : draft?.caps ?? []
  const groups: PermGroup[] = Object.entries(metas.reduce<Record<string, typeof metas>>((acc, c) => { (acc[c.group] ??= []).push(c); return acc }, {}))
    .map(([name, list]) => ({ name, icon: GROUP_ICON[name] ?? Shield, caps: list.map((c) => ({ value: c.value, label: SHORT[c.value] ?? c.label, on: caps.includes(c.value) })) }))
  // csak a saját jogainkon belül adhatunk (a szerver is szűr)
  const allowed = (c: Capability) => myCapabilities.includes(c)
  const toggle = (v: string) => setDraft((d) => (d ? { ...d, caps: d.caps.includes(v as Capability) ? d.caps.filter((x) => x !== v) : allowed(v as Capability) ? [...d.caps, v as Capability] : d.caps } : d))
  const toggleAll = (g: PermGroup, on: boolean) => setDraft((d) => (d ? { ...d, caps: on ? [...new Set([...d.caps, ...g.caps.map((c) => c.value as Capability).filter(allowed)])] : d.caps.filter((x) => !g.caps.some((c) => c.value === x)) } : d))

  const select = (id: string) => {
    setSelected(id)
    const r = roles.find((x) => x.id === id)
    setDraft(r ? draftOf(r) : null)
  }
  const fromTemplate = (name: string) => {
    const t = templates.find((x) => x.name === name)
    if (!t) return
    setSelected('new')
    setDraft({ id: 'new', name: t.name, desc: t.desc, caps: t.caps.filter((c) => c !== 'overview.view' && allowed(c)), notify: t.bookingNotifyLevel })
  }
  const newRole = () => { setSelected('new'); setDraft({ id: 'new', name: '', desc: '', caps: ['bookings.view'], notify: 'off' }) }

  const broadcast = (next: RoleRow[]) => window.dispatchEvent(new CustomEvent('davelopment:roles-changed', { detail: next.map((r) => ({ id: r.id, name: r.name })) }))
  async function save() {
    if (!draft) return
    const nm = draft.name.trim()
    if (!nm) { toast.error('Adj nevet a szerepnek'); return }
    setSaving(true)
    try {
      const isNew = draft.id === 'new'
      const payload = { name: nm, description: draft.desc.trim(), capabilities: draft.caps, booking_notify_level: draft.notify }
      const res = await fetch(isNew ? '/api/roles' : `/api/roles/${draft.id}`, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(isNew ? { type: variant, id: businessId, ...payload } : payload) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Nem sikerült menteni')
      const json = await res.json()
      const saved: RoleRow = { id: String((json?.doc ?? json).id), name: nm, description: draft.desc.trim(), capabilities: draft.caps, booking_notify_level: draft.notify }
      const next = isNew ? [...roles, saved] : roles.map((r) => (r.id === saved.id ? saved : r))
      setRoles(next); broadcast(next); setSelected(saved.id); setDraft(draftOf(saved))
      toast.success(isNew ? 'Szerep létrehozva' : 'Szerep mentve')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült menteni') } finally { setSaving(false) }
  }
  async function remove() {
    if (!base) return
    const res = await fetch(`/api/roles/${base.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    setConfirmDel(false)
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || 'Nem sikerült törölni'); return }
    const next = roles.filter((x) => x.id !== base.id)
    setRoles(next); broadcast(next); select(next[0]?.id ?? 'owner')
    toast.success('Szerep törölve')
  }

  const owners = members.filter((m) => m.owner)
  const list: RoleItem[] = [
    { id: 'owner', name: 'Tulajdonos', desc: 'Minden jog, nem szerkeszthető', members: owners.length || 1, locked: true },
    ...roles.map((r) => ({ id: r.id, name: r.name, desc: r.description ?? `${(r.capabilities ?? []).length} jogosultság`, members: members.filter((m) => m.roleId === r.id).length })),
    ...(selected === 'new' ? [{ id: 'new', name: draft?.name || 'Új szerep', desc: draft?.desc || 'még nincs mentve', members: 0 }] : []),
  ]
  const roleMembers = ownerSel ? owners : members.filter((m) => m.roleId === selected)
  const readOnly = ownerSel || !isOwner
  // a szerep foglalás-értesítése (a notifyOnBooking ezt nézi) — a jogcsoportok mellett, ugyanolyan kártyán
  const notifyCard = !ownerSel && draft && (
    <div className="rounded-ui-inner bg-ui-cell p-3.5">
      <span className="flex items-center gap-2 text-ui-body text-ui-text"><Bell className="h-4 w-4" strokeWidth={1.8} />Foglalás-értesítés</span>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {NOTIFY.map(([k, l]) => {
          const pill = <Pill tone={draft.notify === k ? 'dark' : 'white'} size="sm">{l}</Pill>
          return readOnly ? <span key={k}>{pill}</span> : <button key={k} type="button" aria-pressed={draft.notify === k} onClick={() => setDraft({ ...draft, notify: k })} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button>
        })}
      </div>
    </div>
  )

  return (
    <>
      <RolesEditor header={header} roles={list} selectedId={selected} onSelect={(id) => (id === 'new' ? undefined : select(id))}
        templates={isOwner ? templates.map((t) => t.name) : []} onTemplate={isOwner ? fromTemplate : undefined} onNew={isOwner ? newRole : undefined}
        name={ownerSel ? 'Tulajdonos' : draft?.name ?? ''} desc={ownerSel ? 'Minden jog, nem szerkeszthető' : draft?.desc ?? ''}
        onName={readOnly ? undefined : (v) => setDraft((d) => (d ? { ...d, name: v } : d))} onDesc={readOnly ? undefined : (v) => setDraft((d) => (d ? { ...d, desc: v } : d))}
        members={roleMembers.map((m) => ({ name: m.name, img: m.img }))}
        groups={groups} onToggle={toggle} onToggleAll={toggleAll} readOnly={readOnly} extra={notifyCard}
        onDelete={!readOnly && base ? () => setConfirmDel(true) : undefined}
        save={!readOnly && dirty ? { label: `${draft?.name.trim() || 'Új szerep'} · ${changes} módosítás`, onSave: () => void save(), onDiscard: () => (base ? select(base.id) : select(roles[0]?.id ?? 'owner')), busy: saving } : undefined} />
      <ConfirmDialog open={confirmDel} title={`„${base?.name ?? ''}” szerep törlése`} description="A szerephez rendelt tagok szerep nélkül maradnak (csak az alap belépőt kapják), amíg újat nem adsz nekik." confirmLabel="Törlés"
        onConfirm={() => void remove()} onCancel={() => setConfirmDel(false)} zIndexClass="z-[100]" />
    </>
  )
}
