'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { staggerContainer, fadeUp, stepSlide, stepSlideTransition } from '@/lib/motion'
import type { Service, StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ArrowLeft, Check, Clock, Loader2, ChevronRight, User } from 'lucide-react'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import { BookCtaButton } from '@/components/booking/BookCtaButton'
import { DateStrip } from '@/components/booking/DateStrip'
import { makeT, dfLocale, type Locale } from '@/lib/i18n'

import { format } from 'date-fns'

type Slot = { start: string; end: string }

interface WizardState {
  serviceId: string | null
  staffId: string | null
  date: string
  slot: Slot | null
  name: string
  email: string
  phone: string
  notes: string
}

interface Props {
  salonId: string
  salonSlug: string
  salonName: string
  requirePhone?: boolean
  bookingWindowDays?: number
  services: Service[]
  staff: StaffMember[]
  preselectedServiceId?: string | null
  preselectedStaffId?: string | null
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  locale?: Locale
}

export default function BookingWizard({
  salonId, salonSlug, salonName, requirePhone = true, bookingWindowDays = 60, services, staff, preselectedServiceId, preselectedStaffId, termsSections, company, locale = 'hu',
}: Props) {
  const router = useRouter()
  const tt = makeT(locale)
  const [step, setStep] = useState(preselectedServiceId ? 1 : 0)
  // A lépés-átmenet iránya (+1 előre, -1 vissza) a slide-animációhoz.
  const [dir, setDir] = useState(1)
  const goStep = (next: number) => {
    setDir(next >= step ? 1 : -1)
    setStep(next)
  }
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [state, setState] = useState<WizardState>({
    serviceId: preselectedServiceId ?? null,
    staffId: preselectedStaffId ?? null,
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: null,
    name: '', email: '', phone: '', notes: '',
  })

  const set = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  const selectedService = services.find(s => String(s.id) === String(state.serviceId))
  const selectedStaff = staff.find(m => String(m.id) === String(state.staffId))
  const selectedDate = new Date(state.date + 'T00:00:00')

  useEffect(() => {
    if (step !== 2 || !state.serviceId || !state.date) return
    setLoadingSlots(true)
    setSlots([])
    const params = new URLSearchParams({
      salonId, serviceId: state.serviceId, date: state.date,
      ...(state.staffId ? { staffId: state.staffId } : {}),
    })
    fetch(`/api/slots?${params}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => toast.error(tt('booking.err.slots')))
      .finally(() => setLoadingSlots(false))
  }, [step, state.serviceId, state.staffId, state.date, salonId])

  const submit = async () => {
    if (!state.serviceId || !state.slot || !state.staffId) return
    if (!state.name || state.name.length < 2) { toast.error(tt('booking.err.name')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) { toast.error(tt('booking.err.email')); return }
    if (requirePhone && state.phone.replace(/\s/g, '').length < 7) { toast.error(tt('booking.err.phone')); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId, serviceId: state.serviceId, staffId: state.staffId,
          date: state.date, start_time: state.slot.start, end_time: state.slot.end,
          customer_name: state.name, customer_email: state.email,
          customer_phone: state.phone, notes: state.notes, locale,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? tt('booking.err.generic'))
      }
      const params = new URLSearchParams({
        name: state.name, service: selectedService?.name ?? '',
        date: state.date, time: state.slot.start,
      })
      router.push(`/${salonSlug}/book/success?${params}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tt('booking.err.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const STEPS = [tt('booking.step.service'), tt('booking.step.staff'), tt('booking.step.datetime'), tt('booking.step.details')]

  return (
    <div className="min-h-screen bg-[#F5F4F2] flex flex-col">

      {/* Header */}
      <header className="bg-[#F5F4F2] px-5 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 0) router.push(`/${salonSlug}`)
              else if (step === 2 && state.staffId !== null && preselectedStaffId) goStep(0)
              else goStep(step - 1)
            }}
            className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs text-zinc-400 font-medium">{salonName}</p>
            <p className="text-sm font-bold text-zinc-900">{STEPS[step]}</p>
          </div>
          <div className="h-10 w-10" />
        </div>

        {/* Step dots */}
        <div className="max-w-lg mx-auto flex items-center gap-1.5 justify-center mt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all',
                i < step ? 'h-1.5 w-1.5 bg-zinc-950' :
                i === step ? 'h-1.5 w-5 bg-zinc-950' :
                'h-1.5 w-1.5 bg-zinc-300'
              )}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-5 pt-2 pb-4">
       <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          variants={stepSlide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepSlideTransition}
          className="space-y-4"
        >

        {/* Step 0: Service */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1 whitespace-pre-line">{tt('booking.service.title')}</h2>
            <p className="text-sm text-zinc-500 mb-6">{tt('booking.service.subtitle')}</p>
            <div className="space-y-3">
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => { set({ serviceId: s.id, slot: null }); goStep(1) }}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl shadow-sm p-5 transition-all hover:shadow-md',
                    state.serviceId === s.id ? 'ring-2 ring-zinc-950' : ''
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-zinc-900">{s.name}</p>
                      {s.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{s.description}</p>}
                      <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{s.duration_minutes} {tt('booking.minutes')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-black text-base text-zinc-900">{formatPrice(s.price, s.currency)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Staff */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1 whitespace-pre-line">{tt('booking.staff.title')}</h2>
            <p className="text-sm text-zinc-500 mb-6">{tt('booking.staff.subtitle')}</p>

            {/* Any staff card */}
            <button
              onClick={() => { set({ staffId: null, slot: null }); goStep(2) }}
              className={cn(
                'w-full text-left bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 mb-3 transition-all hover:shadow-md',
                state.staffId === null ? 'ring-2 ring-zinc-950' : ''
              )}
            >
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-zinc-900">{tt("booking.staff.any")}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{tt("booking.staff.anyHint")}</p>
              </div>
              {state.staffId === null && <Check className="h-4 w-4 text-zinc-950 ml-auto shrink-0" />}
            </button>

            {/* Staff grid cards */}
            <div className="grid grid-cols-2 gap-3">
              {staff.map(m => {
                const avatarUrl = m.avatar && typeof m.avatar === 'object'
                  ? (m.avatar as Media).url ?? null : null
                const isSelected = state.staffId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { set({ staffId: m.id, slot: null }); goStep(2) }}
                    className={cn(
                      'relative bg-white rounded-2xl shadow-sm overflow-hidden aspect-[4/5] transition-all hover:shadow-md',
                      isSelected ? 'ring-2 ring-zinc-950' : ''
                    )}
                  >
                    {/* Photo or placeholder */}
                    <div className="absolute inset-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={m.name} className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className="h-full w-full bg-zinc-500 flex items-center justify-center">
                          <span className="h-16 w-16 rounded-full bg-zinc-600/40 flex items-center justify-center">
                            <User className="h-8 w-8 text-white/80" />
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Arrow badge */}
                    <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                      {isSelected
                        ? <Check className="h-3.5 w-3.5 text-zinc-950" />
                        : <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                      }
                    </div>
                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white font-bold text-sm leading-tight">{m.name}</p>
                      {m.bio && <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{m.bio}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Date + Time */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1 whitespace-pre-line">{tt('booking.when.title')}</h2>
            <p className="text-sm text-zinc-500 mb-6">{tt('booking.when.subtitle')}</p>

            {/* Date strip */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <DateStrip
                selected={state.date}
                onChange={(d) => set({ date: d, slot: null })}
                dayCount={bookingWindowDays}
                locale={locale}
              />
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
                {format(selectedDate, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}
              </p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-zinc-400 py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{tt("booking.loading")}</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">{tt("booking.noSlots")}</p>
                  <p className="text-xs text-zinc-400 mt-1">{tt("booking.noSlotsHint")}</p>
                </div>
              ) : (
                <motion.div
                  key={`${state.date}-${slots.length}`}
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-4 gap-2"
                >
                  {slots.map((slot) => (
                    <motion.button
                      key={slot.start}
                      variants={fadeUp}
                      onClick={() => { set({ slot }); goStep(3) }}
                      className={cn(
                        'py-3 rounded-xl text-sm font-bold transition-colors',
                        state.slot?.start === slot.start
                          ? 'bg-zinc-950 text-white shadow-md'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      )}
                    >
                      {slot.start}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Customer info */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1">{tt("booking.details.title")}</h2>
            <p className="text-sm text-zinc-500 mb-6">{tt("booking.details.subtitle")}</p>

            {/* Booking summary card */}
            <div className="bg-zinc-950 rounded-2xl p-5 mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-zinc-400 text-xs font-medium mb-1">{tt("booking.summary")}</p>
                <p className="text-white font-black text-base">{selectedService?.name}</p>
                <p className="text-zinc-400 text-xs mt-1">
                  {selectedStaff ? selectedStaff.name : tt('booking.staff.any')} · {format(selectedDate, 'MMM d.', { locale: dfLocale(locale) })} · {state.slot?.start}
                </p>
              </div>
              {selectedService && (
                <div className="text-right shrink-0">
                  <p className="text-white font-black text-lg">{formatPrice(selectedService.price, selectedService.currency)}</p>
                  <p className="text-zinc-500 text-xs">{selectedService.duration_minutes} perc</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{tt("booking.field.name")}</Label>
                <Input
                  value={state.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder={tt("booking.field.namePlaceholder")}
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{tt("booking.field.email")}</Label>
                <Input
                  type="email"
                  value={state.email}
                  onChange={e => set({ email: e.target.value })}
                  placeholder={tt("booking.field.emailPlaceholder")}
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{tt('booking.field.phone')}{requirePhone ? ' *' : ''}</Label>
                <Input
                  type="tel"
                  value={state.phone}
                  onChange={e => set({ phone: e.target.value })}
                  placeholder={tt("booking.field.phonePlaceholder")}
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{tt("booking.field.note")}</Label>
                <Textarea
                  value={state.notes}
                  onChange={e => set({ notes: e.target.value })}
                  placeholder={tt("booking.field.notePlaceholder")}
                  rows={3}
                  className="rounded-xl bg-zinc-50 border-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 resize-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
            </div>

            {/* Véglegesítő gomb — a tartalom végén (NEM sticky). Közös BookCtaButton. */}
            <BookCtaButton
              label={tt("booking.confirm")}
              onClick={submit}
              disabled={submitting || !state.name || !state.email || (requirePhone && !state.phone)}
              loading={submitting}
              className="mt-5"
            />
            {((termsSections && termsSections.length > 0) || company) && (
              <div className="mt-3 text-center text-xs text-zinc-400">
                {tt('booking.termsPrefix')}{' '}
                <TermsModal sections={termsSections} company={company} locale={locale} triggerClassName="underline underline-offset-2 hover:text-zinc-700" />
              </div>
            )}
          </div>
        )}
        </motion.div>
       </AnimatePresence>
      </div>

      {/* CTA — normál folyásban a tartalom végén (a step 3 gombja a tartalom belsejében van) */}
      {step !== 3 && (
      <div className="max-w-lg mx-auto w-full px-5 pb-10">
          {step === 0 && (
            state.serviceId ? (
              <button
                onClick={() => goStep(state.staffId !== null ? 2 : 1)}
                className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
              >
                <span>{selectedService?.name}</span>
                <span className="flex items-center gap-2 text-zinc-400">
                  {selectedService && formatPrice(selectedService.price, selectedService.currency)} <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl bg-zinc-200 flex items-center justify-center">
                <p className="text-sm text-zinc-400 font-medium">{tt("booking.cta.pickService")}</p>
              </div>
            )
          )}
          {step === 1 && (
            <button
              onClick={() => goStep(2)}
              className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
            >
              <span>{state.staffId === null ? tt('booking.staff.any') : selectedStaff?.name}</span>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </button>
          )}
          {step === 2 && (
            state.slot ? (
              <button
                onClick={() => goStep(3)}
                className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
              >
                <span>{format(selectedDate, 'MMM d.', { locale: dfLocale(locale) })} · {state.slot.start}</span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl bg-zinc-200 flex items-center justify-center">
                <p className="text-sm text-zinc-400 font-medium">{tt("booking.cta.pickSlot")}</p>
              </div>
            )
          )}
      </div>
      )}
    </div>
  )
}
