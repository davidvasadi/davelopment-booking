'use client'

import { useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { HoverButton } from '@/components/shared/HoverButton'
import { toCsv, downloadCsv, fileSlug } from '@/lib/csv'
import type { Booking } from '@/payload/payload-types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Megerősítésre vár',
  confirmed: 'Megerősítve',
  completed: 'Befejezve',
  cancelled: 'Lemondva',
  no_show: 'Nem jelent meg',
}

function nameOf(v: unknown): string {
  if (v && typeof v === 'object') return String((v as { name?: string }).name ?? '')
  return ''
}

/** A kiválasztott nap (vagy heti/havi nézetben a nap-tartomány) foglalásai letölthető CSV-ben —
 *  a korábbi nyomtatás helyett (telefonon, a telepített appból a böngésző nem tud nyomtatni).
 *  A név történeti (PrintDayButton) — a fájl a foglalási oldalak 4 helyén van bekötve. */
export function PrintDayButton({
  days,
  salonName,
  bookings,
}: {
  days: string[]
  salonName: string
  bookings: Booking[]
}) {
  function handleExport() {
    const sorted = [...bookings].sort((a, b) => (a.date === b.date ? (a.start_time ?? '').localeCompare(b.start_time ?? '') : (a.date ?? '').localeCompare(b.date ?? '')))
    const csv = toCsv(
      ['Dátum', 'Kezdés', 'Vége', 'Vendég', 'Telefon', 'Email', 'Szolgáltatás', 'Szakember', 'Státusz', 'Megjegyzés'],
      sorted.map((b) => [
        String(b.date ?? '').slice(0, 10), b.start_time, b.end_time, b.customer_name, b.customer_phone, b.customer_email,
        nameOf(b.service), nameOf(b.staff), STATUS_LABEL[b.status] ?? b.status, b.notes,
      ]),
    )
    const period = days.length > 1 ? `${days[0]}_${days[days.length - 1]}` : days[0]
    downloadCsv(`foglalasok-${fileSlug(salonName)}-${period}.csv`, csv)
  }

  // Mobilon a fejléc ikonja indítja (DashboardNav dispatch-eli). Ref-en át, hogy mindig a FRISS
  // napot/foglalásokat exportálja (a sima [] függőségű feliratkozás a régit fogta volna meg).
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
