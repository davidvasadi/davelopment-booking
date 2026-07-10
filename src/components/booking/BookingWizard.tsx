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
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { makeT, dfLocale, type Locale } from '@/lib/i18n'

import { format } from 'date-fns'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

type Slot = { start: string; end: string }

interface WizardState {
  serviceId: string | null
  staffId: string | null
  date: string
  slot: Slot | null
  name: string
  email: string
  phone: string
  country: string
  city: string
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
    name: '', email: '', phone: '', country: 'HU', city: '', notes: '',
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
          // A teljes nemzetközi szám (előhívó + helyi) — így a vendég-analitika/térkép az
          // országot is kiolvassa (isoFromPhone). Üres számnál marad üres (a szerver validál).
          customer_phone: state.phone.trim()
            ? `${DIAL_BY_CODE[state.country] ?? ''} ${state.phone.trim()}`.trim()
            : '',
          customer_city: state.city.trim() || undefined,
          notes: state.notes, locale,
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
    <div className="font-onest min-h-screen bg-paper px-4 py-4 text-ink sm:px-6 sm:py-6">
     <div
       className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl flex-col rounded-[34px] p-1 shadow-[0_34px_70px_-34px_rgba(80,70,30,.20),0_0_0_1px_rgba(120,110,70,.06)] sm:min-h-[calc(100vh-3rem)]"
       style={{ background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
     >

      {/* Header */}
      <header className="px-5 pb-4 pt-8">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button
            onClick={() => {
              if (step === 0) router.push(`/${salonSlug}`)
              else if (step === 2 && state.staffId !== null && preselectedStaffId) goStep(0)
              else goStep(step - 1)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.08)] transition-colors hover:bg-paper"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-[12px] font-medium text-ink-soft">{salonName}</p>
            <p className="text-[14px] font-semibold text-ink">{STEPS[step]}</p>
          </div>
          <div className="h-10 w-10" />
        </div>

        {/* Step dots */}
        <div className="mx-auto mt-4 flex max-w-lg items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all',
                i < step ? 'h-1.5 w-1.5 bg-ink-dark' :
                i === step ? 'h-1.5 w-5 bg-ink-dark' :
                'h-1.5 w-1.5 bg-black/15'
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
            <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink mb-1 whitespace-pre-line">{tt('booking.service.title')}</h2>
            <p className="text-[13.5px] text-ink-soft mb-6">{tt('booking.service.subtitle')}</p>
            <div className="space-y-3">
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => { set({ serviceId: s.id, slot: null }); goStep(1) }}
                  className={cn(
                    'w-full rounded-[20px] bg-white p-5 text-left shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)] transition-all hover:shadow-[0_1px_2px_rgba(80,70,30,0.06),0_20px_44px_-28px_rgba(80,70,30,0.28)]',
                    state.serviceId === s.id ? 'ring-2 ring-gold' : ''
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ink">{s.name}</p>
                      {s.description && <p className="mt-1 line-clamp-2 text-[12px] text-ink-soft">{s.description}</p>}
                      <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-soft">
                        <Clock className="h-3 w-3" />{s.duration_minutes} {tt('booking.minutes')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[16px] font-semibold text-ink">{formatPrice(s.price, s.currency)}</p>
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
            <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink mb-1 whitespace-pre-line">{tt('booking.staff.title')}</h2>
            <p className="text-[13.5px] text-ink-soft mb-6">{tt('booking.staff.subtitle')}</p>

            {/* Any staff card */}
            <button
              onClick={() => { set({ staffId: null, slot: null }); goStep(2) }}
              className={cn(
                'mb-3 flex w-full items-center gap-4 rounded-[20px] bg-white p-5 text-left shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)] transition-all hover:shadow-[0_20px_44px_-28px_rgba(80,70,30,0.28)]',
                state.staffId === null ? 'ring-2 ring-gold' : ''
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper">
                <User className="h-5 w-5 text-ink-soft" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-ink">{tt("booking.staff.any")}</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">{tt("booking.staff.anyHint")}</p>
              </div>
              {state.staffId === null && <Check className="ml-auto h-4 w-4 shrink-0 text-ink" />}
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
                      'relative aspect-[4/5] overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)] transition-all hover:shadow-[0_20px_44px_-28px_rgba(80,70,30,0.28)]',
                      isSelected ? 'ring-2 ring-gold' : ''
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
            <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink mb-1 whitespace-pre-line">{tt('booking.when.title')}</h2>
            <p className="text-[13.5px] text-ink-soft mb-6">{tt('booking.when.subtitle')}</p>

            {/* Date strip */}
            <div className="mb-4 rounded-[20px] border border-white/50 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-28px_rgba(80,70,30,0.22)] backdrop-blur-[22px] backdrop-saturate-[0.4]">
              <DateStrip
                selected={state.date}
                onChange={(d) => set({ date: d, slot: null })}
                dayCount={bookingWindowDays}
                locale={locale}
              />
            </div>

            {/* Time slots */}
            <div className="rounded-[20px] border border-white/50 bg-white/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-28px_rgba(80,70,30,0.22)] backdrop-blur-[22px] backdrop-saturate-[0.4]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                {format(selectedDate, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}
              </p>
              {loadingSlots ? (
                <div className="flex items-center justify-center gap-2 py-8 text-ink-soft">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{tt("booking.loading")}</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13.5px] text-ink-soft">{tt("booking.noSlots")}</p>
                  <p className="mt-1 text-[12px] text-ink-soft2">{tt("booking.noSlotsHint")}</p>
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
                        'rounded-[12px] py-3 text-[14px] font-semibold transition-colors',
                        state.slot?.start === slot.start
                          ? 'bg-ink-dark text-white'
                          : 'bg-paper/50 text-ink hover:bg-paper/80'
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
            <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink mb-1">{tt("booking.details.title")}</h2>
            <p className="text-[13.5px] text-ink-soft mb-6">{tt("booking.details.subtitle")}</p>

            {/* Booking summary card */}
            <div className="mb-5 flex items-start justify-between gap-3 rounded-[20px] bg-ink-dark p-5">
              <div>
                <p className="mb-1 text-[11px] font-medium text-white/50">{tt("booking.summary")}</p>
                <p className="text-[16px] font-semibold text-white">{selectedService?.name}</p>
                <p className="mt-1 text-[12px] text-white/55">
                  {selectedStaff ? selectedStaff.name : tt('booking.staff.any')} · {format(selectedDate, 'MMM d.', { locale: dfLocale(locale) })} · {state.slot?.start}
                </p>
              </div>
              {selectedService && (
                <div className="shrink-0 text-right">
                  <p className="text-[18px] font-semibold text-gold">{formatPrice(selectedService.price, selectedService.currency)}</p>
                  <p className="text-[12px] text-white/45">{selectedService.duration_minutes} perc</p>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-[20px] border border-white/50 bg-white/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-28px_rgba(80,70,30,0.22)] backdrop-blur-[22px] backdrop-saturate-[0.4]">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{tt("booking.field.name")}</Label>
                <Input
                  value={state.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder={tt("booking.field.namePlaceholder")}
                  className="h-12 rounded-[12px] bg-paper/50 border-0 text-[14px] font-medium text-ink placeholder:text-ink-soft2 focus-visible:ring-1 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{tt("booking.field.email")}</Label>
                <Input
                  type="email"
                  value={state.email}
                  onChange={e => set({ email: e.target.value })}
                  placeholder={tt("booking.field.emailPlaceholder")}
                  className="h-12 rounded-[12px] bg-paper/50 border-0 text-[14px] font-medium text-ink placeholder:text-ink-soft2 focus-visible:ring-1 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{tt('booking.field.phone')}{requirePhone ? ' *' : ''}</Label>
                <PhoneCountryInput
                  country={state.country}
                  phone={state.phone}
                  onCountryChange={(code) => set({ country: code })}
                  onPhoneChange={(p) => set({ phone: p })}
                  required={requirePhone}
                  inputClass="h-12 rounded-[12px] bg-paper/50 border-0 px-3 text-[14px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{tt('booking.field.city')}</Label>
                <Input
                  value={state.city}
                  onChange={e => set({ city: e.target.value })}
                  placeholder={tt('booking.field.cityPlaceholder')}
                  className="h-12 rounded-[12px] bg-paper/50 border-0 text-[14px] font-medium text-ink placeholder:text-ink-soft2 focus-visible:ring-1 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{tt("booking.field.note")}</Label>
                <Textarea
                  value={state.notes}
                  onChange={e => set({ notes: e.target.value })}
                  placeholder={tt("booking.field.notePlaceholder")}
                  rows={3}
                  className="rounded-[12px] bg-paper/50 border-0 text-[14px] font-medium text-ink placeholder:text-ink-soft2 resize-none focus-visible:ring-1 focus-visible:ring-gold"
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
              <div className="mt-3 text-center text-[12px] text-ink-soft">
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
                className="flex h-14 w-full items-center justify-between rounded-[16px] bg-ink-dark px-6 text-[14px] font-semibold text-white shadow-[0_16px_38px_-22px_rgba(30,28,25,.7)] transition-opacity hover:opacity-90"
              >
                <span>{selectedService?.name}</span>
                <span className="flex items-center gap-2 text-white/50">
                  {selectedService && formatPrice(selectedService.price, selectedService.currency)} <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <div className="flex h-14 w-full items-center justify-center rounded-[16px] bg-black/[0.06]">
                <p className="text-[13.5px] font-medium text-ink-soft2">{tt("booking.cta.pickService")}</p>
              </div>
            )
          )}
          {step === 1 && (
            <button
              onClick={() => goStep(2)}
              className="flex h-14 w-full items-center justify-between rounded-[16px] bg-ink-dark px-6 text-[14px] font-semibold text-white shadow-[0_16px_38px_-22px_rgba(30,28,25,.7)] transition-opacity hover:opacity-90"
            >
              <span>{state.staffId === null ? tt('booking.staff.any') : selectedStaff?.name}</span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </button>
          )}
          {step === 2 && (
            state.slot ? (
              <button
                onClick={() => goStep(3)}
                className="flex h-14 w-full items-center justify-between rounded-[16px] bg-ink-dark px-6 text-[14px] font-semibold text-white shadow-[0_16px_38px_-22px_rgba(30,28,25,.7)] transition-opacity hover:opacity-90"
              >
                <span>{format(selectedDate, 'MMM d.', { locale: dfLocale(locale) })} · {state.slot.start}</span>
                <ChevronRight className="h-4 w-4 text-white/50" />
              </button>
            ) : (
              <div className="flex h-14 w-full items-center justify-center rounded-[16px] bg-black/[0.06]">
                <p className="text-[13.5px] font-medium text-ink-soft2">{tt("booking.cta.pickSlot")}</p>
              </div>
            )
          )}
      </div>
      )}
     </div>
    </div>
  )
}
