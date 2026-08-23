'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { PlaceKind } from '@/lib/backstagePlaces'

const TIER_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'egyedi', label: 'Egyedi' },
] as const

/** Csomag (Starter/Pro/Egyedi) + Egyedi csomagnál a megegyezés szerinti havidíj szerkesztése —
 *  admin-only, a `PlaceDetailSheet`-be ágyazva (szalon ÉS étterem is ide fut). Mentéskor a
 *  fiók-előfizetés díja azonnal szinkronizálódik a szerveren (lásd a toggle route-ok
 *  `syncAccountSubscription`-hívását). */
export default function TierEditor({
  kind, placeId, initialTier, initialCustomFeeHuf, onSaved,
}: {
  kind: PlaceKind
  placeId: string
  initialTier: string
  initialCustomFeeHuf: number | null
  /** A mentés utáni friss előfizetés-adatokért (a sheet ekkor újratölti a részleteket). */
  onSaved?: () => void
}) {
  const [tier, setTier] = useState(initialTier)
  const [customFee, setCustomFee] = useState(initialCustomFeeHuf != null ? String(initialCustomFeeHuf) : '')
  const [saving, setSaving] = useState(false)

  const dirty = tier !== initialTier || customFee !== (initialCustomFeeHuf != null ? String(initialCustomFeeHuf) : '')
  const endpoint = kind === 'restaurant' ? `/api/backstage/restaurants/${placeId}/toggle` : `/api/backstage/salons/${placeId}/toggle`

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          custom_monthly_fee_huf: tier === 'egyedi' && customFee.trim() !== '' ? Number(customFee) : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Csomag mentve')
      onSaved?.()
    } catch {
      toast.error('Nem sikerült menteni a csomagot.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {TIER_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTier(t.value)}
            className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${tier === t.value ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tier === 'egyedi' && (
        <div>
          <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Egyedi havidíj (Ft)</label>
          <input
            type="number"
            min={0}
            value={customFee}
            onChange={(e) => setCustomFee(e.target.value)}
            placeholder="Amíg nincs megadva: Pro-ár a becslés-alap"
            className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
          />
        </div>
      )}

      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-[16px] bg-ink-dark px-[16px] py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Mentés...' : 'Csomag mentése'}
        </button>
      )}
    </div>
  )
}
