'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, X, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── CSV parser (client-side, no deps) ────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split('\n')[0] ?? ''
  const semi = (firstLine.match(/;/g) ?? []).length
  const tab = (firstLine.match(/\t/g) ?? []).length
  const comma = (firstLine.match(/,/g) ?? []).length
  const delim = semi > comma ? ';' : tab > comma ? '\t' : ','

  const lines = clean.split('\n').map((l) => l.replace(/\r$/, '').trim()).filter(Boolean)
  if (!lines.length) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (c === delim && !inQ) {
        result.push(cur.trim()); cur = ''
      } else cur += c
    }
    result.push(cur.trim())
    return result
  }

  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) }
}

// ── Column auto-detection ────────────────────────────────────────────────

const ALIASES: Record<string, string> = {
  'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
  'vendég': 'customer_name', 'vendég neve': 'customer_name',
  'név': 'customer_name', 'name': 'customer_name',
  'client': 'customer_name', 'client name': 'customer_name',
  'customer': 'customer_name', 'customer name': 'customer_name',

  'email': 'customer_email', 'e-mail': 'customer_email',
  'e-mail cím': 'customer_email', 'email cím': 'customer_email',

  'telefon': 'customer_phone', 'telefonszám': 'customer_phone',
  'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
  'phone number': 'customer_phone',

  'dátum': 'date', 'date': 'date', 'foglalás dátuma': 'date', 'appointment date': 'date',

  'időpont': 'start_time', 'kezdés': 'start_time', 'kezdési idő': 'start_time',
  'kezdési idő (hh:mm)': 'start_time', 'time': 'start_time',
  'start time': 'start_time', 'appointment time': 'start_time',

  'vége': 'end_time', 'befejezési idő': 'end_time', 'befejezési idő (hh:mm)': 'end_time',
  'end time': 'end_time', 'end': 'end_time',

  'fő': 'pax', 'pax': 'pax', 'guests': 'pax', 'vendégek száma': 'pax', 'covers': 'pax',

  'szolgáltatás': 'service', 'service': 'service', 'treatment': 'service', 'kezelés': 'service',

  'munkatárs': 'staff', 'szakember': 'staff', 'staff': 'staff',
  'stylist': 'staff', 'employee': 'staff', 'therapist': 'staff',

  'időtartam (perc)': 'duration', 'időtartam': 'duration', 'duration': 'duration',
  'duration (min)': 'duration', 'duration (minutes)': 'duration',

  'ár (ft)': 'price', 'ár': 'price', 'price': 'price', 'díj': 'price',

  'státusz': 'status', 'status': 'status', 'booking status': 'status',

  'megjegyzés': 'notes', 'megjegyzések': 'notes', 'notes': 'notes',
  'note': 'notes', 'comment': 'notes', 'comments': 'notes',
}

function autoDetect(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const match = ALIASES[h.toLowerCase().trim()]
    if (match) map[h] = match
  }
  return map
}

// ── Field options for the mapping dropdowns ──────────────────────────────

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— figyelmen kívül hagy —' },
  { value: 'customer_name', label: 'Ügyfél / vendég neve' },
  { value: 'customer_email', label: 'Email' },
  { value: 'customer_phone', label: 'Telefon' },
  { value: 'date', label: 'Dátum (ÉÉÉÉ-HH-NN)' },
  { value: 'start_time', label: 'Kezdési idő' },
  { value: 'end_time', label: 'Befejezési idő' },
  { value: 'pax', label: 'Fő (étterem)' },
  { value: 'service', label: 'Szolgáltatás neve' },
  { value: 'staff', label: 'Munkatárs / szakember neve' },
  { value: 'duration', label: 'Időtartam (perc)' },
  { value: 'price', label: 'Ár' },
  { value: 'status', label: 'Státusz' },
  { value: 'notes', label: 'Megjegyzés' },
]

// ── Component ────────────────────────────────────────────────────────────

interface ImportResult {
  imported: { customers: number; bookings: number }
  skipped: number
  errors: string[]
}

export function ImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const loadFile = useCallback((file: File) => {
    setResult(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(autoDetect(parsed.headers))
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) loadFile(file)
    else toast.error('Csak .csv fájl fogadható el')
  }, [loadFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  const reset = () => {
    setFileName(null)
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
  }

  const runImport = async () => {
    if (!headers.length || !rows.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headers, rows, userMapping: mapping }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Import sikertelen')
      setResult(data)
      toast.success(`Importálás kész — ${data.imported.customers} vendég, ${data.imported.bookings} foglalás`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }

  const PREVIEW_ROWS = 5

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Importálj adatokat más foglalórendszerből (Salonic, Fresha, SimplyBook stb.) — CSV formátumban.
        A rendszer automatikusan felismeri az oszlopokat; az egyezéseket manuálisan is beállíthatod.
      </p>

      {/* Drop zone */}
      {!fileName && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'w-full rounded-[22px] border-2 border-dashed transition-colors p-10 flex flex-col items-center gap-3 text-center',
            dragging ? 'border-gold bg-gold/[0.06]' : 'border-line-strong hover:border-ink-soft2/60 hover:bg-paper',
          )}
        >
          <Upload className="h-8 w-8 text-ink-soft2" />
          <div>
            <p className="font-medium text-ink">CSV fájl feltöltése</p>
            <p className="text-sm text-ink-soft mt-0.5">Húzd ide vagy kattints a kiválasztáshoz</p>
            <p className="text-xs text-ink-soft2 mt-2">Salonic · Fresha · SimplyBook · saját export</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </button>
      )}

      {/* File loaded */}
      {fileName && (
        <div className="space-y-5">
          {/* File info + reset */}
          <div className="flex items-center justify-between gap-3 rounded-2xl dav-card-glass px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
              <span className="text-sm font-medium text-ink truncate">{fileName}</span>
              <span className="text-xs text-ink-soft2 shrink-0">{rows.length} sor</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-ink-soft hover:text-ink transition-colors"
              aria-label="Fájl eltávolítása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Column mapping */}
          <div className="rounded-[22px] dav-card-glass p-5 space-y-3">
            <p className="text-sm font-semibold text-ink">Oszlopleképezés</p>
            <p className="text-xs text-ink-soft">A felismert oszlopokat manuálisan is átírhatod.</p>
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft2 w-40 truncate shrink-0 font-mono bg-paper rounded-lg px-2 py-1">{h}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-soft2 shrink-0" />
                  <div className="relative flex-1">
                    <select
                      value={mapping[h] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                      className="w-full text-xs rounded-xl border border-line-strong bg-white px-3 py-2 pr-7 text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-gold/50"
                    >
                      {FIELD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-soft2 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="rounded-[22px] dav-card-glass p-5 space-y-3 overflow-hidden">
              <p className="text-sm font-semibold text-ink">Előnézet — első {Math.min(PREVIEW_ROWS, rows.length)} sor</p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="pb-2 pr-4 text-ink-soft font-medium whitespace-nowrap">
                          {h}
                          {mapping[h] && (
                            <span className="ml-1 text-gold font-normal">→ {FIELD_OPTIONS.find(o => o.value === mapping[h])?.label.split(' ')[0]}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                      <tr key={ri} className="border-t border-line/50">
                        {headers.map((_, ci) => (
                          <td key={ci} className="py-1.5 pr-4 text-ink-soft2 whitespace-nowrap max-w-[140px] truncate">
                            {row[ci] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import button */}
          {!result && (
            <button
              type="button"
              onClick={runImport}
              disabled={loading || !rows.length}
              className={cn(
                'w-full rounded-2xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                'bg-ink-dark text-white hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Importálás folyamatban…</>
                : <><Upload className="h-4 w-4" /> {rows.length} sor importálása</>
              }
            </button>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-[22px] dav-card-glass p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-ink">Importálás kész</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-paper px-4 py-3 text-center">
                  <p className="text-2xl font-light text-ink">{result.imported.customers}</p>
                  <p className="text-xs text-ink-soft mt-0.5">Új vendég</p>
                </div>
                <div className="rounded-2xl bg-paper px-4 py-3 text-center">
                  <p className="text-2xl font-light text-ink">{result.imported.bookings}</p>
                  <p className="text-xs text-ink-soft mt-0.5">Foglalás</p>
                </div>
                <div className="rounded-2xl bg-paper px-4 py-3 text-center">
                  <p className="text-2xl font-light text-ink">{result.skipped}</p>
                  <p className="text-xs text-ink-soft mt-0.5">Kihagyva</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-xl bg-bad/[0.06] border border-bad/20 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-bad">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <p className="text-xs font-semibold">Figyelmeztetések ({result.errors.length})</p>
                  </div>
                  {result.errors.slice(0, 8).map((e, i) => (
                    <p key={i} className="text-xs text-ink-soft ml-5">{e}</p>
                  ))}
                  {result.errors.length > 8 && (
                    <p className="text-xs text-ink-soft2 ml-5">+ {result.errors.length - 8} további…</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-2xl border border-line-strong bg-white py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
                >
                  Új importálás
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
