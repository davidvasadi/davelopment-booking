'use client'

import { useRef, useState } from 'react'
import type { WorkBook } from 'xlsx'
import { toast } from 'sonner'
import { Button, Card, Meta } from '@/components/ui-kit'
import { ImportDrop, ImportFileBar, ImportSheets } from '@/components/blocks/importer'
import { detectTypeFromHeaders, guessTypeFromSheet, type ImportType } from '@/lib/importSchema'

/**
 * A regisztráció és az új üzlet import-lépése — a rövid változat (design 23.5): ledobó → a fájl munkalapjai (felismert
 * típus, sorok) → egy gombbal mind → darabszámok. Az oszlop-párosítás itt automatikus; finomhangolni a Beállítások ›
 * Integrációk › Import alatt lehet. Kihagyható. A felismerés közös a teljes importtal (lib/importSchema).
 * `isDark`: mobilon a sötét videón — ott fehér kártyán ül, hogy a kit elemei olvashatók maradjanak.
 */

const TYPE_LABELS: Record<ImportType, string> = {
  staff: 'Munkatársak', customers: 'Vendégek', tables: 'Asztalok', services: 'Szolgáltatások', bookings: 'Foglalások',
  opening_hours: 'Nyitvatartás', rooms: 'Termek / zónák', service_categories: 'Kategóriák', billing_info: 'Számlázási adatok',
}

interface Sheet { name: string; importType: ImportType; headers: string[]; rows: string[][] }

export function WizardImportStep({ isDark, onContinue, continueLabel = 'Tovább' }: { isDark: boolean; onContinue: () => void; continueLabel?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [reading, setReading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState<{ sheet: string; count: number }[] | null>(null)
  const [dragging, setDragging] = useState(false)

  // az Excel-olvasó (xlsx) csak a fájl kiválasztásakor töltődik be (sebesség, docs/audit/2026-11-05_1921)
  const parseFile = async (file: File) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.name)
    if (!ok) { toast.error('Csak .csv vagy .xlsx fájl fogadható el'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('A fájl mérete maximum 5 MB lehet'); return }
    const { read, utils } = await import('xlsx')
    setFileName(file.name)
    setSheets([])
    setCounts(null)
    setReading(true)
    const reader = new FileReader()
    const toSheet = (name: string, data: unknown[][]): Sheet | null => {
      if (!data.length) return null
      const headers = (data[0] as unknown[]).map(String)
      const rows = (data.slice(1) as unknown[][])
        .filter((r) => r.some((c) => String(c).trim()))
        .map((r) => headers.map((_, i) => String(r[i] ?? '')))
      if (!rows.length) return null
      return { name, importType: guessTypeFromSheet(name) ?? detectTypeFromHeaders(headers) ?? 'bookings', headers, rows }
    }
    const fromWorkbook = (wb: WorkBook, names?: string[]) => wb.SheetNames.flatMap((n, i) => {
      const s = toSheet(names?.[i] ?? n, utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '', raw: false }))
      return s ? [s] : []
    })

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.onload = (e) => {
        try {
          const raw = (e.target?.result as string).replace(/^﻿/, '')
          if (/(?:^|\n)# /.test(raw)) {
            // több szakaszos CSV (# Szakasznév) — szakaszonként egy „munkalap”
            const parsed: Sheet[] = []
            for (const section of raw.split(/\r?\n(?=# )/)) {
              const lines = section.split(/\r?\n/)
              const name = lines[0].replace(/^# /, '').trim()
              const csv = lines.slice(1).filter((l) => !l.startsWith('#')).join('\n')
              if (!csv.trim()) continue
              try { parsed.push(...fromWorkbook(read(csv, { type: 'string', dateNF: 'yyyy-mm-dd' }), [name])) } catch { /* hibás szakasz */ }
            }
            setSheets(parsed)
          } else {
            setSheets(fromWorkbook(read(raw, { type: 'string', dateNF: 'yyyy-mm-dd' })).map((s) => ({ ...s, name: file.name.replace(/\.csv$/i, '') })))
          }
        } catch { toast.error('A fájlt nem tudtuk beolvasni') } finally { setReading(false) }
      }
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.onload = (e) => {
        try { setSheets(fromWorkbook(read(e.target?.result as ArrayBuffer, { type: 'array' }))) } catch { toast.error('A fájlt nem tudtuk beolvasni') } finally { setReading(false) }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const reset = () => { setFileName(null); setSheets([]); setCounts(null) }

  const runImport = async () => {
    if (!sheets.length) return
    setLoading(true)
    const results: { sheet: string; count: number }[] = []
    for (const sheet of sheets) {
      try {
        const res = await fetch('/api/import-csv', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: sheet.headers, rows: sheet.rows, importType: sheet.importType }),
        })
        const data = await res.json().catch(() => null)
        const count = data?.imported ? (Object.values(data.imported) as number[]).reduce((a, b) => a + b, 0) : 0
        results.push({ sheet: sheet.name, count })
      } catch { results.push({ sheet: sheet.name, count: 0 }) }
    }
    setCounts(results)
    setLoading(false)
    const total = results.reduce((a, r) => a + r.count, 0)
    toast.success(`Importálás kész — ${total} rekord`)
  }

  const total = sheets.reduce((a, s) => a + s.rows.length, 0)
  const body = (
    <div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f); e.target.value = '' }} />
      {!fileName ? (
        <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void parseFile(f) }}>
          <ImportDrop compact dragging={dragging} onPick={() => fileRef.current?.click()} />
        </div>
      ) : (
        <>
          <ImportFileBar name={fileName} rows={sheets.length ? total : null} types={[]} willCreate={null} onRemove={counts ? undefined : reset} />
          {reading ? <Meta className="mt-4 text-center">Fájl beolvasása…</Meta>
            : sheets.length ? (
              <ImportSheets className="mt-3" pickHint={false} busy={loading} onAll={runImport}
                allLabel={sheets.length > 1 ? `Mind a ${sheets.length} munkalap importálása` : `Importálás (${total.toLocaleString('hu-HU')} sor)`}
                sheets={sheets.map((s) => ({ name: s.name, type: TYPE_LABELS[s.importType] ?? s.importType, rows: s.rows.length, done: counts ? counts.find((c) => c.sheet === s.name)?.count ?? 0 : null }))} />
            ) : <Meta className="mt-4 text-center">Nem találtunk beolvasható sort ebben a fájlban.</Meta>}
        </>
      )}
      <div className="mt-5 flex gap-1.5">
        {counts
          ? <Button className="flex-1" onClick={onContinue}>{continueLabel}</Button>
          : <Button variant="cell" className="flex-1" onClick={onContinue} disabled={loading}>Kihagyom</Button>}
      </div>
      {!counts && <Meta className="mt-2 text-center">Az oszlopokat mi párosítjuk — finomhangolni később a Beállítások › Integrációk alatt lehet.</Meta>}
    </div>
  )
  // mobilon a sötét videón: fehér kártyán (a kit elemei világos felületre készültek)
  return isDark ? <Card tone="white" pad="md" className="mt-4">{body}</Card> : <div className="mt-4">{body}</div>
}
