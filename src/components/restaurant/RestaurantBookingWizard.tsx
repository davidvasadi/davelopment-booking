'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Minus, Plus, Loader2, Trees, ArrowLeft } from 'lucide-react'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { HoverArrow } from '@/components/ui/HoverArrow'
import { DateStrip } from '@/components/booking/DateStrip'
import { staggerContainer, fadeUp, stepSlide, stepSlideTransition } from '@/lib/motion'
import { makeT, dfLocale, type Locale } from '@/lib/i18n'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

export function RestaurantBookingWizard({
  restaurantId,
  slug,
  requirePhone,
  maxPax,
  bookingWindowDays = 60,
  termsSections,
  company,
  locale = 'hu',
}: {
  restaurantId: string | number
  slug: string
  requirePhone: boolean
  maxPax: number
  bookingWindowDays?: number
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  locale?: Locale
}) {
  const router = useRouter()
  const tt = makeT(locale)
  const STEPS = [tt('rbooking.step.datetime'), tt('rbooking.step.details')]
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date')
  const initialPax = Number(searchParams.get('pax'))
  const initialTime = searchParams.get('time')

  const [step, setStep] = useState(0)
  // A lépés-átmenet iránya (+1 előre, -1 vissza) a slide-animációhoz.
  const [dir, setDir] = useState(1)
  const goStep = (next: number) => {
    setDir(next >= step ? 1 : -1)
    setStep(next)
  }

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
  const [country, setCountry] = useState('HU')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    if (name.trim().length < 2) return toast.error(tt('rbooking.err.name'))
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error(tt('rbooking.err.email'))
    if (requirePhone && phone.trim().length < 7) return toast.error(tt('rbooking.err.phone'))

    setSubmitting(true)
    try {
      const res = await fetch('/api/restaurant/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId, date, start_time: time, pax,
          customer_name: name.trim(),
          customer_email: email.trim(),
          // A teljes nemzetközi szám (előhívó + helyi), és az ország ISO-kódja külön.
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : undefined,
          country,
          notes: notes.trim() || undefined,
          locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? tt('rbooking.err.generic'))
      router.push(`/${slug}/book/success`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt('rbooking.err.generic'))
      setSubmitting(false)
    }
  }

  const cardClass = 'bg-white rounded-2xl shadow-sm p-5'
  const inputClass = 'w-full h-11 rounded-xl bg-zinc-50 border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400'

  const selectedDateObj = new Date(date + 'T00:00:00')

  return (
    <div>
      {/* Fejléc: vissza + lépés-cím + lépés-indikátor */}
      <div className="flex items-center gap-3 mb-5">
        {step > 0 ? (
          <button
            onClick={() => goStep(step - 1)}
            className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-10 w-10 shrink-0" />
        )}
        <div className="flex-1 text-center">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{tt("rbooking.header")}</p>
          <p className="text-sm font-bold text-zinc-900">{STEPS[step]}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 w-10 justify-end">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i < step ? 'h-1.5 w-1.5 rounded-full bg-zinc-950' :
                i === step ? 'h-1.5 w-5 rounded-full bg-zinc-950' :
                'h-1.5 w-1.5 rounded-full bg-zinc-300'
              }
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          variants={stepSlide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepSlideTransition}
          className="space-y-5"
        >
          {/* Step 0: Létszám + dátum + időpont (egy lapon, mint a szalon) */}
          {step === 0 && (
            <>
              <div className={cardClass}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">{tt("rbooking.partySize")}</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setPax((p) => Math.max(1, p - 1))}
                    className="h-11 w-11 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 hover:border-zinc-400 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-3xl font-black tabular-nums text-zinc-900 w-16 text-center">{pax}</span>
                  <button
                    onClick={() => setPax((p) => Math.min(maxPax, p + 1))}
                    className="h-11 w-11 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 hover:border-zinc-400 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className={cardClass}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">{tt("rbooking.when")}</p>
                <DateStrip selected={date} onChange={setDate} dayCount={bookingWindowDays} locale={locale} />
              </div>

              <div className={cardClass}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">{tt("rbooking.time")}</p>
                {loadingSlots ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">{tt("rbooking.noSlots")}</p>
                ) : (
                  <motion.div
                    key={`${date}-${slots.length}`}
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-4 sm:grid-cols-5 gap-2"
                  >
                    {slots.map((s) => (
                      <motion.button
                        key={s.start}
                        variants={fadeUp}
                        onClick={() => { setTime(s.start); goStep(1) }}
                        title={s.onlyOutdoor ? 'Erre az időpontra már csak teraszra (kültéri) foglalható' : undefined}
                        className={`relative h-10 rounded-xl border text-sm font-medium tabular-nums transition-colors ${
                          time === s.start
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                        }`}
                      >
                        {s.start}
                        {s.onlyOutdoor && (
                          <Trees className={`absolute right-1 top-1 h-2.5 w-2.5 ${time === s.start ? 'text-white/70' : 'text-emerald-500'}`} />
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            </>
          )}

          {/* Step 1: Adatok */}
          {step === 1 && (
            <>
              {/* Összegző kártya */}
              <div className="bg-zinc-950 rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-zinc-400 text-xs font-medium mb-1">{tt("rbooking.summary")}</p>
                  <p className="text-white font-black text-base">{tt('rbooking.guests', { n: pax })}</p>
                  <p className="text-zinc-400 text-xs mt-1">{format(selectedDateObj, 'MMM d.', { locale: dfLocale(locale) })} · {time}</p>
                </div>
                {time && slots.find((s) => s.start === time)?.onlyOutdoor && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1.5 text-xs font-medium shrink-0">
                    <Trees className="h-3.5 w-3.5" /> Terasz
                  </span>
                )}
              </div>

              <div className={`${cardClass} space-y-3`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{tt("rbooking.details")}</p>
                <input className={inputClass} placeholder={tt("rbooking.field.name")} value={name} onChange={(e) => setName(e.target.value)} />
                <input className={inputClass} type="email" placeholder={tt("rbooking.field.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
                <PhoneCountryInput
                  country={country}
                  phone={phone}
                  onCountryChange={setCountry}
                  onPhoneChange={setPhone}
                  required={requirePhone}
                  inputClass="h-11 rounded-xl bg-zinc-50 border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                />
                <textarea className={`${inputClass} h-auto py-2.5 min-h-[72px] resize-none`} placeholder={tt("rbooking.field.note")} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className="group w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{tt('rbooking.submitting')}</>
                ) : (
                  <>
                    {tt('rbooking.confirm')}
                    <HoverArrow className="h-4 w-4" />
                  </>
                )}
              </button>
              {((termsSections && termsSections.length > 0) || company) && (
                <div className="text-center text-xs text-zinc-400">
                  {tt('rbooking.termsPrefix')}{' '}
                  <TermsModal sections={termsSections} company={company} locale={locale} triggerClassName="underline underline-offset-2 hover:text-zinc-700" />
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
