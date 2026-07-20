'use client'

import { useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { Upload, FileText, Check, Loader2, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Type detection ────────────────────────────────────────────────────────

const ALIASES_ALL: Record<string, Record<string, string>> = {
  bookings: {
    'ügyfél neve': 'x', 'vendég neve': 'x', 'customer_name': 'x', 'customer name': 'x',
    'dátum': 'x', 'date': 'x', 'időpont': 'x', 'kezdési idő': 'x', 'start time': 'x',
    'fő': 'x', 'pax': 'x', 'covers': 'x', 'party size': 'x',
    'befejezési idő': 'x', 'end time': 'x', 'státusz': 'x', 'status': 'x',
    'szolgáltatás': 'x', 'service': 'x', 'munkatárs': 'x', 'staff': 'x',
  },
  customers: {
    'vendég neve': 'x', 'ügyfél neve': 'x', 'name': 'x', 'customer name': 'x',
    'email': 'x', 'telefon': 'x', 'phone': 'x', 'megjegyzés': 'x', 'notes': 'x',
  },
  staff: {
    'név': 'x', 'name': 'x', 'email': 'x', 'beosztás': 'x', 'pozíció': 'x',
    'role': 'x', 'részleg': 'x', 'department': 'x', 'születésnap': 'x', 'birthday': 'x',
  },
  tables: {
    'asztal neve': 'x', 'asztal': 'x', 'table': 'x', 'férőhely': 'x', 'kapacitás': 'x', 'capacity': 'x',
  },
  services: {
    'szolgáltatás neve': 'x', 'service name': 'x', 'kezelés': 'x', 'treatment': 'x',
    'időtartam': 'x', 'duration': 'x', 'ár': 'x', 'price': 'x', 'kategória': 'x', 'category': 'x',
  },
  opening_hours: {
    'nap': 'x', 'day': 'x', 'nyitva': 'x', 'nyitás': 'x', 'zárás': 'x', 'open time': 'x', 'close time': 'x',
  },
  rooms: {
    'terem neve': 'x', 'terem': 'x', 'room': 'x', 'szoba': 'x', 'szabadtéri': 'x',
  },
  service_categories: {
    'kategória neve': 'x', 'category': 'x', 'kategória': 'x', 'sorrend': 'x', 'sort': 'x',
  },
  billing_info: {
    'cégnév': 'x', 'adószám': 'x', 'tax number': 'x', 'irányítószám': 'x', 'postal code': 'x',
    'cégjegyzékszám': 'x', 'székhely': 'x', 'számlázási cím': 'x', 'billing email': 'x',
  },
}

function detectTypeFromHeaders(headers: string[]): string | null {
  const norm = headers.map((h) => h.toLowerCase().trim())
  let best: string | null = null
  let bestScore = 0
  for (const [type, aliases] of Object.entries(ALIASES_ALL)) {
    const score = norm.filter((h) => h in aliases).length
    if (score > bestScore) { bestScore = score; best = type }
  }
  return bestScore >= 2 ? best : null
}

const SHEET_TYPE_MAP: Record<string, string> = {
  'munkatársak': 'staff', 'munkatarsak': 'staff', 'staff': 'staff', 'employees': 'staff', 'team': 'staff',
  'szolgáltatások': 'services', 'szolgaltatasok': 'services', 'services': 'services', 'treatments': 'services',
  'asztalok': 'tables', 'tables': 'tables',
  'vendégek': 'customers', 'vendegek': 'customers', 'customers': 'customers',
  'guests': 'customers', 'ügyfelek': 'customers', 'ugyfelek': 'customers',
  'foglalások': 'bookings', 'foglalasok': 'bookings', 'bookings': 'bookings',
  'reservations': 'bookings', 'appointments': 'bookings',
  'nyitvatartás': 'opening_hours', 'nyitvatartas': 'opening_hours', 'opening hours': 'opening_hours', 'hours': 'opening_hours',
  'termek': 'rooms', 'szobák': 'rooms', 'szobak': 'rooms', 'rooms': 'rooms', 'sections': 'rooms', 'zones': 'rooms',
  'kategóriák': 'service_categories', 'kategoriak': 'service_categories', 'categories': 'service_categories',
  'számlázás': 'billing_info', 'szamlazas': 'billing_info', 'billing': 'billing_info', 'cégadatok': 'billing_info',
}

const TYPE_LABELS: Record<string, string> = {
  staff: 'Munkatársak', customers: 'Vendégek', tables: 'Asztalok',
  services: 'Szolgáltatások', bookings: 'Foglalások',
  opening_hours: 'Nyitvatartás', rooms: 'Termek / zónák',
  service_categories: 'Kategóriák', billing_info: 'Számlázási adatok',
}

// ── Types ─────────────────────────────────────────────────────────────────

interface Sheet {
  name: string
  importType: string
  headers: string[]
  rows: string[][]
}

interface Props {
  isDark: boolean
  onContinue: () => void
}

// ── Component ─────────────────────────────────────────────────────────────

export function WizardImportStep({ isDark, onContinue }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [counts, setCounts] = useState<{ sheet: string; count: number; label: string }[]>([])
  const [dragging, setDragging] = useState(false)

  const parseFile = (file: File) => {
    setFileName(file.name)
    setSheets([])
    setDone(false)
    setCounts([])
    const reader = new FileReader()
    const isCSV = file.name.toLowerCase().endsWith('.csv')

    const processWorkbook = (wb: ReturnType<typeof read>) => {
      try {
        const parsed: Sheet[] = wb.SheetNames.flatMap((name) => {
          const ws = wb.Sheets[name]
          const data = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
          if (!data.length) return []
          const headers = (data[0] as unknown[]).map(String)
          const rows = (data.slice(1) as unknown[][])
            .filter((r) => (r as unknown[]).some((c) => String(c).trim()))
            .map((r) => headers.map((_, i) => String(r[i] ?? '')))
          if (!rows.length) return []
          const importType =
            SHEET_TYPE_MAP[name.toLowerCase().trim()] ??
            detectTypeFromHeaders(headers) ??
            'bookings'
          return [{ name, importType, headers, rows }]
        })
        setSheets(parsed)
      } catch { /* invalid file */ }
    }

    if (isCSV) {
      reader.onload = (e) => {
        const raw = (e.target?.result as string).replace(/^﻿/, '')
        if (/(?:^|\n)# /.test(raw)) {
          const sections = raw.split(/\r?\n(?=# )/)
          const parsed: Sheet[] = []
          for (const section of sections) {
            const lines = section.split(/\r?\n/)
            const sectionName = lines[0].replace(/^# /, '').trim()
            const csvContent = lines.slice(1).filter(l => !l.startsWith('#')).join('\n')
            if (!csvContent.trim()) continue
            try {
              const wb = read(csvContent.replace(/^﻿/, ''), { type: 'string', dateNF: 'yyyy-mm-dd' })
              const ws = wb.Sheets[wb.SheetNames[0]]
              if (!ws) continue
              const data = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
              if (!data.length) continue
              const headers = (data[0] as unknown[]).map(String)
              const sectionRows = (data.slice(1) as unknown[][])
                .filter((r) => (r as unknown[]).some((c) => String(c).trim()))
                .map((r) => headers.map((_, i) => String(r[i] ?? '')))
              if (!sectionRows.length) continue
              const importType =
                SHEET_TYPE_MAP[sectionName.toLowerCase().trim()] ??
                detectTypeFromHeaders(headers) ??
                'bookings'
              parsed.push({ name: sectionName, importType, headers, rows: sectionRows })
            } catch { /* skip invalid section */ }
          }
          setSheets(parsed)
        } else {
          processWorkbook(read(raw, { type: 'string', dateNF: 'yyyy-mm-dd' }))
        }
      }
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.onload = (e) => {
        processWorkbook(read(e.target?.result as ArrayBuffer, { type: 'array' }))
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const reset = () => { setFileName(null); setSheets([]); setDone(false); setCounts([]) }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const runImport = async () => {
    if (!sheets.length) return
    setLoading(true)
    const results: { sheet: string; count: number; label: string }[] = []
    for (const sheet of sheets) {
      try {
        const res = await fetch('/api/import-csv', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: sheet.headers, rows: sheet.rows, importType: sheet.importType }),
        })
        const data = await res.json().catch(() => null)
        if (data?.imported) {
          const count = (Object.values(data.imported) as number[]).reduce((a, b) => a + b, 0)
          results.push({ sheet: sheet.name, count, label: TYPE_LABELS[sheet.importType] ?? sheet.name })
        }
      } catch { /* non-blocking */ }
    }
    setCounts(results)
    setLoading(false)
    setDone(true)
  }

  // ── Color tokens ──────────────────────────────────────────────────────
  const t = {
    text:     isDark ? 'text-white' : 'text-ink',
    soft:     isDark ? 'text-white/50' : 'text-ink-soft',
    softer:   isDark ? 'text-white/30' : 'text-ink-soft2',
    card:     isDark ? 'bg-white/[0.05] border-white/10' : 'bg-paper border-line',
    dropBase: isDark ? 'border-white/15 hover:border-white/30' : 'border-line-strong hover:border-ink-soft2/60',
    dropActive: isDark ? 'border-gold bg-gold/10' : 'border-gold bg-gold/[0.06]',
    badge:    isDark ? 'bg-white/10 text-white/55' : 'bg-ink/[0.06] text-ink-soft',
    pill:     isDark ? 'bg-white text-ink-dark' : 'bg-ink-dark text-white',
    ghost:    isDark ? 'text-white/35 hover:text-white/65' : 'text-ink-soft hover:text-ink',
  }

  // ── Done state ────────────────────────────────────────────────────────
  if (done) {
    const total = counts.reduce((a, r) => a + r.count, 0)
    return (
      <div className="space-y-4">
        <div className={cn('flex items-center gap-3 p-3.5 rounded-xl border', isDark ? 'border-gold/40 bg-gold/10' : 'border-green-200 bg-green-50/60')}>
          <div className="h-6 w-6 rounded-full bg-gold flex items-center justify-center shrink-0">
            <Check className="h-3.5 w-3.5 text-ink-dark" />
          </div>
          <span className={cn('text-sm font-medium', t.text)}>{total} rekord importálva</span>
        </div>
        <div className="space-y-2">
          {counts.map((r) => (
            <div key={r.sheet} className={cn('flex items-center justify-between px-4 py-3 rounded-xl border text-sm', t.card)}>
              <span className={t.soft}>{r.label}</span>
              <span className={cn('font-semibold', t.text)}>{r.count} db</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className={cn('w-full h-14 rounded-dav-pill flex items-center justify-center gap-2 text-base font-semibold transition-all', t.pill)}
        >
          Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // ── No file state ─────────────────────────────────────────────────────
  if (!fileName) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'w-full rounded-[20px] border-2 border-dashed transition-colors p-8 flex flex-col items-center gap-3 text-center',
            dragging ? t.dropActive : t.dropBase,
          )}
        >
          <Upload className={cn('h-7 w-7', t.softer)} />
          <div>
            <p className={cn('font-medium', t.text)}>Húzd ide az exportált fájlt</p>
            <p className={cn('text-sm mt-0.5', t.soft)}>Több munkalap is feldolgozható egyszerre</p>
            <p className={cn('text-xs mt-2', t.softer)}>.xlsx · .xls · .csv</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = '' }}
          />
        </button>
        <button
          type="button"
          onClick={onContinue}
          className={cn('w-full h-12 text-sm transition-colors', t.ghost)}
        >
          Kihagyás — nincs importálnivalóm
        </button>
      </div>
    )
  }

  // ── File loaded state ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className={cn('flex items-center justify-between gap-3 rounded-xl px-4 py-3 border', t.card)}>
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className={cn('h-4 w-4 shrink-0', t.soft)} />
          <span className={cn('text-sm font-medium truncate', t.text)}>{fileName}</span>
        </div>
        <button type="button" onClick={reset} className={t.ghost} aria-label="Fájl eltávolítása">
          <X className="h-4 w-4" />
        </button>
      </div>

      {sheets.length > 0 ? (
        <div className="space-y-2">
          {sheets.map((s) => (
            <div key={s.name} className={cn('flex items-center justify-between px-4 py-3 rounded-xl border', t.card)}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('text-sm font-medium', t.text)}>{s.name}</span>
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full shrink-0', t.badge)}>
                  {TYPE_LABELS[s.importType] ?? s.importType}
                </span>
              </div>
              <span className={cn('text-sm shrink-0 ml-2', t.soft)}>{s.rows.length} sor</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={cn('text-sm text-center py-3', t.soft)}>Fájl beolvasása…</p>
      )}

      <button
        type="button"
        onClick={runImport}
        disabled={loading || !sheets.length}
        className={cn(
          'w-full h-14 rounded-dav-pill flex items-center justify-center gap-2 text-base font-semibold transition-all disabled:opacity-40',
          t.pill,
        )}
      >
        {loading
          ? <><Loader2 className="h-5 w-5 animate-spin" /> Importálás…</>
          : <>Importálás indítása</>
        }
      </button>
      <button type="button" onClick={onContinue} className={cn('w-full h-10 text-sm transition-colors', t.ghost)}>
        Kihagyás
      </button>
    </div>
  )
}
