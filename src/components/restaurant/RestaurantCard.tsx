'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, Phone, Mail, Globe, CheckCircle } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { RatingStars } from '@/components/booking/RatingStars'
import { RestaurantBookingWizard, type EventTypeOption } from './RestaurantBookingWizard'
import type { CompanyInfo } from '@/components/booking/TermsModal'
import OpeningHoursLive from './OpeningHoursLive'
import NextAvailableSlots from './NextAvailableSlots'

type View = 'main' | 'book' | 'success'

type OpeningHour = {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  is_open: boolean
  open_time?: string | null
  close_time?: string | null
}

export function RestaurantCard({
  slug,
  restaurantId,
  locale,
  restaurantName,
  restaurantDescription,
  restaurantAddress,
  restaurantCity,
  phone,
  email,
  website,
  openingHours,
  reviews,
  requirePhone,
  maxPax,
  bookingWindowDays,
  eventTypes,
  termsSections,
  company,
}: {
  slug: string
  restaurantId: string | number
  locale: Locale
  restaurantName: string
  restaurantDescription?: string | null
  restaurantAddress?: string | null
  restaurantCity?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  openingHours: OpeningHour[]
  reviews: { count: number; average: number }
  requirePhone: boolean
  maxPax: number
  bookingWindowDays: number
  eventTypes: EventTypeOption[]
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(true)
  const [view, setView] = useState<View>('main')
  const [bookInitial, setBookInitial] = useState<{ date: string; time: string; pax: number } | null>(null)
  const [successDetails, setSuccessDetails] = useState<{ date: string; time: string; pax: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const addressLine = [restaurantAddress, restaurantCity].filter(Boolean).join(', ')

  const handleSlotClick = (date: string, time: string, pax: number) => {
    setBookInitial({ date, time, pax })
    setView('book')
    setSheetOpen(true)
  }

  const handleSuccess = (date: string, time: string, pax: number) => {
    setSuccessDetails({ date, time, pax })
    setView('success')
  }

  const handleCloseSuccess = () => {
    setView('main')
    setSuccessDetails(null)
    setBookInitial(null)
    setSheetOpen(false)
  }

  const mainView = (
    <div className="space-y-5 px-5 pb-6 pt-4 lg:px-6">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {t(locale, 'public.bookTable')}
        </p>
        <h2 className="text-[28px] font-light leading-tight tracking-[-0.02em] text-white">
          {restaurantName}
        </h2>
        {reviews.count > 0 && (
          <div className="mt-2">
            <RatingStars rating={reviews.average} count={reviews.count} />
          </div>
        )}
      </div>

      {restaurantDescription && (
        <p className="text-[14px] leading-relaxed text-white/60">
          {restaurantDescription.slice(0, 220)}
          {restaurantDescription.length > 220 ? '…' : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {addressLine && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <MapPin className="h-3 w-3" />{addressLine}
          </span>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Phone className="h-3 w-3" />{phone}
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Mail className="h-3 w-3" />{email}
          </a>
        )}
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Globe className="h-3 w-3" />{t(locale, 'public.website')}
          </a>
        )}
      </div>

      {openingHours.length > 0 && (
        <div className="space-y-3">
          <NextAvailableSlots
            restaurantId={restaurantId}
            slug={slug}
            locale={locale}
            variant="dark"
            onSlotClick={handleSlotClick}
          />
          <OpeningHoursLive hours={openingHours} locale={locale} variant="dark" />
        </div>
      )}

    </div>
  )

  const bookView = (
    <div className="px-4 pb-6 pt-4">
      <RestaurantBookingWizard
        key={bookInitial ? `${bookInitial.date}-${bookInitial.time}` : 'default'}
        restaurantId={restaurantId}
        slug={slug}
        requirePhone={requirePhone}
        maxPax={maxPax}
        bookingWindowDays={bookingWindowDays}
        eventTypes={eventTypes}
        termsSections={termsSections}
        company={company}
        locale={locale}
        onBack={() => setView('main')}
        onSuccess={handleSuccess}
        variant="dark"
        initialDateProp={bookInitial?.date}
        initialTimeProp={bookInitial?.time}
        initialPaxProp={bookInitial?.pax}
      />
    </div>
  )

  const successView = (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 py-8 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'rgba(52,211,153,0.15)' }}
      >
        <CheckCircle className="h-10 w-10 text-emerald-400" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <h2 className="text-2xl font-light tracking-[-0.01em] text-white mb-2">
          {t(locale, 'public.success.title')}
        </h2>
        <p className="text-sm text-white/55 mb-8">
          {t(locale, 'public.success.subtitle')}
        </p>
        {successDetails && (
          <div
            className="mb-8 rounded-[16px] px-5 py-4 text-left"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <p className="text-xs text-white/45 mb-1">{t(locale, 'rbooking.summary')}</p>
            <p className="text-gold font-semibold">{t(locale, 'rbooking.guests', { n: successDetails.pax })}</p>
            <p className="text-sm text-white/60 mt-1">{successDetails.date} · {successDetails.time}</p>
          </div>
        )}
        <button
          onClick={handleCloseSuccess}
          className="flex w-full h-12 items-center justify-center rounded-full text-[14px] font-semibold text-ink-dark"
          style={{ background: '#FFD85F' }}
        >
          {t(locale, 'public.success.back')}
        </button>
      </motion.div>
    </div>
  )

  const currentView = view === 'main' ? mainView : view === 'book' ? bookView : successView

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isMobile && sheetOpen && (
          <motion.div
            key="restaurant-sheet-backdrop"
            className="fixed inset-0 z-[29] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (view !== 'success') setSheetOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Lebegő CTA gomb (mobil, sheet megnyitása előtt) */}
      <AnimatePresence>
        {isMobile && !sheetOpen && (
          <motion.div
            key="restaurant-mobile-cta"
            className="fixed bottom-0 left-0 right-0 z-20 px-5 lg:hidden"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.3 }}
          >
            <button
              onClick={() => { setSheetOpen(true) }}
              className="flex w-full h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-dark"
              style={{ background: '#FFD85F', boxShadow: '0 4px 32px rgba(0,0,0,0.45)' }}
            >
              {t(locale, 'public.bookTable')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kártya */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 lg:absolute lg:bottom-auto lg:left-auto lg:right-8 lg:top-1/2 lg:w-[500px] lg:-translate-y-1/2"
        style={{ pointerEvents: isMobile && !sheetOpen ? 'none' : undefined }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: isMobile ? (sheetOpen ? 0 : '100%') : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="flex flex-col overflow-hidden rounded-t-[28px] lg:rounded-[24px]"
          style={{
            height: 'min(82dvh, calc(100dvh - 48px))',
            background: 'rgba(22,22,26,0.52)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
          }}
        >
          {/* Drag handle (mobil) */}
          <div className="shrink-0 flex justify-center pt-3 pb-1 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Nézet-tartalom animált csere */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="flex-1 overflow-y-auto overscroll-contain"
              data-lenis-prevent
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {currentView}
            </motion.div>
          </AnimatePresence>

          {/* Sticky CTA footer — csak a főnézeten */}
          <AnimatePresence>
            {view === 'main' && (
              <motion.div
                key="main-cta-footer"
                className="shrink-0 px-5 lg:px-6"
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => { setView('book'); setSheetOpen(true) }}
                  className="flex w-full h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-dark"
                  style={{ background: '#FFD85F' }}
                >
                  {t(locale, 'public.bookTable')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}
