'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import { HoverButton } from '@/components/shared/HoverButton'
import type { Booking } from '@/payload/payload-types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Megerősítésre vár',
  confirmed: 'Megerősítve',
  completed: 'Befejezve',
  cancelled: 'Lemondva',
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

function nameOf(v: unknown): string {
  if (v && typeof v === 'object') return String((v as { name?: string }).name ?? '')
  return ''
}

/** Egy nap vagy egy nap-tartomány (heti/havi nézet) foglalásait egy nyomtatható ablakban
 *  jeleníti meg és elindítja a böngésző nyomtatást — az étterem PrintDayButton salon-megfelelője
 *  (ld. ott a részletek). Egyetlen napnál (`days.length === 1`) a fejléc-dátum és a táblázat
 *  ugyanaz, mint korábban; több napnál a fejléc egy dátum-tartományt mutat, és a táblázat egy
 *  extra "Dátum" oszlopot kap, mert a sorok több napra szórtan futnak. */
export function PrintDayButton({
  days,
  salonName,
  bookings,
}: {
  days: string[]
  salonName: string
  bookings: Booking[]
}) {
  function handlePrint() {
    const multi = days.length > 1
    const periodLabel = multi
      ? `${format(parseISO(days[0]), 'yyyy. MMMM d.', { locale: hu })} – ${format(parseISO(days[days.length - 1]), 'MMMM d.', { locale: hu })}`
      : format(parseISO(days[0]), 'yyyy. MMMM d., EEEE', { locale: hu })
    const sorted = [...bookings].sort((a, b) => (a.date === b.date ? (a.start_time ?? '').localeCompare(b.start_time ?? '') : (a.date ?? '').localeCompare(b.date ?? '')))

    const rows = sorted
      .map((b) => {
        const off = b.status === 'cancelled'
        return `<tr class="${off ? 'off' : ''}">
          ${multi ? `<td class="t">${esc(format(parseISO(b.date), 'MM.dd.', { locale: hu }))}</td>` : ''}
          <td class="t">${esc(b.start_time)}–${esc(b.end_time)}</td>
          <td>${esc(b.customer_name)}</td>
          <td>${esc(nameOf(b.service))}</td>
          <td>${esc(nameOf(b.staff))}</td>
          <td>${esc(b.customer_phone)}</td>
          <td>${esc(STATUS_LABEL[b.status] ?? b.status)}</td>
          <td class="n">${esc(b.notes)}</td>
        </tr>`
      })
      .join('')

    const colCount = multi ? 8 : 7

    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
      <title>${esc(salonName)} – ${esc(periodLabel)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #18181b; }
        header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #18181b; padding-bottom: 8px; margin-bottom: 16px; }
        h1 { font-size: 18px; margin: 0; }
        .meta { font-size: 13px; color: #52525b; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
        th { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #71717a; }
        td.t { white-space: nowrap; font-variant-numeric: tabular-nums; }
        td.n { color: #52525b; font-size: 11px; }
        tr.off td { color: #a1a1aa; text-decoration: line-through; }
        tr.off td.n { text-decoration: none; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <header>
        <h1>${esc(salonName)}</h1>
        <div class="meta">${esc(periodLabel)} · ${sorted.length} foglalás</div>
      </header>
      <table>
        <thead><tr>
          ${multi ? '<th>Dátum</th>' : ''}<th>Idő</th><th>Vendég</th><th>Szolgáltatás</th><th>Szakember</th><th>Telefon</th><th>Státusz</th><th>Megjegyzés</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${colCount}" style="text-align:center;padding:24px;color:#a1a1aa">Nincs foglalás erre az időszakra.</td></tr>`}</tbody>
      </table>
      </body></html>`

    // Blob URL-es iframe: nem deprecated (szemben a document.write-tal), és a
    // nyomtatás az aktuális ablakon belül történik, ami mobil böngészőkön
    // megbízhatóbb, mint egy felugró ablak. FONTOS: Safari-n a blob: URL + iframe.src
    // kombináció megbízhatatlan — az onload gyakran a tényleges renderelés ELŐTT fut le,
    // és a nyomtatási előnézet üres lapot mutat. srcdoc-kal + egy röpke késleltetéssel
    // ez Safari-n is konzisztensen működik.
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => iframe.remove(), 1000)
      }, 150)
    }
    iframe.srcdoc = html
    document.body.appendChild(iframe)
  }

  // Mobilon a fejléc csengő melletti ikonja indítja (DashboardNav dispatch-eli) — a gomb maga a
  // toolbarból mobilon rejtve, ld. SalonDailyView.
  useEffect(() => {
    window.addEventListener('davelopment:print-bookings-day', handlePrint)
    return () => window.removeEventListener('davelopment:print-bookings-day', handlePrint)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HoverButton
      onClick={handlePrint}
      ariaLabel="Napi lista nyomtatása"
      title="Napi lista nyomtatása"
      className="flex shrink-0 items-center justify-center gap-1.5 h-[42px] w-[42px] rounded-dav-pill border border-line bg-[var(--dav-glass)] text-xs font-semibold text-ink hover:bg-white/60 transition-colors"
    >
      <Printer className="h-4 w-4 shrink-0" />
          </HoverButton>
  )
}
