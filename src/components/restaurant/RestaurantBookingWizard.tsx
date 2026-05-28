'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, addDays } from 'date-fns'
import { hu } from 'date-fns/locale'
import { toast } from 'sonner'
import { Minus, Plus, Loader2, Trees } from 'lucide-react'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'

const DAY_COUNT = 30

export function RestaurantBookingWizard({
  restaurantId,
  slug,
  requirePhone,
  maxPax,
  termsSections,
  company,
}: {
  restaurantId: string | number
  slug: string
  requirePhone: boolean
  maxPax: number
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date')
  const initialPax = Number(searchParams.get('pax'))
  const initialTime = searchParams.get('time')

  const [pax, setPax] = useState(initialPax >= 1 && initialPax <= maxPax ? initialPax : 2)
  const [date, setDate] = useState(() =>
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : format(new Date(), 'yyyy-MM-dd'),
  )
  const [slots, setSlots] = useState<{ start: string; end: string; onlyOutdoor?: boolean }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [time, setTime] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDays(new Date(), i))

  // Slot-lekérés ha pax vagy date változik
  useEffect(() => {
    let cancelled = false
    setTime(null)
    setLoadingSlots(true)
    const q = new URLSearchParams({ restaurantId: String(restaurantId), date, pax: String(pax) })
    fetch(`/api/restaurant/slots?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const next = d.slots ?? []
        setSlots(next)
        // A landingről érkező kívánt időpont előválasztása (csak ha még szabad)
        if (initialTime && next.some((s: { start: string }) => s.start === initialTime)) {
          setTime(initialTime)
        }
      })
      .catch(() => { if (!cancelled) setSlots([]) })
      .finally(() => { if (!cancelled) setLoadingSlots(false) })
    return () => { cancelled = true }
    // initialTime szándékosan kimarad: csak a date/pax váltás triggereli újra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, date, pax])

  const submit = async () => {
    if (!time) return
    if (name.trim().length < 2) return toast.error('Add meg a neved')
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Érvénytelen email cím')
    if (requirePhone && phone.trim().length < 7) return toast.error('A telefonszám megadása kötelező')

    setSubmitting(true)
    try {
      const res = await fetch('/api/restaurant/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId, date, start_time: time, pax,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Hiba')
      router.push(`/${slug}/book/success`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A foglalás sikertelen')
      setSubmitting(false)
    }
  }

  const cardClass = 'bg-white dark:bg-white/[0.04] border border-zinc-100 dark:border-white/[0.08] rounded-2xl p-5'
  const inputClass = 'w-full h-11 rounded-xl bg-zinc-50 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] px-4 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400'

  return (
    <div className="space-y-5">
      {/* Létszám */}
      <div className={cardClass}>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">Hányan jöttök?</p>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setPax((p) => Math.max(1, p - 1))}
            className="h-11 w-11 rounded-full border border-zinc-200 dark:border-white/[0.1] flex items-center justify-center text-zinc-700 dark:text-white/70 hover:border-zinc-400 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-3xl font-black tabular-nums text-zinc-900 dark:text-white w-16 text-center">{pax}</span>
          <button
            onClick={() => setPax((p) => Math.min(maxPax, p + 1))}
            className="h-11 w-11 rounded-full border border-zinc-200 dark:border-white/[0.1] flex items-center justify-center text-zinc-700 dark:text-white/70 hover:border-zinc-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dátum */}
      <div className={cardClass}>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">Mikor?</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((d) => {
            const ds = format(d, 'yyyy-MM-dd')
            const active = ds === date
            return (
              <button
                key={ds}
                onClick={() => setDate(ds)}
                className={`shrink-0 w-14 py-2 rounded-xl border text-center transition-colors ${
                  active
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                    : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-white/60 hover:border-zinc-400'
                }`}
              >
                <span className="block text-[10px] uppercase">{format(d, 'EEE', { locale: hu })}</span>
                <span className="block text-lg font-bold tabular-nums">{format(d, 'd')}</span>
                <span className="block text-[10px]">{format(d, 'MMM', { locale: hu })}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Időpont */}
      <div className={cardClass}>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">Időpont</p>
        {loadingSlots ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-white/30 text-center py-6">Erre a napra/létszámra nincs szabad időpont</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                onClick={() => setTime(s.start)}
                title={s.onlyOutdoor ? 'Erre az időpontra már csak teraszra (kültéri) foglalható' : undefined}
                className={`relative h-10 rounded-xl border text-sm font-medium tabular-nums transition-colors ${
                  time === s.start
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                    : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-white/70 hover:border-zinc-400'
                }`}
              >
                {s.start}
                {s.onlyOutdoor && (
                  <Trees className={`absolute right-1 top-1 h-2.5 w-2.5 ${time === s.start ? 'text-white/70 dark:text-black/60' : 'text-emerald-500'}`} />
                )}
              </button>
            ))}
          </div>
        )}
        {/* Felirat: ha a kiválasztott időpontra csak kültéri (terasz) asztal foglalható */}
        {time && slots.find((s) => s.start === time)?.onlyOutdoor && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Trees className="h-4 w-4 shrink-0" />
            Erre az időpontra a beltér megtelt — a foglalás teraszra (kültéri) szól.
          </div>
        )}
      </div>

      {/* Adatok */}
      {time && (
        <div className={`${cardClass} space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">Adataid</p>
          <input className={inputClass} placeholder="Teljes név" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass} type="email" placeholder="Email cím" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputClass} type="tel" placeholder={`Telefonszám${requirePhone ? '' : ' (opcionális)'}`} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <textarea className={`${inputClass} h-auto py-2.5 min-h-[72px] resize-none`} placeholder="Megjegyzés (opcionális)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Foglalás…</> : `Foglalás véglegesítése · ${pax} fő · ${time}`}
          </button>
          {((termsSections && termsSections.length > 0) || company) && (
            <p className="text-center text-xs text-zinc-400 dark:text-white/30">
              A foglalás véglegesítésével elfogadod a{' '}
              <TermsModal sections={termsSections} company={company} triggerClassName="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-white/60" />
            </p>
          )}
        </div>
      )}
    </div>
  )
}
