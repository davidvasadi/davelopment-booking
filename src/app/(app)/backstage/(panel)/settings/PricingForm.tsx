'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, UtensilsCrossed, Clock, Percent, Users, Loader2 } from 'lucide-react'

type Pricing = {
  salon_pro_huf: number
  salon_extra_staff_huf: number
  restaurant_pro_huf: number
  annual_discount_pct: number
  trial_days: number
}

export default function PricingForm({ initial }: { initial: Pricing }) {
  const router = useRouter()
  const [salonBase, setSalonBase] = useState(String(initial.salon_pro_huf))
  const [salonExtra, setSalonExtra] = useState(String(initial.salon_extra_staff_huf))
  const [restaurantFee, setRestaurantFee] = useState(String(initial.restaurant_pro_huf))
  const [annualDiscount, setAnnualDiscount] = useState(String(initial.annual_discount_pct))
  const [trialDays, setTrialDays] = useState(String(initial.trial_days))
  const [saving, setSaving] = useState(false)

  const dirty =
    salonBase !== String(initial.salon_pro_huf) ||
    salonExtra !== String(initial.salon_extra_staff_huf) ||
    restaurantFee !== String(initial.restaurant_pro_huf) ||
    annualDiscount !== String(initial.annual_discount_pct) ||
    trialDays !== String(initial.trial_days)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/backstage/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salon_pro_huf: Number(salonBase),
          salon_extra_staff_huf: Number(salonExtra),
          restaurant_pro_huf: Number(restaurantFee),
          annual_discount_pct: Number(annualDiscount),
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

  const fields = [
    { id: 'salon_base', icon: Building2, label: 'Szalon alapdíj', suffix: 'Ft / hó', value: salonBase, set: setSalonBase, hint: 'A szalon havi alapdíja (a normál csomag). Ehhez jön minden extra munkatárs.' },
    { id: 'salon_extra', icon: Users, label: 'Szalon — extra munkatárs', suffix: 'Ft / fő', value: salonExtra, set: setSalonExtra, hint: 'Az elsőn felüli minden munkatárs/naptár ennyivel növeli a szalon havidíját.' },
    { id: 'restaurant_fee', icon: UtensilsCrossed, label: 'Étterem havidíj', suffix: 'Ft / hó', value: restaurantFee, set: setRestaurantFee, hint: 'Az étterem havi fix ára (a normál csomag).' },
    { id: 'annual_discount', icon: Percent, label: 'Éves kedvezmény', suffix: '%', value: annualDiscount, set: setAnnualDiscount, hint: 'Éves fizetésnél ennyivel olcsóbb az effektív havidíj.' },
    { id: 'trial_days', icon: Clock, label: 'Próbaidőszak', suffix: 'nap', value: trialDays, set: setTrialDays, hint: 'Az ingyenes próbaidőszak hossza új regisztrációknál.' },
  ]

  return (
    <div className="space-y-4 font-onest">
      <p className="text-[13.5px] text-ink-soft">Kattints egy mezőbe és írd át az értéket, majd <span className="font-semibold text-ink">Árazás mentése</span>.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {fields.map(f => (
          <div key={f.label} className="rounded-[24px] p-5 dav-card-glass">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-9 w-9 rounded-[13px] bg-gold/20 flex items-center justify-center shrink-0">
                <f.icon className="h-4 w-4 text-ink-dark" />
              </span>
              <label htmlFor={f.id} className="text-[12px] font-medium text-ink-soft">{f.label}</label>
            </div>
            {/* Szerkeszthető input-keret: fókuszra erős keret, a mértékegység a kereten belül. */}
            <div className="flex items-center rounded-[22px] border border-line bg-white px-[18px] focus-within:border-line-strong transition-colors">
              <input
                id={f.id}
                type="number"
                min={0}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="w-full bg-transparent py-2.5 text-ink font-light text-[26px] tracking-[-0.02em] leading-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[13.5px] font-semibold text-ink-soft shrink-0 pl-2">{f.suffix}</span>
            </div>
            <p className="text-ink-soft text-[12px] mt-2">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-[22px] bg-ink-dark px-[18px] py-[11px] text-[13.5px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
          {saving ? 'Mentés…' : 'Árazás mentése'}
        </button>
        {dirty && !saving && <span className="text-[12px] font-medium text-[#7A6A2E]">Nem mentett változás</span>}
      </div>

      <div className="rounded-[16px] border border-line bg-white px-4 py-3">
        <p className="text-[12px] text-ink-soft leading-relaxed">
          <span className="font-semibold text-ink">Hogyan érvényesül:</span> az árváltozás azonnal
          látszik a publikus árazásban és az új előfizetéseken. A <span className="font-semibold text-ink">már fizető ügyfelek</span> a
          jelenlegi időszakuk végéig a régi áron maradnak, a ciklus megújulásakor (vagy újraaktiváláskor) lépnek át az új árra.
        </p>
      </div>
    </div>
  )
}
