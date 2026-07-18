'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { LogIn, ChevronDown, Power, PlayCircle, PauseCircle, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react'
import { popItem } from '@/lib/motion'
import type { SubStatus } from '@/lib/backstageMetrics'

const POP_PANEL = {
  hidden: { opacity: 0, scale: 0.9, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.035, delayChildren: 0.03 } },
  exit: { opacity: 0, scale: 0.94, y: -4, transition: { duration: 0.12, ease: 'easeIn' as const } },
}

const STATUS_ACTIONS: { value: SubStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'active', label: 'Aktív', icon: CheckCircle2 },
  { value: 'trialing', label: 'Próbaidőszak', icon: PlayCircle },
  { value: 'paused', label: 'Szüneteltetés', icon: PauseCircle },
  { value: 'past_due', label: 'Lejárt fizetés', icon: XCircle },
  { value: 'canceled', label: 'Megszakítás', icon: XCircle },
]

function AccountActions({ ownerId, status, plan, anyActive, hasSub }: {
  ownerId: string
  status: SubStatus | null
  plan: string | null
  anyActive: boolean
  hasSub: boolean
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/backstage/accounts/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('patch')
      toast.success(successMsg)
      router.refresh()
    } catch {
      toast.error('A művelet nem sikerült.')
    } finally {
      setBusy(false)
      setMenuOpen(false)
    }
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      const res = await fetch(`/api/backstage/accounts/${ownerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      toast.success('Fiók törölve.')
      router.push('/backstage/accounts')
    } catch {
      toast.error('A törlés nem sikerült.')
      setBusy(false)
      setDeleteArmed(false)
    }
  }

  async function setStatus(next: SubStatus) {
    // Ha fizetőre állítjuk és nincs plan vagy trial a plan, a plant is paid-re visszük.
    const body: Record<string, unknown> = { status: next }
    if (next === 'active' && plan !== 'paid') body.plan = 'paid'
    if (next === 'trialing') body.plan = 'trial'
    await patch(body, 'Előfizetés-státusz frissítve')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Impersonate */}
      <form method="POST" action="/api/backstage/session-as" target="_blank">
        <input type="hidden" name="userId" value={ownerId} />
        <button type="submit" className="flex items-center gap-1.5 rounded-[22px] bg-paper px-[16px] py-[11px] text-[13px] font-semibold text-ink transition-colors hover:bg-line-strong">
          <LogIn className="h-3.5 w-3.5 text-ink-soft" /> Belépés fiókként
        </button>
      </form>

      {/* Bulk aktiválás / deaktiválás */}
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ is_active: !anyActive }, anyActive ? 'Üzletek deaktiválva' : 'Üzletek aktiválva')}
        className="flex items-center gap-1.5 rounded-[22px] bg-paper px-[16px] py-[11px] text-[13px] font-semibold text-ink transition-colors hover:bg-line-strong disabled:opacity-50"
      >
        <Power className="h-3.5 w-3.5 text-ink-soft" /> {anyActive ? 'Összes deaktiválása' : 'Összes aktiválása'}
      </button>

      {/* Státusz-váltó popover */}
      {hasSub && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-[22px] bg-ink-dark px-[16px] py-[11px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> : <span className="h-2 w-2 rounded-full bg-gold" />}
            Státusz módosítása
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                variants={POP_PANEL}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ transformOrigin: 'top right' }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[210px] overflow-hidden rounded-[18px] border border-[#ececec] bg-white p-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)]"
              >
                {STATUS_ACTIONS.map(({ value, label, icon: Icon }) => (
                  <motion.button
                    key={value}
                    variants={popItem}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setStatus(value) }}
                    className={`flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-left text-[13px] transition-colors ${status === value ? 'bg-ink-dark font-semibold text-white' : 'font-medium text-[#3a352a] hover:bg-[#f4f4f5] hover:text-ink'}`}
                  >
                    <Icon className={`h-[17px] w-[17px] ${status === value ? 'text-gold' : 'text-[#8a8779]'}`} />
                    {label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* Fiók törlése */}
      {deleteArmed ? (
        <button
          type="button"
          disabled={busy}
          onClick={deleteAccount}
          className="flex items-center gap-1.5 rounded-[22px] bg-red-600 px-[16px] py-[11px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Biztos vagy benne?
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setDeleteArmed(true)}
          onBlur={() => setTimeout(() => setDeleteArmed(false), 2000)}
          className="flex items-center gap-1.5 rounded-[22px] border border-red-200 bg-white px-[16px] py-[11px] text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Fiók törlése
        </button>
      )}
    </div>
  )
}

/** Belső jegyzet szerkesztő az előfizetéshez. Külön nevesített export (a szerver-komponens
 *  a statikus `AccountActions.Notes` propertyt nem tudná feloldani a kliens-határon). */
export function AccountNotes({ ownerId, initialNotes, disabled }: { ownerId: string; initialNotes: string; disabled?: boolean }) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = notes !== initialNotes

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/backstage/accounts/${ownerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('save')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      toast.error('A jegyzet mentése nem sikerült.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={3}
        disabled={disabled}
        placeholder={disabled ? 'Nincs előfizetés — nem menthető jegyzet.' : 'Belső megjegyzés az adminnak…'}
        className="w-full resize-none rounded-[16px] border border-line bg-white px-[14px] py-3 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:border-line-strong focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={save}
        disabled={saving || disabled || !dirty}
        className="mt-2 inline-flex items-center gap-2 rounded-[16px] bg-ink-dark px-[16px] py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
        {saving ? 'Mentés…' : saved ? 'Mentve ✓' : 'Jegyzet mentése'}
      </button>
    </div>
  )
}

export default AccountActions
