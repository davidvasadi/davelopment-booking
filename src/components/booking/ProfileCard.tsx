'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, ChevronRight, Loader2, Scissors, Users, User, Phone, Mail, Globe, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatPrice, cn } from '@/lib/utils'
import { staggerContainer, fadeUp, stepSlide, stepSlideTransition } from '@/lib/motion'
import type { Service, StaffMember, ServiceCategory, Media } from '@/payload/payload-types'
import { t as tl, makeT, dfLocale, type Locale } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateStrip } from '@/components/booking/DateStrip'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map(c => [c.code, c.dial]))

type Slot = { start: string; end: string }
type View = 'main' | 'services' | 'serviceDetail' | 'datetime' | 'details' | 'summary'
type FieldKey = 'name' | 'email' | 'phone'

interface Props {
  slug: string
  salonId: string
  locale: Locale
  salonName: string
  salonDescription?: string | null
  salonAddress?: string | null
  salonCity?: string | null
  services: Service[]
  staff: StaffMember[]
  serviceCategories: ServiceCategory[]
  phone?: string | null
  email?: string | null
  website?: string | null
  nextSlotNode?: ReactNode
  requirePhone?: boolean
  bookingWindowDays?: number
}

function getCategoryId(cat: Service['category']): string | null {
  if (!cat) return null
  if (typeof cat === 'string') return cat
  return (cat as ServiceCategory).id
}

export function ProfileCard({
  slug, salonId, locale, salonName, salonDescription, salonAddress, salonCity,
  services, staff, serviceCategories,
  phone, email, website, nextSlotNode,
  requirePhone = true, bookingWindowDays = 60,
}: Props) {
  const router = useRouter()
  const tt = makeT(locale)

  // Browse navigation state
  const [view, setView] = useState<View>('main')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [dir, setDir] = useState(1)

  // Booking flow state
  const [bookingStaffId, setBookingStaffId] = useState<string | null>(null)
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCountry, setCustomerCountry] = useState('HU')
  const [customerCity, setCustomerCity] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
  }

  const isBookingView = view === 'datetime' || view === 'details' || view === 'summary'

  const hasCategories = serviceCategories.length > 0
  const categoryGroups = hasCategories
    ? serviceCategories
        .map(cat => ({
          ...cat,
          services: services.filter(s => getCategoryId(s.category) === cat.id),
        }))
        .filter(g => g.services.length > 0)
    : []

  const selectedCategory = categoryGroups.find(g => g.id === selectedCategoryId)
  const servicesInView = selectedCategory?.services ?? services
  const selectedService = services.find(s => String(s.id) === selectedServiceId) ?? null
  const serviceImgUrl = selectedService?.image && typeof selectedService.image === 'object'
    ? (selectedService.image as Media).url ?? null : null

  // Always resolve from the full staff array (depth-1, avatar populated)
  const serviceStaff = (selectedService?.staff ?? [])
    .map(m => {
      const id = m && typeof m === 'object' && 'id' in m
        ? String((m as { id: unknown }).id)
        : String(m)
      return staff.find(sm => String(sm.id) === id)
    })
    .filter((m): m is StaffMember => !!m)

  const bookingService = selectedService
  const bookingStaff = bookingStaffId ? (staff.find(m => String(m.id) === String(bookingStaffId)) ?? null) : null
  const bookingDateParsed = new Date(bookingDate + 'T00:00:00')

  const goTo = (
    newView: View,
    catId: string | null = null,
    svcId: string | null = null,
    d?: number,
  ) => {
    setDir(d ?? (newView !== 'main' ? 1 : -1))
    setSelectedCategoryId(catId)
    setSelectedServiceId(svcId)
    setView(newView)
  }

  const startBooking = (staffId: string | null) => {
    setBookingStaffId(staffId)
    setBookingSlot(null)
    setDir(1)
    setView('datetime')
  }

  const handleBack = () => {
    if (view === 'summary') { setDir(-1); setView('details') }
    else if (view === 'details') { setDir(-1); setView('datetime') }
    else if (view === 'datetime') { setDir(-1); setView('serviceDetail') }
    else if (view === 'serviceDetail') goTo('services', selectedCategoryId, null, -1)
    else if (view === 'services' && selectedCategoryId !== null) goTo('services', null, null, -1)
    else if (view === 'services') goTo('main', null, null, -1)
    else goTo('main', null, null, -1)
  }

  // Desktop CTA — BookCtaMorph / nextSlotNode open services view
  useEffect(() => {
    const handler = () => {
      setDir(1)
      setSelectedCategoryId(null)
      setSelectedServiceId(null)
      setView('services')
    }
    window.addEventListener('schedulio:openServices', handler)
    return () => window.removeEventListener('schedulio:openServices', handler)
  }, [])

  const loadSlots = () => {
    if (!selectedServiceId) return
    setLoadingSlots(true)
    setSlotsError(false)
    setSlots([])
    const params = new URLSearchParams({
      salonId, serviceId: selectedServiceId, date: bookingDate,
      ...(bookingStaffId ? { staffId: bookingStaffId } : {}),
    })
    fetch(`/api/slots?${params}`)
      .then(r => { if (!r.ok) throw new Error('slots'); return r.json() })
      .then(d => setSlots(d.slots ?? []))
      .catch(() => setSlotsError(true))
      .finally(() => setLoadingSlots(false))
  }

  useEffect(() => {
    if (view !== 'datetime') return
    loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedServiceId, bookingStaffId, bookingDate, salonId])

  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return !customerName || customerName.trim().length < 2 ? tt('booking.err.name') : null
    if (key === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ? tt('booking.err.email') : null
    if (key === 'phone') return requirePhone && customerPhone.replace(/\s/g, '').length < 7 ? tt('booking.err.phone') : null
    return null
  }

  const onFieldBlur = (key: FieldKey) => {
    const msg = validateField(key)
    setErrors(prev => ({ ...prev, [key]: msg ?? undefined }))
  }

  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const submit = async () => {
    if (!selectedServiceId || !bookingSlot) return
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
          salonId, serviceId: selectedServiceId, staffId: bookingStaffId,
          date: bookingDate, start_time: bookingSlot.start, end_time: bookingSlot.end,
          customer_name: customerName, customer_email: customerEmail,
          customer_phone: customerPhone.trim()
            ? `${DIAL_BY_CODE[customerCountry] ?? ''} ${customerPhone.trim()}`.trim()
            : '',
          customer_city: customerCity.trim() || undefined,
          notes: customerNotes, locale,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? tt('booking.err.generic'))
      }
      const params = new URLSearchParams({
        name: customerName, service: bookingService?.name ?? '',
        date: bookingDate, time: bookingSlot.start,
      })
      router.push(`/${slug}/book/success?${params}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tt('booking.err.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const staffCols = staff.length === 1 ? 'grid-cols-1' : staff.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:absolute lg:bottom-auto lg:left-auto lg:right-8 lg:top-1/2 lg:w-[500px] lg:-translate-y-1/2">
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
        {/* Drag handle — mobilon */}
        <div className="flex shrink-0 justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1 w-9 rounded-full bg-white/20" />
        </div>

        {/* Fixed header */}
        <div className="shrink-0 px-6 pb-4 pt-2">
          {view !== 'main' ? (
            <button
              onClick={handleBack}
              className="-ml-1 mb-1 inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Vissza
            </button>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Online foglalás</p>
              <h2 className="mt-0.5 text-[20px] font-light leading-tight tracking-[-0.02em] text-white">{salonName}</h2>
              {(salonDescription || salonAddress || salonCity) && (
                <div className="mt-2.5 space-y-1.5">
                  {salonDescription && (
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-white/50">{salonDescription}</p>
                  )}
                  {(salonAddress || salonCity) && (
                    <p className="flex items-center gap-1 text-[11px] text-white/30">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[salonAddress, salonCity].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <div className="mt-4 h-px bg-white/[0.08]" />
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3" data-lenis-prevent style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>

          {/* Mobile CTA — browse views only */}
          {!isBookingView && (
            <div className="mb-4 lg:hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => goTo('services', null)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold text-ink-dark"
                  style={{ background: '#FFD85F' }}
                >
                  {tl(locale, 'public.bookCta')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                {services.length > 0 && (
                  <div onClickCapture={e => { e.preventDefault(); e.stopPropagation(); goTo('services', null) }}>
                    <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'salon', id: salonId, serviceId: services[0].id }} />
                  </div>
                )}
              </div>
              <div className="mt-4 h-px bg-white/[0.08]" />
            </div>
          )}

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={view + (selectedCategoryId ?? '') + (selectedServiceId ?? '')}
              custom={dir}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepSlideTransition}
            >

              {/* MAIN */}
              {view === 'main' && (
                <div className="space-y-5 pb-2">
                  {services.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Scissors className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tl(locale, 'public.services')}</p>
                      </div>
                      <button
                        onClick={() => goTo('services', null)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99]"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-white">Válassz szolgáltatást</p>
                          <p className="text-[11px] text-white/45">{services.length} szolgáltatás</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                      </button>
                    </div>
                  )}
                  {staff.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tl(locale, 'public.staff')}</p>
                      </div>
                      <div className={`grid ${staffCols} gap-2`}>
                        {staff.map(m => {
                          const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                          return (
                            <button
                              key={m.id}
                              onClick={() => goTo('services', null)}
                              className="relative transition-opacity hover:opacity-90"
                              style={{ aspectRatio: '3/4', clipPath: 'inset(0 round 12px)' }}
                            >
                              <div className="absolute inset-0 bg-ink/[0.07]">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={m.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[32px] font-semibold text-white/25">{m.name[0]}</span>
                                  </div>
                                )}
                                <div
                                  className="absolute inset-x-0 bottom-0 px-2.5 py-2.5"
                                  style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                                >
                                  <p className="truncate text-[12px] font-semibold leading-tight text-white">{m.name}</p>
                                  {m.bio && <p className="mt-0.5 truncate text-[10px] text-white/65">{m.bio}</p>}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(phone || email || website) && (
                    <div>
                      <div className="h-px bg-white/[0.08]" />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {phone && (
                          <a href={`tel:${phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                            <Phone className="h-3.5 w-3.5 shrink-0" />{phone}
                          </a>
                        )}
                        {email && (
                          <a href={`mailto:${email}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                            <Mail className="h-3.5 w-3.5 shrink-0" />{email}
                          </a>
                        )}
                        {website && (
                          <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                            <Globe className="h-3.5 w-3.5 shrink-0" />{tl(locale, 'public.website')}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SERVICES — category list */}
              {view === 'services' && categoryGroups.length > 0 && selectedCategoryId === null && (
                <div className="pb-2">
                  <h3 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">Szolgáltatások</h3>
                  <div className="space-y-1.5">
                    {categoryGroups.map(group => {
                      const catImgUrl = group.image && typeof group.image === 'object'
                        ? (group.image as Media).url ?? null : null
                      return (
                        <button
                          key={group.id}
                          onClick={() => goTo('services', group.id)}
                          className="flex w-full items-center justify-between overflow-hidden rounded-xl text-left transition-colors hover:bg-white/[0.08]"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                          {catImgUrl && (
                            <div className="h-[60px] w-[60px] shrink-0 overflow-hidden" style={{ borderRadius: '10px 0 0 10px' }}>
                              <img src={catImgUrl} alt={group.name} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 px-3 py-3">
                            <p className="text-[13px] font-semibold text-white">{group.name}</p>
                            <p className="mt-0.5 text-[11px] text-white/45">{group.services.length} szolgáltatás</p>
                          </div>
                          <ChevronRight className="mr-3 h-3.5 w-3.5 shrink-0 text-white/35" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SERVICES — service list */}
              {view === 'services' && (categoryGroups.length === 0 || selectedCategoryId !== null) && (
                <div className="pb-2">
                  <h3 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{selectedCategory?.name ?? 'Szolgáltatások'}</h3>
                  <div className="space-y-1.5">
                    {servicesInView.map(s => (
                      <button
                        key={s.id}
                        onClick={() => goTo('serviceDetail', selectedCategoryId, String(s.id))}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.08]"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white">{s.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
                            <Clock className="h-2.5 w-2.5" />{s.duration_minutes} perc
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <p className="text-[13px] font-bold text-white">{formatPrice(s.price, s.currency)}</p>
                          <ChevronRight className="h-3.5 w-3.5 text-white/35" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SERVICE DETAIL */}
              {view === 'serviceDetail' && selectedService && (
                <div className="pb-2">
                  {serviceImgUrl && (
                    <div className="mb-4 h-[160px] w-full overflow-hidden rounded-2xl">
                      <img src={serviceImgUrl} alt={selectedService.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h3 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{selectedService.name}</h3>
                  <p className="flex items-center gap-1 text-[12px] text-white/45">
                    <Clock className="h-3 w-3" />{selectedService.duration_minutes} perc · {formatPrice(selectedService.price, selectedService.currency)}
                  </p>
                  {selectedService.description && (
                    <p className="mt-3 text-[13px] leading-relaxed text-white/60">{selectedService.description}</p>
                  )}
                  {serviceStaff.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startBooking(null)}
                        className="relative transition-all active:scale-[0.97]"
                        style={{
                          aspectRatio: '3/4',
                          background: 'rgba(255,255,255,0.08)',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
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
                          <p className="truncate text-[12px] font-semibold leading-tight text-white">Bármelyik szabad</p>
                          <p className="mt-0.5 truncate text-[10px] text-white/60">Legjobb időpont</p>
                        </div>
                      </button>
                      {serviceStaff.map(m => {
                        const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                        return (
                          <button
                            key={m.id}
                            onClick={() => startBooking(String(m.id))}
                            className="relative transition-all active:scale-[0.97]"
                            style={{
                              aspectRatio: '3/4',
                              background: 'rgba(255,255,255,0.08)',
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
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
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* DATETIME */}
              {view === 'datetime' && bookingService && (
                <div>
                  <h2 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">Mikor jönnél?</h2>
                  <p className="mb-4 text-xs text-white/45">
                    {bookingStaffId ? bookingStaff?.name : 'Bármelyik szabad'} · {bookingService.name} · {bookingService.duration_minutes} perc
                  </p>
                  <div className="mb-3 overflow-hidden rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <DateStrip
                      selected={bookingDate}
                      onChange={d => { setBookingDate(d); setBookingSlot(null) }}
                      dayCount={bookingWindowDays}
                      locale={locale}
                      dark
                    />
                  </div>
                  <div className="rounded-2xl p-4 pb-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {format(bookingDateParsed, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}
                    </p>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-white/45">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Töltés...</span>
                      </div>
                    ) : slotsError ? (
                      <div className="py-6 text-center" role="alert">
                        <p className="text-[13px] text-white/55">Nem sikerült betölteni az időpontokat</p>
                        <button onClick={loadSlots} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-dark">
                          Újra
                        </button>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] text-white/55">Erre a napra nincs szabad időpont</p>
                        <p className="mt-1 text-xs text-white/35">Válassz másik napot</p>
                      </div>
                    ) : (
                      <motion.div
                        key={`${bookingDate}-${slots.length}`}
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-3 gap-2"
                      >
                        {slots.map(slot => {
                          const sel = bookingSlot?.start === slot.start
                          return (
                            <motion.button
                              key={slot.start}
                              variants={fadeUp}
                              onClick={() => {
                                setBookingSlot(slot)
                                setTimeout(() => { setDir(1); setView('details') }, 260)
                              }}
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

              {/* DETAILS */}
              {view === 'details' && (
                <div>
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">Adataid</h2>
                  <div className="space-y-2 pb-4">
                    <div className="space-y-1">
                      <Label htmlFor="bk-name" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.name')}</Label>
                      <Input
                        id="bk-name" ref={fieldRefs.name} value={customerName}
                        onChange={e => { setCustomerName(e.target.value); clearError('name') }}
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
                        id="bk-email" ref={fieldRefs.email} type="email" inputMode="email" autoComplete="email" value={customerEmail}
                        onChange={e => { setCustomerEmail(e.target.value); clearError('email') }}
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
                        inputRef={fieldRefs.phone} country={customerCountry} phone={customerPhone}
                        onCountryChange={code => setCustomerCountry(code)}
                        onPhoneChange={p => { setCustomerPhone(p); clearError('phone') }}
                        onBlur={() => onFieldBlur('phone')} required={requirePhone}
                        dark
                        inputClass={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] px-3 text-[14px] font-medium text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50 backdrop-blur-[10px]', errors.phone && 'ring-1 ring-red-400')}
                      />
                      {errors.phone && <p role="alert" className="text-[12px] text-red-400">{errors.phone}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bk-city" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.city')}</Label>
                      <Input
                        id="bk-city" value={customerCity} onChange={e => setCustomerCity(e.target.value)}
                        autoComplete="address-level2" placeholder={tt('booking.field.cityPlaceholder')}
                        className="h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.note')}</Label>
                      <Textarea
                        value={customerNotes} onChange={e => setCustomerNotes(e.target.value)}
                        placeholder={tt('booking.field.notePlaceholder')} rows={3}
                        className="rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 resize-none focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUMMARY */}
              {view === 'summary' && bookingService && bookingSlot && (
                <div>
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{tt('booking.summary.title')}</h2>
                  <div className="mb-3 space-y-2.5 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                    {[
                      { label: tt('booking.step.service'), value: bookingService.name },
                      { label: tt('booking.step.staff'), value: bookingStaffId ? (bookingStaff?.name ?? '–') : 'Bármelyik szabad' },
                      { label: tt('booking.step.datetime'), value: `${format(bookingDateParsed, 'MMM d.', { locale: dfLocale(locale) })} · ${bookingSlot.start}` },
                      { label: 'Ár', value: formatPrice(bookingService.price, bookingService.currency) },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/45">{label}</span>
                          <span className="text-sm font-semibold text-white">{value}</span>
                        </div>
                        {i < arr.length - 1 && <div className="mt-2.5 h-px bg-white/[0.08]" />}
                      </div>
                    ))}
                  </div>
                  <div className="mb-4 space-y-2.5 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                    {[
                      { label: tt('booking.field.name'), value: customerName || null },
                      { label: tt('booking.field.email'), value: customerEmail || null },
                      { label: tt('booking.field.phone'), value: customerPhone ? `${DIAL_BY_CODE[customerCountry] ?? ''} ${customerPhone}`.trim() : null },
                      { label: tt('booking.field.city'), value: customerCity || null },
                      { label: tt('booking.field.note'), value: customerNotes || null },
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
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {isBookingView ? (
          <div
            className="shrink-0 px-6 pt-2"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={() => {
                if (view === 'summary') {
                  submit()
                } else if (view === 'details') {
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
                  setDir(1)
                  setView('summary')
                }
              }}
              disabled={view === 'datetime' || submitting}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: view === 'summary' ? '#FFD85F' : view === 'details' ? 'white' : 'rgba(255,255,255,0.10)',
                color: view === 'summary' ? 'var(--ink-dark)' : view === 'details' ? 'var(--ink-dark)' : 'rgba(255,255,255,0.30)',
              }}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : view === 'summary' ? tt('booking.confirm') : 'Tovább'
              }
              {!submitting && view === 'details' && <Check className="h-4 w-4 opacity-70" />}
            </button>
          </div>
        ) : (
          <div className="hidden shrink-0 px-6 pb-6 pt-3 lg:block">
            {services.length > 0 && (
              <div
                className="mb-3"
                onClickCapture={e => { e.preventDefault(); e.stopPropagation(); goTo('services', null) }}
              >
                <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'salon', id: salonId, serviceId: services[0].id }} />
              </div>
            )}
            <button
              onClick={() => goTo('services', null)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-ink-dark transition-all active:scale-[0.98] hover:opacity-90"
              style={{ background: '#FFD85F' }}
            >
              {tl(locale, 'public.bookCta')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
