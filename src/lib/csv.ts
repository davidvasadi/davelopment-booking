import type { Employee } from '@/components/dashboard/HiringView'

/**
 * CSV-export (a korábbi nyomtatás helyett — telefonon is működik, a fájllal azt csinálnak, amit
 * akarnak). Magyar Excel-barát: pontosvessző-tagolás, UTF-8 BOM (ékezetek), CRLF sorvég.
 */
type Cell = string | number | boolean | null | undefined

function cell(v: Cell): string {
  const s = v == null ? '' : typeof v === 'boolean' ? (v ? 'Igen' : 'Nem') : String(v)
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fájlnévbe tehető rövid azonosító („Budapest Bisztró” → „budapest-bisztro”). */
export function fileSlug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
}

/** Munkatársak (lista vagy egy profil) — a Munkatársak oldal / munkatárs-profil exportja. */
export function employeesCsv(list: Employee[]): string {
  return toCsv(
    ['Név', 'Pozíció', 'Email', 'Telefon', 'Belépés', 'Jelenlét (hó, %)', 'Ledolgozott nap (hó)', 'Szabadság (nap)', 'Betegség (nap)', 'Órák (hó)', 'Órák (előző hó)', 'Heti órák'],
    list.map((e) => [
      e.name,
      e.position,
      e.email,
      e.phone,
      e.hr?.join_date ? String(e.hr.join_date).slice(0, 10) : e.since,
      e.attendance,
      e.daysWorked,
      e.vacationDays,
      e.sickDays,
      e.hoursThisMonth,
      e.hoursLastMonth,
      e.weeklyHours ?? '',
    ]),
  )
}

/** Mai dátum fájlnévhez (YYYY-MM-DD, helyi idő). */
export function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
