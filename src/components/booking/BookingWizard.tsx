'use client'

import { useState, useEffect, useRef } from 'react'
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
import { ArrowLeft, Check, ChevronRight, Clock, Loader2, MapPin, Scissors, Users, User, Info } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { iconByKey } from '@/components/settings/goodToKnowIcons'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import { DateStrip } from '@/components/booking/DateStrip'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
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
  salonCity?: string
  salonLogoUrl?: string
  coverImageUrl?: string
  availableLocales?: Locale[]
  requirePhone?: boolean
  bookingWindowDays?: number
  services: Service[]
  staff: StaffMember[]
  preselectedServiceId?: string | null
  preselectedStaffId?: string | null
  termsSections?: { title?: string | null; body?: string | null }[] | null
  goodToKnow?: { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  locale?: Locale
}

export default function BookingWizard({
  salonId, salonSlug, salonName, salonCity, salonLogoUrl, coverImageUrl, availableLocales = ['hu'], requirePhone = true, bookingWindowDays = 60, services, staff, preselectedServiceId, preselectedStaffId, termsSections, goodToKnow, company, locale = 'hu',
}: Props) {
  const hasCover = !!coverImageUrl
  const router = useRouter()
  const tt = makeT(locale)
  // Ha mindkét érték preset: serviceId+staffId → rögtön dátum-lépés (2)
  // Ha csak serviceId preset: staff-választás (1)
  // Ha semmi: szolgáltatás-lista (0)
  const [step, setStep] = useState(
    preselectedServiceId && preselectedStaffId ? 2 : preselectedServiceId ? 1 : 0
  )
  // Service detail sub-view a step 0-ban (ha be van állítva, a service részletei látszanak)
  const [detailSvcId, setDetailSvcId] = useState<string | null>(null)
  // A lépés-átmenet iránya (+1 előre, -1 vissza) a slide-animációhoz.
  const [dir, setDir] = useState(1)
  const goStep = (next: number) => {
    setDir(next >= step ? 1 : -1)
    setStep(next)
  }
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [state, setState] = useState<WizardState>({
    serviceId: preselectedServiceId ?? null,
    staffId: preselectedStaffId ?? null,
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: null,
    name: '', email: '', phone: '', country: 'HU', city: '', notes: '',
  })

  const set = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  // ── Mező-szintű validáció (checklist §8: error-placement, inline-validation, focus-management) ──
  type FieldKey = 'name' | 'email' | 'phone'
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
  }

  /** Egy mező validációja; visszaadja a hibaszöveget vagy null-t. */
  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return !state.name || state.name.trim().length < 2 ? tt('booking.err.name') : null
    if (key === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email) ? tt('booking.err.email') : null
    if (key === 'phone') return requirePhone && state.phone.replace(/\s/g, '').length < 7 ? tt('booking.err.phone') : null
    return null
  }

  /** Blur-validálás: csak akkor jelöl hibát, ha a user már elhagyta a mezőt (nem gépelés közben). */
  const onFieldBlur = (key: FieldKey) => {
    const msg = validateField(key)
    setErrors(prev => ({ ...prev, [key]: msg ?? undefined }))
  }

  /** Gépelés közben a meglévő hibát töröljük (a checklist szerint ne piszkáljuk gépelés közben). */
  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const selectedService = services.find(s => String(s.id) === String(state.serviceId))
  const selectedStaff = staff.find(m => String(m.id) === String(state.staffId))

  // Step 0 detail sub-view
  const detailSvc = detailSvcId ? (services.find(s => String(s.id) === detailSvcId) ?? null) : null
  const detailSvcImgUrl = detailSvc?.image && typeof detailSvc.image === 'object'
    ? (detailSvc.image as Media).url ?? null : null
  const detailServiceStaff = detailSvc
    ? (() => {
        const ids = (detailSvc.staff ?? []).map(sm =>
          String(typeof sm === 'string' || typeof sm === 'number' ? sm : (sm as StaffMember).id)
        )
        return ids.length > 0 ? staff.filter(m => ids.includes(String(m.id))) : []
      })()
    : []
  const selectedDate = new Date(state.date + 'T00:00:00')

  const loadSlots = () => {
    if (!state.serviceId || !state.date) return
    setLoadingSlots(true)
    setSlotsError(false)
    setSlots([])
    const params = new URLSearchParams({
      salonId, serviceId: state.serviceId, date: state.date,
      ...(state.staffId ? { staffId: state.staffId } : {}),
    })
    fetch(`/api/slots?${params}`)
      .then(r => { if (!r.ok) throw new Error('slots'); return r.json() })
      .then(d => setSlots(d.slots ?? []))
      // A hibát a nézetben, retry-gombbal kezeljük (checklist §8: error-recovery, timeout-feedback),
      // nem eltűnő toasttal.
      .catch(() => setSlotsError(true))
      .finally(() => setLoadingSlots(false))
  }

  useEffect(() => {
    if (step !== 2) return
    loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state.serviceId, state.staffId, state.date, salonId])

  const submit = async () => {
    if (!state.serviceId || !state.slot || !state.staffId) return

    // Minden mezőt validálunk; a hibákat a mezők alá tesszük, és az ELSŐ hibás mezőre
    // ugrunk fókusszal (checklist §8: focus-management, error-placement).
    const order: FieldKey[] = ['name', 'email', 'phone']
    const nextErrors: Partial<Record<FieldKey, string>> = {}
    for (const key of order) {
      const msg = validateField(key)
      if (msg) nextErrors[key] = msg
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstBad = order.find(k => nextErrors[k])
      if (firstBad) fieldRefs[firstBad].current?.focus()
      return
    }

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

  // Ha a szakember előre ki van választva, a staff lépést kihagyjuk a haladásból
  const skipStaff = !!preselectedStaffId
  const displaySteps = skipStaff
    ? [tt('booking.step.service'), tt('booking.step.datetime'), tt('booking.step.details'), tt('booking.step.summary')]
    : [tt('booking.step.service'), tt('booking.step.staff'), tt('booking.step.datetime'), tt('booking.step.details'), tt('booking.step.summary')]
  // Belső step (0-4) → megjelenítési index (kihagyva a staff lépés ha skipStaff)
  const displayStep = skipStaff && step >= 2 ? step - 1 : step

  // Ha szakember előre van választva, csak az ő szolgáltatásait mutatjuk a 0. lépésben
  const visibleServices = skipStaff
    ? services.filter(s => s.staff?.some(sm => String(typeof sm === 'string' ? sm : (sm as StaffMember).id) === String(preselectedStaffId)))
    : services

  // Step 1-ben csak a kiválasztott service-hez rendelt szakemberek jelennek meg — nincs fallback,
  // mert akkor hibásan foglalhatnának olyan szakemberhez aki nem végzi a szolgáltatást.
  const staffIdsForService = (selectedService?.staff ?? []).map(sm =>
    String(typeof sm === 'string' || typeof sm === 'number' ? sm : (sm as StaffMember).id)
  )
  const visibleStaff = staffIdsForService.length > 0
    ? staff.filter(m => staffIdsForService.includes(String(m.id)))
    : staff

  const ctaEnabled = step === 0 ? !!state.serviceId : step === 1 ? true : step === 2 ? !!state.slot : step === 3 ? !!(state.name && state.email && (!requirePhone || state.phone)) : true

  const handleCTA = () => {
    if (step === 4) { submit(); return }
    if (step === 3) {
      const order: FieldKey[] = ['name', 'email', 'phone']
      const nextErrors: Partial<Record<FieldKey, string>> = {}
      for (const key of order) {
        const msg = validateField(key)
        if (msg) nextErrors[key] = msg
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors)
        const firstBad = order.find(k => nextErrors[k])
        if (firstBad) fieldRefs[firstBad].current?.focus()
        return
      }
      goStep(4)
      return
    }
    if (step === 0 && state.serviceId) goStep(skipStaff ? 2 : 1)
    else if (step === 1) goStep(2)
    else if (step === 2 && state.slot) goStep(3)
  }

  return (
    <div
      className="font-onest min-h-[100dvh] relative overflow-hidden"
      style={hasCover ? { background: '#111' } : { background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
    >
      {/* Cover image + overlay */}
      {coverImageUrl && (
        <>
          <img src={coverImageUrl} alt="" aria-hidden className="absolute inset-0 z-0 h-full w-full object-cover" />
          <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0.42) 100%)' }} />
        </>
      )}

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-5 py-4 lg:px-8 lg:py-5">
        <div className="flex items-center gap-3">
          <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-6 lg:h-7" />
          {salonLogoUrl && (
            <>
              <div className={`h-4 w-px ${hasCover ? 'bg-white/20' : 'bg-ink/10'}`} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={salonLogoUrl} alt={salonName} className="h-7 w-7 rounded-[8px] object-cover ring-1 ring-black/10" />
            </>
          )}
        </div>
        <div className="hidden items-center gap-5 lg:flex">
          <div className="flex items-center gap-2">
            <Scissors className={`h-[15px] w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
            <span className={`text-base font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{services.length}</span>
            <span className={`text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{tt('booking.step.service')}</span>
          </div>
          <div className={`h-4 w-px ${hasCover ? 'bg-white/15' : 'bg-ink/12'}`} />
          <div className="flex items-center gap-2">
            <Users className={`h-[15px] w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
            <span className={`text-base font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{staff.length}</span>
            <span className={`text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{tt('booking.step.staff')}</span>
          </div>
        </div>
        <LangSwitcher current={locale} available={availableLocales} />
      </nav>

      {/* Szalon neve + next slot pill — desktop, bal alul */}
      <div className="absolute bottom-10 left-8 z-20 hidden lg:block">
        <h1 className={`text-[3rem] font-light tracking-[-0.02em] leading-none mb-2 ${hasCover ? 'text-white' : 'text-ink'}`}>{salonName}</h1>
        {salonCity && (
          <p className={`flex items-center gap-1.5 text-sm mb-4 ${hasCover ? 'text-white/55' : 'text-ink/45'}`}>
            <MapPin className="h-3.5 w-3.5" />{salonCity}
          </p>
        )}
        {services.length > 0 && (
          <HeroNextSlot
            slug={salonSlug}
            locale={locale}
            source={{ kind: 'salon', id: salonId, serviceId: services[0].id }}
          />
        )}
      </div>

      {/* Booking kártya — mobile: bottom sheet, desktop: jobb oldali lebegő */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:absolute lg:right-8 lg:top-1/2 lg:bottom-auto lg:left-auto lg:w-[460px] lg:-translate-y-1/2">
        <div
          className="flex flex-col overflow-hidden rounded-t-[28px] lg:rounded-[24px]"
          style={{
            height: 'min(82dvh, calc(100dvh - 48px))',
            background: 'rgba(22,22,26,0.52)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 -2px 40px rgba(0,0,0,0.35), 0 24px 56px -12px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          }}
        >
          {/* Drag handle — csak mobilon */}
          <div className="flex justify-center pb-2 pt-3.5 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Progress header */}
          <div className="shrink-0 px-5 pt-4 lg:px-6 lg:pt-5">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  if (step === 0) {
                    const dirty = state.serviceId || state.name || state.email || state.phone
                    if (dirty && !window.confirm(tt('booking.leaveConfirm'))) return
                    router.push(`/${salonSlug}`)
                  } else goStep(skipStaff && step === 2 ? 0 : step - 1)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-all hover:bg-white/[0.08]"
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.50)',
                  opacity: step > 0 ? 1 : 0,
                  pointerEvents: step > 0 ? 'auto' : 'none',
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {displaySteps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === displayStep ? '20px' : '7px',
                      background: i === displayStep ? 'rgba(255,255,255,0.9)' : i < displayStep ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-white/35 tabular-nums">
                {displayStep + 1}/{displaySteps.length}
              </span>
            </div>
          </div>

          {/* Scrollable lépés-tartalom — data-lenis-prevent nélkül a Lenis elnyeli a scrollt */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 lg:px-6" data-lenis-prevent>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={`${step}-${detailSvcId ?? ''}`}
                custom={dir}
                variants={stepSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepSlideTransition}
              >

              {/* Step 0: Szolgáltatás lista */}
              {step === 0 && !detailSvcId && (
                <div>
                  <h2 className="mb-4 text-2xl font-light tracking-[-0.02em] text-white">{tt('booking.service.title').replace('\n', ' ')}</h2>
                  <div className="space-y-2.5 pb-4">
                    {visibleServices.map(s => {
                      const imgUrl = s.image && typeof s.image === 'object' ? (s.image as Media).url ?? null : null
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            set({ serviceId: String(s.id), slot: null })
                            if (skipStaff) {
                              setDir(1); setTimeout(() => goStep(2), 260)
                            } else {
                              setDir(1); setDetailSvcId(String(s.id))
                            }
                          }}
                          className="w-full rounded-2xl text-left transition-all active:scale-[0.99] overflow-hidden"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1.5px solid rgba(255,255,255,0.10)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {imgUrl && (
                              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden" style={{ borderRadius: '10px 0 0 10px' }}>
                                <img src={imgUrl} alt={s.name} className="h-full w-full object-cover" />
                              </div>
                            )}
                            <div className={cn('flex flex-1 items-center justify-between gap-3', imgUrl ? 'py-3 pr-4' : 'px-4 py-3.5')}>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white">{s.name}</p>
                                {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{s.description}</p>}
                                <p className="mt-1 flex items-center gap-1 text-xs text-white/45">
                                  <Clock className="h-2.5 w-2.5" />{s.duration_minutes} {tt('booking.minutes')}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <p className="text-sm font-bold text-white">{formatPrice(s.price, s.currency)}</p>
                                <ChevronRight className="h-4 w-4 text-white/35" />
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 0: Szolgáltatás detail sub-view */}
              {step === 0 && detailSvcId && detailSvc && (
                <div className="pb-4">
                  <button
                    onClick={() => { setDir(-1); setDetailSvcId(null) }}
                    className="-ml-1.5 mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Vissza
                  </button>
                  {detailSvcImgUrl && (
                    <div className="mb-4 h-[140px] w-full overflow-hidden rounded-2xl">
                      <img src={detailSvcImgUrl} alt={detailSvc.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h3 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{detailSvc.name}</h3>
                  <p className="flex items-center gap-1 text-[12px] text-white/45">
                    <Clock className="h-3 w-3" />{detailSvc.duration_minutes} {tt('booking.minutes')} · {formatPrice(detailSvc.price, detailSvc.currency)}
                  </p>
                  {detailSvc.description && (
                    <p className="mt-3 text-[13px] leading-relaxed text-white/60">{detailSvc.description}</p>
                  )}
                  {detailServiceStaff.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {/* Bárki kártya — csak ha van hozzárendelt szakember */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { set({ staffId: null, slot: null }); setDetailSvcId(null); setDir(1); setTimeout(() => goStep(2), 260) }}
                        onKeyDown={e => e.key === 'Enter' && (set({ staffId: null, slot: null }), setDetailSvcId(null), setDir(1), setTimeout(() => goStep(2), 260))}
                        className="relative cursor-pointer transition-all active:scale-[0.97]"
                        style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)', clipPath: 'inset(0 round 16px)' }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Users className="h-10 w-10 text-white/25" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 px-2.5 py-2.5 text-left" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                          <p className="truncate text-[12px] font-semibold leading-tight text-white">{tt('booking.staff.any')}</p>
                          <p className="mt-0.5 truncate text-[10px] text-white/60">{tt('booking.staff.anyHint')}</p>
                        </div>
                      </div>
                      {/* Szakember kártyák */}
                      {detailServiceStaff.map(m => {
                        const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                        return (
                          <div
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => { set({ staffId: m.id, slot: null }); setDetailSvcId(null); setDir(1); setTimeout(() => goStep(2), 260) }}
                            onKeyDown={e => e.key === 'Enter' && (set({ staffId: m.id, slot: null }), setDetailSvcId(null), setDir(1), setTimeout(() => goStep(2), 260))}
                            className="relative cursor-pointer transition-all active:scale-[0.97]"
                            style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)', clipPath: 'inset(0 round 16px)' }}
                          >
                            {avatarUrl
                              ? <img src={avatarUrl} alt={m.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                              : <div className="absolute inset-0 flex items-center justify-center"><User className="h-10 w-10 text-white/25" /></div>
                            }
                            <div className="absolute inset-x-0 bottom-0 px-2.5 py-2.5 text-left" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                              <p className="truncate text-[12px] font-semibold leading-tight text-white">{m.name}</p>
                              {m.bio && <p className="mt-0.5 truncate text-[10px] text-white/60">{m.bio}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Munkatárs */}
              {step === 1 && (
                <div>
                  <h2 className="mb-4 text-2xl font-light tracking-[-0.02em] text-white">{tt('booking.staff.title').replace('\n', ' ')}</h2>
                  <div className="grid grid-cols-2 gap-2 pb-4">
                    {/* Bárki */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { set({ staffId: null, slot: null }); setTimeout(() => goStep(2), 260) }}
                      onKeyDown={e => e.key === 'Enter' && (set({ staffId: null, slot: null }), setTimeout(() => goStep(2), 260))}
                      className="relative cursor-pointer transition-all active:scale-[0.97]"
                      style={{
                        aspectRatio: '3/4',
                        background: 'rgba(255,255,255,0.08)',
                        boxShadow: state.staffId === null ? 'inset 0 0 0 2px white' : 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                        clipPath: 'inset(0 round 16px)',
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Users className="h-10 w-10 text-white/25" />
                      </div>
                      <div
                        className="absolute inset-x-0 bottom-0 px-2.5 py-2.5 text-left"
                        style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                      >
                        <p className="truncate text-[12px] font-semibold leading-tight text-white">{tt('booking.staff.any')}</p>
                        <p className="mt-0.5 truncate text-[10px] text-white/60">{tt('booking.staff.anyHint')}</p>
                      </div>
                    </div>
                    {/* Munkatársak — csak a kiválasztott service-hez rendeltek */}
                    {visibleStaff.map(m => {
                      const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                      const sel = state.staffId === m.id
                      return (
                        <div
                          key={m.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { set({ staffId: m.id, slot: null }); setTimeout(() => goStep(2), 260) }}
                          onKeyDown={e => e.key === 'Enter' && (set({ staffId: m.id, slot: null }), setTimeout(() => goStep(2), 260))}
                          className="relative cursor-pointer transition-all active:scale-[0.97]"
                          style={{
                            aspectRatio: '3/4',
                            background: 'rgba(255,255,255,0.08)',
                            boxShadow: sel ? 'inset 0 0 0 2px white' : 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                            clipPath: 'inset(0 round 16px)',
                          }}
                        >
                          {avatarUrl
                            ? <img src={avatarUrl} alt={m.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                            : <div className="absolute inset-0 flex items-center justify-center"><User className="h-10 w-10 text-white/25" /></div>
                          }
                          <div
                            className="absolute inset-x-0 bottom-0 px-2.5 py-2.5 text-left"
                            style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                          >
                            <p className="truncate text-[12px] font-semibold leading-tight text-white">{m.name}</p>
                            {m.bio && <p className="mt-0.5 truncate text-[10px] text-white/60">{m.bio}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Időpont */}
              {step === 2 && (
                <div>
                  <h2 className="mb-1 text-2xl font-light tracking-[-0.02em] text-white">{tt('booking.when.title').replace('\n', ' ')}</h2>
                  <p className="mb-4 text-xs text-white/45">
                    {(state.staffId ? selectedStaff?.name : tt('booking.staff.any'))} · {selectedService?.name} · {selectedService?.duration_minutes} {tt('booking.minutes')}
                  </p>
                  {/* Date strip */}
                  <div className="mb-3 overflow-hidden rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <DateStrip
                      selected={state.date}
                      onChange={(d) => set({ date: d, slot: null })}
                      dayCount={bookingWindowDays}
                      locale={locale}
                      dark
                    />
                  </div>
                  {/* Time slots */}
                  <div className="rounded-2xl p-4 pb-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {format(selectedDate, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}
                    </p>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-white/45">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{tt('booking.loading')}</span>
                      </div>
                    ) : slotsError ? (
                      <div className="py-6 text-center" role="alert">
                        <p className="text-[13px] text-white/55">{tt('booking.err.slots')}</p>
                        <button onClick={loadSlots} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-dark">
                          {tt('booking.retry')}
                        </button>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] text-white/55">{tt('booking.noSlots')}</p>
                        <p className="mt-1 text-xs text-white/35">{tt('booking.noSlotsHint')}</p>
                      </div>
                    ) : (
                      <motion.div key={`${state.date}-${slots.length}`} variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-3 gap-2">
                        {slots.map(slot => {
                          const sel = state.slot?.start === slot.start
                          return (
                            <motion.button
                              key={slot.start}
                              variants={fadeUp}
                              onClick={() => { set({ slot }); setTimeout(() => goStep(3), 260) }}
                              className="rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.96]"
                              style={{
                                background: sel ? 'white' : 'rgba(255,255,255,0.08)',
                                border: `1.5px solid ${sel ? 'white' : 'rgba(255,255,255,0.12)'}`,
                                color: sel ? 'var(--ink-dark)' : 'white',
                                boxShadow: sel ? '0 0 0 3px rgba(255,255,255,0.12)' : undefined,
                              }}
                            >
                              {slot.start}
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Adatok */}
              {step === 3 && (
                <div>
                  <h2 className="mb-4 text-2xl font-light tracking-[-0.02em] text-white">{tt('booking.details.title')}</h2>
                  <div className="space-y-2 pb-4">
                    <div className="space-y-1">
                      <Label htmlFor="bk-name" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.name')}</Label>
                      <Input
                        id="bk-name" ref={fieldRefs.name} value={state.name}
                        onChange={e => { set({ name: e.target.value }); clearError('name') }}
                        onBlur={() => onFieldBlur('name')}
                        autoComplete="name" aria-invalid={!!errors.name}
                        placeholder={tt('booking.field.namePlaceholder')}
                        className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.name && 'ring-1 ring-red-400')}
                      />
                      {errors.name && <p role="alert" className="text-[12px] text-red-400">{errors.name}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bk-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.email')}</Label>
                      <Input
                        id="bk-email" ref={fieldRefs.email} type="email" inputMode="email" autoComplete="email" value={state.email}
                        onChange={e => { set({ email: e.target.value }); clearError('email') }}
                        onBlur={() => onFieldBlur('email')}
                        aria-invalid={!!errors.email}
                        placeholder={tt('booking.field.emailPlaceholder')}
                        className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.email && 'ring-1 ring-red-400')}
                      />
                      {errors.email && <p role="alert" className="text-[12px] text-red-400">{errors.email}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.phone')}{requirePhone ? ' *' : ''}</Label>
                      <PhoneCountryInput
                        inputRef={fieldRefs.phone} country={state.country} phone={state.phone}
                        onCountryChange={(code) => set({ country: code })}
                        onPhoneChange={(p) => { set({ phone: p }); clearError('phone') }}
                        onBlur={() => onFieldBlur('phone')} required={requirePhone}
                        dark
                        inputClass={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] px-3 text-[14px] font-medium text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50 backdrop-blur-[10px]', errors.phone && 'ring-1 ring-red-400')}
                      />
                      {errors.phone && <p role="alert" className="text-[12px] text-red-400">{errors.phone}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bk-city" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.city')}</Label>
                      <Input
                        id="bk-city" value={state.city} onChange={e => set({ city: e.target.value })}
                        autoComplete="address-level2" placeholder={tt('booking.field.cityPlaceholder')}
                        className="h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.note')}</Label>
                      <Textarea
                        value={state.notes} onChange={e => set({ notes: e.target.value })}
                        placeholder={tt('booking.field.notePlaceholder')} rows={3}
                        className="rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 resize-none focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Összesítő */}
              {step === 4 && (
                <div>
                  <h2 className="mb-4 text-2xl font-light tracking-[-0.02em] text-white">{tt('booking.summary.title')}</h2>
                  {/* Foglalás részletei */}
                  <div className="mb-3 rounded-2xl p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                    {[
                      { label: tt('booking.step.service'), value: selectedService?.name },
                      { label: selectedService ? undefined : undefined, value: selectedService ? formatPrice(selectedService.price, selectedService.currency) : undefined, sub: true },
                      { label: tt('booking.step.staff'), value: state.staffId ? selectedStaff?.name : tt('booking.staff.any') },
                      { label: tt('booking.step.datetime'), value: `${format(selectedDate, 'MMM d.', { locale: dfLocale(locale) })} · ${state.slot?.start}` },
                      { label: 'Ár', value: selectedService ? formatPrice(selectedService.price, selectedService.currency) : undefined },
                    ].filter(r => r.label && r.value).map(({ label, value }, i, arr) => (
                      <div key={label}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/45">{label}</span>
                          <span className="text-sm font-semibold text-white">{value}</span>
                        </div>
                        {i < arr.length - 1 && <div className="mt-2.5 h-px bg-white/[0.08]" />}
                      </div>
                    ))}
                  </div>
                  {/* Személyes adatok */}
                  <div className="mb-3 rounded-2xl p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                    {[
                      { label: tt('booking.field.name'), value: state.name },
                      { label: tt('booking.field.email'), value: state.email },
                      { label: tt('booking.field.phone'), value: state.phone ? `${DIAL_BY_CODE[state.country] ?? ''} ${state.phone}`.trim() : null },
                      { label: tt('booking.field.city'), value: state.city || null },
                      { label: tt('booking.field.note'), value: state.notes || null },
                    ].filter(r => r.value).map(({ label, value }, i, arr) => (
                      <div key={label}>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs text-white/45 shrink-0 pt-0.5">{label}</span>
                          <span className="text-sm font-semibold text-white text-right break-all">{value}</span>
                        </div>
                        {i < arr.length - 1 && <div className="mt-2.5 h-px bg-white/[0.08]" />}
                      </div>
                    ))}
                  </div>
                  {/* Jó ha tudod */}
                  {(goodToKnow ?? []).filter(p => p?.title || p?.body).length > 0 && (
                    <div className="mb-3 rounded-2xl p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tt('goodToKnow.title')}</p>
                      </div>
                      {(goodToKnow ?? []).filter(p => p?.title || p?.body).map((p, i) => {
                        const Icon = iconByKey(p?.icon)
                        return (
                          <div key={p?.id ?? i} className="flex gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.12] mt-0.5">
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <div className="min-w-0">
                              {p?.title && <p className="text-[12px] font-semibold text-white">{p.title}</p>}
                              {p?.body && <p className="text-[11px] text-white/55">{p.body}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {((termsSections && termsSections.length > 0) || company) && (
                    <p className="text-center text-[12px] text-white/40 pb-4">
                      {tt('booking.termsPrefix')}{' '}
                      <TermsModal sections={termsSections} company={company} locale={locale} triggerClassName="underline underline-offset-2 hover:text-white/70" />
                    </p>
                  )}
                </div>
              )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* CTA gomb */}
          <div
            className="shrink-0 px-5 pt-2 lg:px-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={handleCTA}
              disabled={!ctaEnabled || submitting}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: step === 4 ? '#FFD85F' : ctaEnabled ? 'white' : 'rgba(255,255,255,0.10)',
                color: step === 4 ? 'var(--ink-dark)' : ctaEnabled ? 'var(--ink-dark)' : 'rgba(255,255,255,0.30)',
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 4 ? tt('booking.confirm') : 'Tovább'}
              {!submitting && step !== 4 && ctaEnabled && <Check className="h-4 w-4 opacity-70" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
