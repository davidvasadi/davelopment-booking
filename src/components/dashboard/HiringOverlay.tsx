'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { popPanelCenter, SHEET_MOBILE } from '@/lib/motion'
import { HiringView, type Employee, type SalonBookingProps } from './HiringView'

type Variant = 'salon' | 'restaurant'

/**
 * Munkavállalók (Hiring) OVERLAY — a Munkatársak LISTÁRÓL nyílik: egy sorra kattintva ráúszik a
 * képernyőre az adott munkatárs adatlapja (`initialIndex` → a bal-lista előre-kiválasztva). A panel
 * staggered-spring nyitás (`popPanelCenter`), mögötte `backdrop-blur` dim — ugyanaz az „Apple-szerű"
 * nyelv, mint az avatar/értesítés popover (UserMenu). `createPortal` a body-ra, hogy a fixed pozíció +
 * a teljes-képernyős blur helyesen üljön (nem tör meg a transform-context).
 */
export function HiringOverlay({ open, onClose, variant, employees, positions = [], canManage = false, canEditSalary = false, viewerEmail = null, statusById, onStatusChange, onProfileChange, onOpenEdit, onCalendarRequest, initialIndex = 0, salonId, openCalendar, salonBooking, initialEditing, canEditAvailability }: { open: boolean; onClose: () => void; variant: Variant; employees?: Employee[]; positions?: { label: string; level: 'lead' | 'staff' }[]; canManage?: boolean; canEditSalary?: boolean; viewerEmail?: string | null; statusById?: Record<string, 'active' | 'invited' | 'suspended'>; onStatusChange?: (id: string, status: 'active' | 'suspended') => void; onProfileChange?: (id: string, patch: Partial<Employee>) => void; onOpenEdit?: (id: string) => void; onCalendarRequest?: (id: string) => void; initialIndex?: number; salonId?: string; openCalendar?: boolean; salonBooking?: SalonBookingProps; initialEditing?: boolean; canEditAvailability?: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Mobilon (sm alatt) alulról felcsúszó lap, mint az admin többi ablaka; asztalon marad a középre úszó panel.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="hv-print hv-backdrop fixed inset-0 z-[95] bg-black/25 backdrop-blur-[5px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="hv-print hv-scroll fixed inset-0 z-[96] flex items-end justify-center overflow-hidden sm:items-start sm:overflow-y-auto sm:p-6" onClick={onClose}>
            <motion.div
              variants={isMobile ? SHEET_MOBILE : popPanelCenter}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              style={{ transformOrigin: 'center' }}
              // mobilon: teljes szélesség, felül lekerekített, belül görgethető, kisebb belső margó
              className="hv-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border-t border-line bg-dav-container will-change-transform px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 shadow-dav-container sm:my-auto sm:max-h-none sm:max-w-[1120px] sm:overflow-visible sm:rounded-[30px] sm:border sm:p-7 xl:max-w-[1360px]"
              data-lenis-prevent
            >
              {/* fogantyú — mint a többi alulról nyíló lapnál */}
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15 sm:hidden" />
              <HiringView variant={variant} employees={employees} positionOptions={positions} canManage={canManage} canEditSalary={canEditSalary} viewerEmail={viewerEmail} statusById={statusById} onStatusChange={onStatusChange} onProfileChange={onProfileChange} onOpenEdit={onOpenEdit} onCalendarRequest={onCalendarRequest} onClose={onClose} initialIndex={initialIndex} salonId={salonId} openCalendar={openCalendar} salonBooking={salonBooking} initialEditing={initialEditing} canEditAvailability={canEditAvailability} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

