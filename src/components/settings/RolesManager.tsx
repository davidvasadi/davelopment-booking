'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Check, X, Loader2, ShieldCheck, ShieldAlert,
  LayoutDashboard, CalendarDays, CalendarRange, MapPin, Briefcase, Armchair,
  Users, BarChart2, Settings, Shield, CreditCard, AlertTriangle, ScrollText,
  ChevronRight, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { CAPABILITY_META, type Capability } from '@/lib/permissions'

export interface RoleRow {
  id: string
  name: string
  capabilities?: Capability[] | null
}

// ── ELŐRE DEFINIÁLT SABLONOK ──────────────────────────────────────────────────

type RoleTemplate = {
  id: string
  name: string
  icon: LucideIcon
  desc: string
  caps: Capability[]
}

const SALON_TEMPLATES: RoleTemplate[] = [
  {
    id: 'manager',
    name: 'Üzletvezető',
    icon: Briefcase,
    desc: 'Teljes üzletirányítás — analitika, csapat, beállítások, audit',
    caps: [
      'overview.view', 'analytics.view',
      'bookings.view', 'bookings.manage',
      'schedule.manage',
      'guests.view', 'guests.manage',
      'catalog.view', 'catalog.manage',
      'staff.view', 'staff.manage',
      'settings.profile', 'team.view', 'audit.view',
    ],
  },
  {
    id: 'receptionist',
    name: 'Recepcionista',
    icon: CalendarDays,
    desc: 'Foglalások + vendégek kezelése, szolgáltatások megtekintése',
    caps: [
      'overview.view',
      'bookings.view', 'bookings.manage',
      'guests.view', 'guests.manage',
      'catalog.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
  },
  {
    id: 'stylist',
    name: 'Stylist / Szakember',
    icon: Shield,
    desc: 'Saját naptár szerkesztése + foglalások megtekintése (önálló időbeosztás)',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.manage.own',
      'settings.own_profile',
    ],
  },
  {
    id: 'assistant',
    name: 'Asszisztens',
    icon: Users,
    desc: 'Saját naptár megtekintése és profil szerkesztése',
    caps: [
      'overview.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
  },
]

const RESTAURANT_TEMPLATES: RoleTemplate[] = [
  {
    id: 'manager',
    name: 'Üzletvezető',
    icon: Briefcase,
    desc: 'Teljes üzletirányítás — analitika, csapat, beállítások, audit',
    caps: [
      'overview.view', 'analytics.view',
      'bookings.view', 'bookings.manage',
      'schedule.manage',
      'guests.view', 'guests.manage',
      'tables.view', 'tables.manage',
      'staff.view', 'staff.manage',
      'settings.profile', 'team.view', 'audit.view',
    ],
  },
  {
    id: 'scheduler',
    name: 'Beosztásvezető',
    icon: CalendarRange,
    desc: 'Teljes csapatnaptár kezelése, munkatársak és foglalások megtekintése',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.manage',
      'staff.view',
      'tables.view',
      'settings.own_profile',
    ],
  },
  {
    id: 'head_waiter',
    name: 'Főpincér',
    icon: BarChart2,
    desc: 'Foglalások és vendégek kezelése, asztalok megtekintése, saját naptár',
    caps: [
      'overview.view',
      'bookings.view', 'bookings.manage',
      'guests.view',
      'tables.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
  },
  {
    id: 'waiter',
    name: 'Felszolgáló',
    icon: Users,
    desc: 'Foglalások megtekintése, saját naptár (olvasás) és profil',
    caps: [
      'overview.view',
      'bookings.view',
      'schedule.view.own',
      'settings.own_profile',
    ],
  },
]

// ── Csoport-ikonok ─────────────────────────────────────────────────────────────

const GROUP_ICON: Record<string, LucideIcon> = {
  Alap:             LayoutDashboard,
  Foglalás:         CalendarDays,
  Naptár:           CalendarRange,
  Vendégek:         MapPin,
  Szolgáltatások:   Briefcase,
  Asztalok:         Armchair,
  Munkatársak:      Users,
  Statisztika:      BarChart2,
  Beállítások:      Settings,
  Csapat:           Shield,
  Számlázás:        CreditCard,
  Veszélyzóna:      AlertTriangle,
  Audit:            ScrollText,
}

const DANGER_GROUPS = new Set(['Veszélyzóna'])

// Csoportok variant-szűréssel: szalon nem látja az Asztalokat, étterem nem látja a Szolgáltatásokat.
function buildGroups(variant: 'salon' | 'restaurant') {
  return CAPABILITY_META
    .filter((c) => !c.variant || c.variant === variant)
    .reduce<Record<string, typeof CAPABILITY_META>>((acc, c) => {
      ;(acc[c.group] ??= []).push(c)
      return acc
    }, {})
}

const CHIP_LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025, delayChildren: 0.04 } },
}
const CHIP_ITEM = {
  hidden: { opacity: 0, scale: 0.92, y: 4 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

// ─────────────────────────────────────────────────────────────────────────────

export function RolesManager({
  variant,
  businessId,
  initialRoles,
  myCapabilities,
}: {
  variant: 'salon' | 'restaurant'
  businessId: string
  initialRoles: RoleRow[]
  myCapabilities: Capability[]
}) {
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles)
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null)
  const [name, setName] = useState('')
  const [caps, setCaps] = useState<Set<Capability>>(new Set())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const grantable = new Set(myCapabilities)
  const templates = variant === 'salon' ? SALON_TEMPLATES : RESTAURANT_TEMPLATES
  const groups = buildGroups(variant)

  function openNew() { setEditing('new'); setName(''); setCaps(new Set()) }
  function openEdit(r: RoleRow) { setEditing(r); setName(r.name); setCaps(new Set(r.capabilities ?? [])) }

  function applyTemplate(t: RoleTemplate) {
    setName(t.name)
    setCaps(new Set(t.caps.filter((c) => grantable.has(c))))
  }

  function toggle(c: Capability) {
    setCaps((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  }

  async function save() {
    const nm = name.trim()
    if (!nm) { toast.error('Adj nevet a szerepnek'); return }
    setSaving(true)
    try {
      const capabilities = Array.from(caps)
      const isNew = editing === 'new'
      const res = await fetch(isNew ? '/api/roles' : `/api/roles/${(editing as RoleRow).id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(isNew ? { type: variant, id: businessId, name: nm, capabilities } : { name: nm, capabilities }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: RoleRow = { id: String((json?.doc ?? json).id), name: nm, capabilities }
      const next = isNew ? [...roles, saved] : roles.map((r) => (r.id === saved.id ? saved : r))
      setRoles(next)
      window.dispatchEvent(new CustomEvent('davelopment:roles-changed', { detail: next.map((r) => ({ id: r.id, name: r.name })) }))
      setEditing(null)
      toast.success(isNew ? 'Szerep létrehozva' : 'Szerep frissítve')
    } catch {
      toast.error('Nem sikerült menteni')
    } finally {
      setSaving(false)
    }
  }

  async function remove(r: RoleRow) {
    setDeletingId(r.id)
    try {
      const res = await fetch(`/api/roles/${r.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      const next = roles.filter((x) => x.id !== r.id)
      setRoles(next)
      window.dispatchEvent(new CustomEvent('davelopment:roles-changed', { detail: next.map((x) => ({ id: x.id, name: x.name })) }))
      toast.success('Szerep törölve')
    } catch {
      toast.error('Nem sikerült törölni')
    } finally {
      setDeletingId(null)
    }
  }

  const selectedCount = caps.size
  const isEditorNew = editing === 'new'
  const editorTitle = isEditorNew ? 'Új szerep' : (editing as RoleRow | null)?.name ?? ''

  return (
    <div className="rounded-[26px] p-5 lg:p-6 dav-card-glass">

      {/* Fejléc */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/20 text-ink-dark">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[17px] font-semibold text-ink">Egyedi szerepek</div>
            <div className="text-[12.5px] text-ink-soft">Saját jogosultságok az üzletedhez</div>
          </div>
        </div>
        {editing === null && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-dav-pill bg-ink-dark px-3.5 py-2 text-[13px] font-semibold text-white">
            <Plus className="h-4 w-4 text-gold" strokeWidth={2.5} />
            Új szerep
          </button>
        )}
        {editing !== null && (
          <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-dav-pill border border-line bg-white/80 px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:border-line-strong">
            <X className="h-3.5 w-3.5" />
            Mégse
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Szerep-lista ── */}
        {editing === null && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            className="mt-4"
          >
            {roles.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-line bg-white/40 py-8 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-ink-soft2/50" strokeWidth={1.5} />
                <div className="mt-2 text-[13px] font-medium text-ink-soft">Még nincs egyedi szerep</div>
                <div className="mt-0.5 text-[12px] text-ink-soft2">Hozz létre egyet sablonból vagy nulláról</div>
              </div>
            ) : (
              <div className="space-y-[5px]">
                {roles.map((r) => {
                  const capCount = (r.capabilities ?? []).length
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="group flex items-center gap-3 rounded-[18px] border border-line bg-white/70 px-4 py-3.5 transition-colors hover:bg-white/90"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F4F2EC]">
                        <Shield className="h-[18px] w-[18px] text-ink-soft" strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-ink">{r.name}</div>
                        <div className="mt-0.5">
                          {capCount === 0 ? (
                            <span className="text-[11.5px] text-ink-soft2">Nincs jog kiválasztva</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-ink-dark">
                              <Check className="h-3 w-3 text-gold" strokeWidth={2.5} />
                              {capCount} jogosultság
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(r)} title="Szerkesztés" className="flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-soft hover:bg-black/[0.06] hover:text-ink">
                          <Pencil className="h-[15px] w-[15px]" />
                        </button>
                        <button onClick={() => remove(r)} disabled={deletingId === r.id} title="Törlés" className="flex h-8 w-8 items-center justify-center rounded-[10px] text-bad hover:bg-bad/10 disabled:opacity-40">
                          {deletingId === r.id ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Trash2 className="h-[15px] w-[15px]" />}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Szerkesztő ── */}
        {editing !== null && (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
            className="mt-4 space-y-5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-dark/[0.07]">
                {isEditorNew ? <Plus className="h-[14px] w-[14px] text-ink-soft" strokeWidth={2.5} /> : <Pencil className="h-[14px] w-[14px] text-ink-soft" />}
              </div>
              <span className="text-[13px] font-semibold text-ink">
                {isEditorNew ? 'Új szerep létrehozása' : `Szerkesztés: ${editorTitle}`}
              </span>
            </div>

            {/* ── Sablon-kártyák (csak új szerkesztésnél) ── */}
            {isEditorNew && (
              <div>
                <div className="mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Sablon alapján (ajánlott)
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {templates.map((t) => {
                    const Icon = t.icon
                    const grantedCaps = t.caps.filter((c) => grantable.has(c))
                    const isSelected = name === t.name
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={[
                          'flex items-start gap-3 rounded-[16px] border p-3.5 text-left transition-all',
                          isSelected
                            ? 'border-ink-dark/30 bg-ink-dark/[0.04] ring-1 ring-ink-dark/10'
                            : 'border-line bg-white hover:border-line-strong hover:bg-[#fafaf8]',
                        ].join(' ')}
                      >
                        <div
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gold/15"
                        >
                          <Icon className="h-4 w-4 text-ink-dark" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-ink">{t.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} />}
                          </div>
                          <div className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{t.desc}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.caps.slice(0, 4).map((c) => {
                              const meta = CAPABILITY_META.find((m) => m.value === c)
                              const ok = grantable.has(c)
                              return meta ? (
                                <span key={c} className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${ok ? 'bg-gold/15 text-ink-dark' : 'bg-black/[0.04] text-ink-soft2/50 line-through'}`}>
                                  {meta.label}
                                </span>
                              ) : null
                            })}
                            {t.caps.length > 4 && (
                              <span className="rounded-full bg-[#F0EEE8] px-1.5 py-0.5 text-[9.5px] font-semibold text-ink-soft">
                                +{t.caps.length - 4} jog
                              </span>
                            )}
                          </div>
                          {grantedCaps.length < t.caps.length && (
                            <div className="mt-1 text-[10px] text-ink-soft2">
                              {t.caps.length - grantedCaps.length} jog a te hatáskörödön kívül esik
                            </div>
                          )}
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-soft2/50" />
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 border-t border-line" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft2">vagy nulláról</span>
                  <div className="flex-1 border-t border-line" />
                </div>
              </div>
            )}

            {/* Név mező */}
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold uppercase tracking-wide text-ink-soft">
                Szerep neve
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Supervisor, Csapatvezető"
                className="h-[46px] w-full rounded-[14px] border border-line-strong bg-white px-3.5 text-[14px] text-ink placeholder:text-ink-soft2/50 focus-visible:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25"
              />
            </div>

            {/* Jogosultság-chipek */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-soft">
                  Jogosultságok
                </label>
                {selectedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-ink-dark">
                    <Check className="h-3 w-3 text-gold" strokeWidth={2.5} />
                    {selectedCount} kiválasztva
                  </span>
                )}
              </div>

              <motion.div variants={CHIP_LIST} initial="hidden" animate="show" className="space-y-4">
                {Object.entries(groups).map(([group, items]) => {
                  const Icon = GROUP_ICON[group] ?? Shield
                  const isDanger = DANGER_GROUPS.has(group)
                  return (
                    <motion.div key={group} variants={CHIP_ITEM}>
                      <div className="mb-2 flex items-center gap-1.5">
                        <Icon className={`h-[13px] w-[13px] ${isDanger ? 'text-bad' : 'text-ink-soft2'}`} strokeWidth={2} />
                        <span className={`text-[10.5px] font-bold uppercase tracking-[0.08em] ${isDanger ? 'text-bad' : 'text-ink-soft2'}`}>
                          {group}
                        </span>
                        <div className="flex-1 border-t border-line" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {items.map((c) => {
                          const canGrant = grantable.has(c.value)
                          const isOn = caps.has(c.value)
                          return (
                            <button
                              key={c.value}
                              type="button"
                              disabled={!canGrant}
                              onClick={() => toggle(c.value)}
                              className={[
                                'inline-flex items-center gap-1.5 rounded-[11px] border px-3 py-[7px] text-[12.5px] font-medium transition-all',
                                isOn
                                  ? 'border-transparent bg-ink-dark text-white shadow-sm'
                                  : canGrant
                                  ? 'border-line bg-white text-ink hover:border-line-strong hover:bg-[#fafaf8]'
                                  : 'cursor-not-allowed border-line/50 bg-black/[0.02] text-ink-soft2/40',
                              ].join(' ')}
                            >
                              {isOn && <Check className="h-[13px] w-[13px] shrink-0 text-gold" strokeWidth={2.5} />}
                              {c.label}
                              {!canGrant && <span className="ml-0.5 text-[10px] text-ink-soft2/50">✕</span>}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>

            {/* Mentés */}
            <div className="flex items-center gap-2 border-t border-line pt-4">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-dav-pill bg-ink-dark px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-gold" strokeWidth={2.5} />}
                {saving ? 'Mentés…' : 'Mentés'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-1.5 rounded-dav-pill border border-line-strong bg-white px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-[#f8f7f4]"
              >
                <X className="h-4 w-4" />
                Mégse
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
