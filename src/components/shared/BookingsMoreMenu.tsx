'use client'

import { useEffect, useState } from 'react'
import { Download, MoreHorizontal, Printer } from 'lucide-react'
import { IconButton, Menu, MenuItem } from '@/components/ui-kit'
import { ExportDialog } from './ExportDialog'
import { ymdLocal } from '@/lib/utils'

/** A Foglalások fejlécének ⋯ menüje (design 6.1): nyomtatás és export. Az export a közös export-ablak (7.6) a nézett
 *  napokkal, „Foglalások”-ra állítva; mobilon a fejléc letöltés-ikonja (DashboardNav) is ezt nyitja. Kívülre kattintva zár. */
export function BookingsMoreMenu({ days }: { days: string[] }) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    const on = () => setExporting(true)
    window.addEventListener('davelopment:export-bookings-day', on)
    return () => window.removeEventListener('davelopment:export-bookings-day', on)
  }, [])
  const printLabel = days.length > 1 ? 'a megjelenített időszak' : days[0] === ymdLocal(new Date()) ? 'mai nap' : 'ez a nap'
  return (
    <span className="relative">
      <IconButton icon={MoreHorizontal} label="Nyomtatás, export" onClick={() => setOpen((v) => !v)} aria-expanded={open} />
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <Menu className="absolute right-0 top-full z-50 mt-2">
            <MenuItem icon={Printer} onClick={() => { setOpen(false); window.print() }}>Nyomtatás — {printLabel}</MenuItem>
            <MenuItem icon={Download} trailing="CSV" onClick={() => { setOpen(false); setExporting(true) }}>Export</MenuItem>
          </Menu>
        </>
      )}
      {exporting && <ExportDialog initial={{ what: 'bookings', preset: 3, from: days[0], to: days[days.length - 1] }} onClose={() => setExporting(false)} />}
    </span>
  )
}
