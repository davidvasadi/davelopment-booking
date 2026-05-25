'use client'

import { Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { Reservation, Table } from '@/payload/payload-types'

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

function tableNames(r: Reservation): string {
  return (r.tables ?? [])
    .map((t) => (typeof t === 'object' && t ? (t as Table).name : ''))
    .filter(Boolean)
    .join(' + ')
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

/** A nap foglalásait egy nyomtatható ablakban jeleníti meg és elindítja a
 *  böngésző nyomtatást. A kapott listát (a szülő oldalon már betöltve) használja,
 *  nincs külön lekérés. A lemondott/nem jött sorok halványan, de szerepelnek. */
export function PrintDayButton({
  date,
  restaurantName,
  reservations,
}: {
  date: string
  restaurantName: string
  reservations: Reservation[]
}) {
  function handlePrint() {
    const dayLabel = format(parseISO(date), 'yyyy. MMMM d., EEEE', { locale: hu })
    const sorted = [...reservations].sort((a, b) =>
      (a.start_time ?? '').localeCompare(b.start_time ?? ''),
    )
    const totalPax = sorted
      .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
      .reduce((s, r) => s + (r.pax ?? 0), 0)

    const rows = sorted
      .map((r) => {
        const off = r.status === 'cancelled' || r.status === 'no_show'
        return `<tr class="${off ? 'off' : ''}">
          <td class="t">${esc(r.start_time)}–${esc(r.end_time)}</td>
          <td class="c">${esc(r.pax)}</td>
          <td>${esc(r.customer_name)}</td>
          <td>${esc(r.customer_phone)}</td>
          <td>${esc(tableNames(r))}</td>
          <td>${esc(SOURCE_LABEL[r.source] ?? r.source)}</td>
          <td>${esc(STATUS_LABEL[r.status] ?? r.status)}</td>
          <td class="n">${esc(r.notes)}</td>
        </tr>`
      })
      .join('')

    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
      <title>${esc(restaurantName)} – ${esc(dayLabel)}</title>
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
        <div class="meta">${esc(dayLabel)} · ${sorted.length} foglalás · ${totalPax} fő</div>
      </header>
      <table>
        <thead><tr>
          <th>Idő</th><th>Fő</th><th>Vendég</th><th>Telefon</th><th>Asztal</th><th>Forrás</th><th>Státusz</th><th>Megjegyzés</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:#a1a1aa">Nincs foglalás erre a napra.</td></tr>'}</tbody>
      </table>
      </body></html>`

    // Blob URL-es iframe: nem deprecated (szemben a document.write-tal), és a
    // nyomtatás az aktuális ablakon belül történik, ami mobil böngészőkön
    // megbízhatóbb, mint egy felugró ablak.
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = url
    iframe.onload = () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      // Takarítás a nyomtatás párbeszéd lezárása után.
      setTimeout(() => {
        URL.revokeObjectURL(url)
        iframe.remove()
      }, 1000)
    }
    document.body.appendChild(iframe)
  }

  return (
    <button
      onClick={handlePrint}
      aria-label="Napi lista nyomtatása"
      title="Napi lista nyomtatása"
      className="flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full sm:rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-xs font-semibold text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors"
    >
      <Printer className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      <span className="hidden sm:inline">Napi lista nyomtatása</span>
    </button>
  )
}
