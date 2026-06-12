'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, UtensilsCrossed, Clock, Loader2 } from 'lucide-react'

type Pricing = { salon_pro_huf: number; restaurant_pro_huf: number; trial_days: number }

export default function PricingForm({ initial }: { initial: Pricing }) {
  const router = useRouter()
  const [salonPro, setSalonPro] = useState(String(initial.salon_pro_huf))
  const [restaurantPro, setRestaurantPro] = useState(String(initial.restaurant_pro_huf))
  const [trialDays, setTrialDays] = useState(String(initial.trial_days))
  const [saving, setSaving] = useState(false)

  const dirty =
    salonPro !== String(initial.salon_pro_huf) ||
    restaurantPro !== String(initial.restaurant_pro_huf) ||
    trialDays !== String(initial.trial_days)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/backstage/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salon_pro_huf: Number(salonPro),
          restaurant_pro_huf: Number(restaurantPro),
          trial_days: Number(trialDays),
        }),
      })
      if (!res.ok) throw new Error('save')
      toast.success('Árazás mentve')
      router.refresh()
    } catch {
      toast.error('Nem sikerült menteni az árazást.')
    } finally {
      setSaving(false)
    }
  }

  const cardBase = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl'

  const fields = [
    { id: 'salon_pro', icon: Building2, label: 'Szalon Pro havidíj', suffix: 'Ft / hó', value: salonPro, set: setSalonPro, hint: 'A szalon Pro csomag havi ára.' },
    { id: 'restaurant_pro', icon: UtensilsCrossed, label: 'Étterem Pro havidíj', suffix: 'Ft / hó', value: restaurantPro, set: setRestaurantPro, hint: 'Az étterem Pro csomag havi ára.' },
    { id: 'trial_days', icon: Clock, label: 'Próbaidőszak', suffix: 'nap', value: trialDays, set: setTrialDays, hint: 'Az ingyenes próbaidőszak hossza új regisztrációknál.' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-white/40">Kattints egy mezőbe és írd át az értéket, majd <span className="font-semibold text-zinc-700 dark:text-white/70">Árazás mentése</span>.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {fields.map(f => (
          <div key={f.label} className={`${cardBase} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                <f.icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              </span>
              <label htmlFor={f.id} className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/30">{f.label}</label>
            </div>
            {/* Látható, szerkeszthető input-keret: fókuszra gyűrű, a mértékegység a kereten belül. */}
            <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-white/[0.02] px-3 focus-within:border-zinc-900 dark:focus-within:border-white/40 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:ring-white/10 transition-colors">
              <input
                id={f.id}
                type="number"
                min={0}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="w-full bg-transparent py-2.5 text-zinc-900 dark:text-white font-black text-2xl tracking-tight leading-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 shrink-0 pl-2">{f.suffix}</span>
            </div>
            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-2">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Mentés…' : 'Árazás mentése'}
        </button>
        {dirty && !saving && <span className="text-xs text-amber-500">Nem mentett változás</span>}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] px-4 py-3">
        <p className="text-xs text-zinc-500 dark:text-white/40 leading-relaxed">
          <span className="font-semibold text-zinc-700 dark:text-white/70">Hogyan érvényesül:</span> az árváltozás azonnal
          látszik a publikus árazásban és az új előfizetéseken. A <span className="font-semibold">már fizető ügyfelek</span> a
          jelenlegi időszakuk végéig a régi áron maradnak, a ciklus megújulásakor (vagy újraaktiváláskor) lépnek át az új árra.
        </p>
      </div>
    </div>
  )
}
