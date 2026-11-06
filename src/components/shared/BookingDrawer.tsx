'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Panel, SheetHandle, type Status } from '@/components/ui-kit'
import { guestKeyOf } from '@/lib/guests'
import { BookingDrawerBody, type GuestProfile } from './BookingDrawerBody'
export type { DrawerAction } from './BookingDrawerBody'
import type { DrawerAction } from './BookingDrawerBody'


/**
 * Megnyitott foglalás (a /design 6.7, mobilon 6.12): desktopon jobb oldalt nyíló lap — a lista / idővonal
 * mellette látható marad —, mobilon alulról felcsúszó lap fogantyúval. Fent mikor és a vendég neve, alatta a jelvények;
 * ha teendő van (függő, késik), színes sáv a hozzá illő gyors gombokkal; alatta a foglalás adatai. A ceruza a teljes
 * szerkesztőt nyitja. Esc zárja.
 */
export function BookingDrawer({ open, onClose, onEdit, when, title, pills, alert, actions, guest, city, children }: {
  open: boolean
  onClose: () => void
  onEdit?: () => void
  when: string
  title: string
  pills?: React.ReactNode
  /** teendő-sáv: a színe és a szövege (pl. „12 perce késik”) */
  alert?: { tone: Extract<Status, 'bad' | 'warn' | 'pending'>; text: string } | null
  actions?: DrawerAction[]
  /** a vendég azonosítói — ebből jönnek az előzmények (hányadik alkalom, mióta, korábbi látogatások) */
  guest?: { email?: string | null; phone?: string | null; name?: string | null }
  city?: string | null
  children?: React.ReactNode
}) {
  const profile = useGuestProfile(open ? guest : undefined)
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const body = <BookingDrawerBody {...{ desktop, onClose, onEdit, when, title, pills, alert, actions, profile, city }}>{children}</BookingDrawerBody>

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && desktop && <div key="catch" className="fixed inset-0 z-[84]" onClick={onClose} aria-hidden />}
      {open && (desktop ? (
        <motion.div
          key="drawer"
          className="fixed bottom-3 right-3 top-3 z-[85] w-[380px] max-w-[calc(100vw-24px)]"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        >
          <Panel className="h-full overflow-y-auto" >{body}</Panel>
        </motion.div>
      ) : (
        <div key="sheet" className="fixed inset-0 z-[85] flex items-end">
          <motion.div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="relative w-full" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            <Panel className="max-h-[85dvh] overflow-y-auto rounded-b-none pt-3" >
              <button type="button" aria-label="Bezárás" onClick={onClose} className="block w-full pb-3"><SheetHandle /></button>
              {body}
            </Panel>
          </motion.div>
        </div>
      ))}
    </AnimatePresence>,
    document.body,
  )
}

/** A vendég profilja a Vendégek végpontból (látogatások, mióta, előzmények). Jogosultság nélkül (403) üres. */
function useGuestProfile(g?: { email?: string | null; phone?: string | null; name?: string | null }) {
  const key = g ? guestKeyOf(g) : null
  const [p, setP] = useState<GuestProfile | null>(null)
  useEffect(() => {
    setP(null)
    if (!key) return
    const ctrl = new AbortController()
    fetch(`/api/guests?key=${encodeURIComponent(key)}`, { credentials: 'include', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.profile) setP(j.profile as GuestProfile) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [key])
  return p
}
