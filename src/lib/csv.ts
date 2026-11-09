import type { TeamMemberVM } from '@/lib/teamTypes'

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
  void saveFile(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/**
 * Fájl mentése: érintőképernyős eszközön (telefon, a telepített app is) a rendszer megosztás-lapja — onnan a Fájlokba
 * menthető, e-mailben küldhető stb. —, mert a telepített iPhone-appban a sima letöltés-link nem ment fájlt. Ha a
 * megosztás nem elérhető, a böngésző letöltése.
 */
export async function saveFile(filename: string, blob: Blob) {
  if (typeof navigator !== 'undefined' && window.matchMedia('(pointer: coarse)').matches && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
  }
  const url = URL.createObjectURL(blob)
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
/** Munkatársak exportja (Munkatársak 10.1) — a választott mezők (blocks/team TEAM_EXPORT_FIELDS kulcsai) a megadott sorrendben. */
const TEAM_COLS: Record<string, [string[], (e: TeamMemberVM) => Cell[]]> = {
  name: [['Név'], (e) => [e.name]], position: [['Pozíció'], (e) => [e.position]], role: [['Szerep'], (e) => [e.role]],
  status: [['Állapot'], (e) => [{ active: 'Aktív', invited: 'Meghívott', suspended: 'Felfüggesztett' }[e.status]]],
  email: [['E-mail'], (e) => [e.email]], phone: [['Telefon'], (e) => [e.phone]], join: [['Belépés'], (e) => [e.joinDate ?? '']], birthday: [['Születésnap'], (e) => [e.birthday?.slice(0, 10) ?? '']],
  weekly: [['Heti óra (szerződés)'], (e) => [e.weeklyTarget ?? '']], week: [['Órák (e hét)'], (e) => [e.weekHours]], month: [['Órák (e hó)'], (e) => [e.month.hours]], prev: [['Órák (előző hó)'], (e) => [e.month.hoursPrev]],
  days: [['Ledolgozott nap (hó)'], (e) => [e.month.daysWorked]], leave: [['Szabadság (nap)', 'Beteg (nap)'], (e) => [e.month.vacationDays, e.month.sickDays]],
  bookings: [['Foglalás (e hó)'], (e) => [e.month.bookings]], revenue: [['Bevétel (e hó, Ft)'], (e) => [e.month.revenue]], tips: [['Borravaló (e hó, Ft)'], (e) => [e.month.tips]],
  pay: [['Bér típusa', 'Bér (Ft)'], (e) => [e.payType === 'hourly' ? 'Órabér' : 'Napidíj', e.payRate ?? '']],
  tax: [['TAJ-szám', 'Adószám', 'Lakcím'], (e) => [e.taxId ?? '', e.taxNumber ?? '', e.address ?? '']],
}
export function employeesCsv(list: TeamMemberVM[], fields: string[] = Object.keys(TEAM_COLS)): string {
  const keys = fields.filter((k) => TEAM_COLS[k])
  return toCsv(keys.flatMap((k) => TEAM_COLS[k][0]), list.map((e) => keys.flatMap((k) => TEAM_COLS[k][1](e))))
}

/** Mai dátum fájlnévhez (YYYY-MM-DD, helyi idő). */
export function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
