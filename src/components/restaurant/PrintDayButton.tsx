'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import { HoverButton } from '@/components/shared/HoverButton'
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

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

/** Egy nap vagy egy nap-tartomány (heti/havi nézet) foglalásait egy nyomtatható ablakban
 *  jeleníti meg és elindítja a böngésző nyomtatást. A kapott listát (a szülő oldalon már
 *  betöltve) használja, nincs külön lekérés. A lemondott/nem jött sorok halványan, de
 *  szerepelnek. Több napnál (`days.length > 1`) a fejléc dátum-tartományt mutat, és a táblázat
 *  egy extra "Dátum" oszlopot kap, mert a sorok több napra szórtan futnak. */
export function PrintDayButton({
  days,
  restaurantName,
  reservations,
}: {
  days: string[]
  restaurantName: string
  reservations: Reservation[]
}) {
  function handlePrint() {
    const multi = days.length > 1
    const periodLabel = multi
      ? `${format(parseISO(days[0]), 'yyyy. MMMM d.', { locale: hu })} – ${format(parseISO(days[days.length - 1]), 'MMMM d.', { locale: hu })}`
      : format(parseISO(days[0]), 'yyyy. MMMM d., EEEE', { locale: hu })
    const sorted = [...reservations].sort((a, b) =>
      a.date === b.date ? (a.start_time ?? '').localeCompare(b.start_time ?? '') : (a.date ?? '').localeCompare(b.date ?? ''),
    )
    const totalPax = sorted
      .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
      .reduce((s, r) => s + (r.pax ?? 0), 0)

    const rows = sorted
      .map((r) => {
        const off = r.status === 'cancelled' || r.status === 'no_show'
        return `<tr class="${off ? 'off' : ''}">
          ${multi ? `<td class="t">${esc(format(parseISO(r.date), 'MM.dd.', { locale: hu }))}</td>` : ''}
          <td class="t">${esc(r.start_time)}–${esc(r.end_time)}</td>
          <td class="c">${esc(r.pax)}</td>
          <td>${esc(r.customer_name)}</td>
          <td>${esc(r.customer_phone)}</td>
          <td>${esc(SOURCE_LABEL[r.source] ?? r.source)}</td>
          <td>${esc(STATUS_LABEL[r.status] ?? r.status)}</td>
          <td class="n">${esc(r.notes)}</td>
        </tr>`
      })
      .join('')

    const colCount = multi ? 8 : 7

    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
      <title>${esc(restaurantName)} – ${esc(periodLabel)}</title>
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
        td.c { text-align: center; }
        td.n { color: #52525b; font-size: 11px; }
        tr.off td { color: #a1a1aa; text-decoration: line-through; }
        tr.off td.n { text-decoration: none; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <header>
        <h1>${esc(restaurantName)}</h1>
        <div class="meta">${esc(periodLabel)} · ${sorted.length} foglalás · ${totalPax} fő</div>
      </header>
      <table>
        <thead><tr>
          ${multi ? '<th>Dátum</th>' : ''}<th>Idő</th><th>Fő</th><th>Vendég</th><th>Telefon</th><th>Forrás</th><th>Státusz</th><th>Megjegyzés</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${colCount}" style="text-align:center;padding:24px;color:#a1a1aa">Nincs foglalás erre az időszakra.</td></tr>`}</tbody>
      </table>
      </body></html>`

    // Iframe-en belüli nyomtatás: az aktuális ablakon belül történik, ami mobil
    // böngészőkön megbízhatóbb, mint egy felugró ablak. FONTOS: Safari-n a blob: URL +
    // iframe.src kombináció megbízhatatlan — az onload gyakran a tényleges renderelés
    // ELŐTT fut le, és a nyomtatási előnézet üres lapot mutat. srcdoc-kal + egy röpke
    // késleltetéssel ez Safari-n is konzisztensen működik.
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
  // toolbarból mobilon rejtve, ld. DailyView.
  useEffect(() => {
    window.addEventListener('davelopment:print-bookings-day', handlePrint)
    return () => window.removeEventListener('davelopment:print-bookings-day', handlePrint)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HoverButton
      onClick={handlePrint}
      ariaLabel="Napi lista nyomtatása"
      title="Napi lista nyomtatása"
      className="flex shrink-0 items-center justify-center gap-1.5 h-[42px] w-[42px] sm:w-auto sm:px-[18px] rounded-dav-pill border border-line bg-[var(--dav-glass)] text-xs font-semibold text-ink hover:bg-white/60 transition-colors"
    >
      <Printer className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Napi lista nyomtatása</span>
    </HoverButton>
  )
}
