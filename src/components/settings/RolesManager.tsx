'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X, Loader2, ShieldCheck } from 'lucide-react'
import { CAPABILITY_META, type Capability } from '@/lib/permissions'

/**
 * EGYEDI SZEREPEK (2. fázis) — a tulaj/vezető saját jogosultság-szerepeket hoz létre az üzletre
 * (pl. „Supervisor"), képesség-checkboxokkal. Anti-eszkaláció: csak a SAJÁT jogaidat oszthatod ki
 * (`myCapabilities`). A meghívásnál/tag-szerkesztésnél ezek a szerepek is választhatóak lesznek.
 */
export interface RoleRow {
  id: string
  name: string
  capabilities?: Capability[] | null
}

// A CAPABILITY_META csoportosítva (a checkbox-editorhoz).
const GROUPS = CAPABILITY_META.reduce<Record<string, typeof CAPABILITY_META>>((acc, c) => {
  ;(acc[c.group] ??= []).push(c)
  return acc
}, {})

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

  // Csak azokat a képességeket lehet kiosztani, amivel a felhasználó maga is rendelkezik.
  const grantable = new Set(myCapabilities)

  function openNew() {
    setEditing('new'); setName(''); setCaps(new Set())
  }
  function openEdit(r: RoleRow) {
    setEditing(r); setName(r.name); setCaps(new Set(r.capabilities ?? []))
  }
  function toggle(c: Capability) {
    setCaps((prev) => {
      const n = new Set(prev)
      n.has(c) ? n.delete(c) : n.add(c)
      return n
    })
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
      setRoles((prev) => (isNew ? [...prev, saved] : prev.map((r) => (r.id === saved.id ? saved : r))))
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
      setRoles((prev) => prev.filter((x) => x.id !== r.id))
      toast.success('Szerep törölve')
    } catch {
      toast.error('Nem sikerült törölni')
    } finally {
      setDeletingId(null)
    }
  }

  const capLabel = (c: Capability) => CAPABILITY_META.find((m) => m.value === c)?.label ?? c

  return (
    <div className="rounded-[26px] p-5 lg:p-6 dav-card-glass">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/20 text-ink-dark">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[17px] font-medium text-ink">Egyedi szerepek</div>
            <div className="text-[12.5px] text-ink-soft">Saját jogosultság-szerepek az üzletedhez (a beépítettek mellé).</div>
          </div>
        </div>
        {editing === null && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-dav-pill bg-ink-dark px-3.5 py-2 text-[13px] font-semibold text-white">
            <Plus className="h-4 w-4 text-gold" /> Új szerep
          </button>
        )}
      </div>

      {/* Lista */}
      {editing === null && (
        <div className="mt-4 space-y-[5px]">
          {roles.length === 0 && (
            <div className="py-6 text-center text-[13px] text-ink-soft">Még nincs egyedi szerep. Hozz létre egyet (pl. „Supervisor").</div>
          )}
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white/60 px-4 py-3 border border-line">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{r.name}</div>
                <div className="mt-0.5 truncate text-[12px] text-ink-soft">
                  {(r.capabilities ?? []).length ? (r.capabilities ?? []).map(capLabel).join(' · ') : 'Nincs jog kiválasztva'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-ink-soft hover:bg-black/5" aria-label="Szerkesztés"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(r)} disabled={deletingId === r.id} className="rounded-lg p-2 text-bad hover:bg-bad/10" aria-label="Törlés">
                  {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Szerkesztő */}
      {editing !== null && (
        <div className="mt-4">
          <label className="block text-[13px] font-medium text-ink mb-1.5">Szerep neve</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Supervisor"
            className="h-[46px] w-full rounded-[14px] bg-white border border-line-strong px-3.5 text-ink placeholder:text-ink-soft2/60 focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60"
          />

          <div className="mt-4 text-[13px] font-medium text-ink">Jogosultságok</div>
          <div className="mt-2 space-y-3">
            {Object.entries(GROUPS).map(([group, items]) => (
              <div key={group}>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{group}</div>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map((c) => {
                    const can = grantable.has(c.value)
                    const on = caps.has(c.value)
                    return (
                      <button
                        key={c.value}
                        type="button"
                        disabled={!can}
                        onClick={() => toggle(c.value)}
                        className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[13px] transition-colors ${
                          on ? 'border-gold/60 bg-gold/15 text-ink' : can ? 'border-line bg-white/60 text-ink hover:border-line-strong' : 'border-line bg-black/[0.03] text-ink-soft2/50 cursor-not-allowed'
                        }`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${on ? 'border-gold bg-gold text-ink-dark' : 'border-line-strong'}`}>
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {c.label}
                        {!can && <span className="ml-auto text-[10px]">(nincs jogod)</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-dav-pill bg-ink-dark px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-gold" />} Mentés
            </button>
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-dav-pill border border-line-strong bg-white px-4 py-2 text-[13px] font-semibold text-ink">
              <X className="h-4 w-4" /> Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
