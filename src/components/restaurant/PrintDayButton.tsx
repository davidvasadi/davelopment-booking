'use client'

import { useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { HoverButton } from '@/components/shared/HoverButton'
import { toCsv, downloadCsv, fileSlug } from '@/lib/csv'
import type { Reservation } from '@/payload/payload-types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősítve',
  seated: 'Leültetve',
  completed: 'Befejezett',
  no_show: 'Nem jött meg',
  cancelled: 'Lemondva',
}

const SOURCE_LABEL: Record<string, string> = {
  online: 'Online',
  walk_in: 'Beeső',
  phone: 'Telefon',
}

function tablesOf(r: Reservation): string {
  return (r.tables ?? [])
    .map((t) => (t && typeof t === 'object' ? (t as { name?: string | null }).name ?? '' : ''))
    .filter(Boolean)
    .join(', ')
}

/** A kiválasztott nap (vagy heti/havi nézetben a nap-tartomány) asztalfoglalásai letölthető
 *  CSV-ben — a korábbi nyomtatás helyett (telefonon, a telepített appból a böngésző nem tud
 *  nyomtatni). A név történeti (PrintDayButton) — a foglalási oldalakon így van bekötve. */
export function PrintDayButton({
  days,
  restaurantName,
  reservations,
}: {
  days: string[]
  restaurantName: string
  reservations: Reservation[]
}) {
  function handleExport() {
    const sorted = [...reservations].sort((a, b) => (a.date === b.date ? (a.start_time ?? '').localeCompare(b.start_time ?? '') : (a.date ?? '').localeCompare(b.date ?? '')))
    const csv = toCsv(
      ['Dátum', 'Kezdés', 'Vége', 'Létszám', 'Vendég', 'Telefon', 'Email', 'Asztal', 'Forrás', 'Státusz', 'Megjegyzés'],
      sorted.map((r) => [
        String(r.date ?? '').slice(0, 10), r.start_time, r.end_time, r.pax, r.customer_name, r.customer_phone, r.customer_email,
        tablesOf(r), SOURCE_LABEL[r.source ?? ''] ?? r.source, STATUS_LABEL[r.status] ?? r.status, r.notes,
      ]),
    )
    const period = days.length > 1 ? `${days[0]}_${days[days.length - 1]}` : days[0]
    downloadCsv(`foglalasok-${fileSlug(restaurantName)}-${period}.csv`, csv)
  }

  // Mobilon a fejléc ikonja indítja (DashboardNav dispatch-eli) — ref-en át a FRISS adattal.
  const ref = useRef(handleExport)
  ref.current = handleExport
  useEffect(() => {
    const h = () => ref.current()
    window.addEventListener('davelopment:export-bookings-day', h)
    return () => window.removeEventListener('davelopment:export-bookings-day', h)
  }, [])

  return (
    <HoverButton
      onClick={handleExport}
      ariaLabel="Foglalások letöltése (CSV)"
      title="Foglalások letöltése (CSV)"
      className="flex shrink-0 items-center justify-center gap-1.5 h-[42px] w-[42px] rounded-dav-pill border border-line bg-[var(--dav-glass)] text-xs font-semibold text-ink hover:bg-white/60 transition-colors"
    >
      <Download className="h-4 w-4 shrink-0" />
    </HoverButton>
  )
}
