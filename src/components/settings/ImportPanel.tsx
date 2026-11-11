'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, Meta } from '@/components/ui-kit'
import { ImportDrop, ImportFileBar, ImportMapping, ImportMatch, ImportPreview, ImportResult, ImportSheets, ImportSteps } from '@/components/blocks/importer'
import { ALIASES_BY_TYPE, FIELD_OPTIONS_BY_TYPE, detectTypeFromHeaders, guessTypeFromSheet, type ImportType } from '@/lib/importSchema'
import type { EntityKind, EntityMap } from '@/lib/importMatching'
import { buildMatchGroups, initialDecisions, setMatchChoice, type MatchReport } from './ImportMatchStep'

// ── CSV parser ────────────────────────────────────────────────────────────

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

// ── XLSX parser ──────────────────────────────────────────────────────────

// Az Excel-olvasó (xlsx) nagy — csak akkor töltődik be, amikor valaki Excel-fájlt választ (sebesség,
// docs/audit/2026-11-05_1921). A parseXLSX ezután szinkron használható (a modul már bent van).
let XLSX: typeof import('xlsx') | null = null
const loadXlsx = async () => (XLSX ??= await import('xlsx'))

function parseXLSX(buffer: ArrayBuffer, sheetName?: string): { headers: string[]; rows: string[][]; sheetNames: string[] } {
  if (!XLSX) return { headers: [], rows: [], sheetNames: [] }
  const { read, utils } = XLSX
  const wb = read(buffer, { type: 'array', dateNF: 'yyyy-mm-dd' })
  const sheetNames = wb.SheetNames
  const ws = wb.Sheets[sheetName ?? sheetNames[0]]
  if (!ws) return { headers: [], rows: [], sheetNames }
  const data = utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })
  if (!data.length) return { headers: [], rows: [], sheetNames }
  const headers = (data[0] as unknown[]).map(String)
  const rows = (data.slice(1) as unknown[][]).map((r) => headers.map((_, i) => String(r[i] ?? '')))
  return { headers, rows, sheetNames }
}

// ── Import types ──────────────────────────────────────────────────────────

const IMPORT_TYPES: { value: ImportType; label: string; hint: string; group?: string }[] = [
  { value: 'bookings',          label: 'Foglalások',         hint: 'Foglalások + vendégek más rendszerből', group: 'Tranzakciók' },
  { value: 'customers',         label: 'Vendégek',           hint: 'Vendég-/ügyféllista foglalások nélkül', group: 'Tranzakciók' },
  { value: 'staff',             label: 'Munkatársak',        hint: 'Csapattagok neve, email, beosztás (szalon)', group: 'Csapat & katalógus' },
  { value: 'services',          label: 'Szolgáltatások',     hint: 'Szolgáltatáskatalógus — név, időtartam, ár (szalon)', group: 'Csapat & katalógus' },
  { value: 'service_categories',label: 'Kategóriák',         hint: 'Szolgáltatáskategóriák (szalon)', group: 'Csapat & katalógus' },
  { value: 'tables',            label: 'Asztalok',           hint: 'Asztalkonfiguráció — névre + férőhelyre (étterem)', group: 'Étterem konfig' },
  { value: 'rooms',             label: 'Termek / zónák',     hint: 'Éttermi szobák és területek (étterem)', group: 'Étterem konfig' },
  { value: 'opening_hours',     label: 'Nyitvatartás',       hint: 'Napi nyitva / zárva + időpontok (étterem)', group: 'Étterem konfig' },
  { value: 'billing_info',      label: 'Számlázási adatok',  hint: 'Cégadatok frissítése — adószám, székhely stb.', group: 'Vállalkozás' },
]



// Oszlop-indexszel kulcsolva, NEM a fejléc-szöveggel — egy valós exportban (pl. Salonic)
// előfordulhat két AZONOS nevű oszlop (pl. kétszer "Életkor"); fejléc-szöveg kulcs esetén a
// második felülírná az elsőt a mapping-objektumban (és a React is duplikált key-hibát adna),
// holott a ténylegesen beküldött sor-adat oszlop-POZÍCIÓ szerint különbözik.
function autoDetect(headers: string[], type: ImportType): Record<number, string> {
  const aliases = ALIASES_BY_TYPE[type]
  const map: Record<number, string> = {}
  headers.forEach((h, i) => {
    const match = aliases[h.toLowerCase().trim()]
    if (match) map[i] = match
  })
  return map
}

// ── Result type ───────────────────────────────────────────────────────────

interface ImportResult {
  imported: {
    customers: number
    bookings: number
    staff: number
    tables: number
    services: number
    opening_hours: number
    rooms: number
    service_categories: number
    billing_info: number
  }
  // meglévő vendég, akit az import kiegészített (nem új, de nem is „kihagyott”)
  updated?: number
  skipped: number
  // már létező foglalás / elem — újraimportnál nem jön létre újra
  duplicates?: number
  // az import során újonnan létrehozott elemek (vendég-/foglalás-importnál inaktívak)
  created?: Partial<Record<EntityKind, string[]>>
  errors: string[]
}

const RESULT_LABELS: Record<ImportType, { key: keyof ImportResult['imported']; label: string }[]> = {
  bookings:          [{ key: 'customers', label: 'Új vendég' }, { key: 'bookings', label: 'Foglalás' }],
  customers:         [{ key: 'customers', label: 'Új vendég' }],
  staff:             [{ key: 'staff', label: 'Munkatárs' }],
  tables:            [{ key: 'tables', label: 'Asztal' }],
  services:          [{ key: 'services', label: 'Szolgáltatás' }],
  opening_hours:     [{ key: 'opening_hours', label: 'Nap beállítva' }],
  rooms:             [{ key: 'rooms', label: 'Terem / zóna' }],
  service_categories:[{ key: 'service_categories', label: 'Kategória' }],
  billing_info:      [{ key: 'billing_info', label: 'Rekord frissítve' }],
}

// Mi lesz egy sorból (a „20 sor → 20 vendég” sorhoz) és minek látszik a fájl (az eltérő típus figyelmeztetéséhez)
const UNIT: Record<ImportType, string> = { bookings: 'foglalás', customers: 'vendég', staff: 'munkatárs', services: 'szolgáltatás', service_categories: 'kategória', tables: 'asztal', rooms: 'terem / zóna', opening_hours: 'nap', billing_info: 'cégadat' }
const LOOKS_LIKE: Record<ImportType, string> = { bookings: 'foglalás-listának', customers: 'vendéglistának', staff: 'munkatárs-listának', services: 'szolgáltatás-listának', service_categories: 'kategória-listának', tables: 'asztal-listának', rooms: 'terem-listának', opening_hours: 'nyitvatartásnak', billing_info: 'cégadatoknak' }
// melyik típus melyik vállalkozásnál értelmes (szalonnál nincs asztal, étteremnél nincs szolgáltatás-katalógus)
const FOR_KIND: Record<'salon' | 'restaurant', ImportType[]> = {
  salon: ['bookings', 'customers', 'staff', 'services', 'service_categories', 'billing_info'],
  restaurant: ['bookings', 'customers', 'tables', 'rooms', 'opening_hours', 'billing_info'],
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Adatok importálása (design 23.1–23.5) — Beállítások › Integrációk popupjának belseje. Lépések: Fájl (ledobó; a fájl
 * sora, hogy egy sor mi legyen, és mi lesz belőle; eltérő típusnál figyelmeztetés) → Oszlopok (párosítás + előnézet)
 * → Párosítás (a fájlbeli nevek a meglévőkhöz) → Kész. Több munkalapnál a lapok listája, egy gombbal mind.
 */
export function ImportPanel({ kind = 'salon', sampleHref }: { kind?: 'salon' | 'restaurant'; sampleHref?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ImportType>('bookings')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  // több munkalapnál: kiválasztott-e egy lapot átnézésre (addig csak a lapok listája látszik)
  const [sheetPicked, setSheetPicked] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [csvSections, setCsvSections] = useState<Record<string, { headers: string[]; rows: string[][] }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [allSheetsResult, setAllSheetsResult] = useState<{ sheet: string; count: number; label: string }[] | null>(null)
  // eltérő típus megerősítve (a figyelmeztetés eltűnik)
  const [mismatchOk, setMismatchOk] = useState(false)
  // Párosító lépés (munkatárs/szolgáltatás/kategória/asztal/terem) — az import előtt
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null)
  const [decisions, setDecisions] = useState<EntityMap>({})
  const [matchLoading, setMatchLoading] = useState(false)

  const types = IMPORT_TYPES.filter((t) => FOR_KIND[kind].includes(t.value))
  const labelOf = (t: ImportType) => IMPORT_TYPES.find((x) => x.value === t)?.label ?? t

  const applySheet = useCallback((buffer: ArrayBuffer, sheet: string, type: ImportType) => {
    const parsed = parseXLSX(buffer, sheet)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(autoDetect(parsed.headers, type))
  }, [])

  const loadFile = useCallback((file: File) => {
    setResult(null)
    setAllSheetsResult(null)
    setMatchReport(null)
    setMismatchOk(false)
    setSheetPicked(false)
    setFileName(file.name)
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const reader = new FileReader()
    if (isExcel) {
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer
        await loadXlsx()
        const parsed = parseXLSX(buffer)
        setXlsxBuffer(buffer)
        setSheetNames(parsed.sheetNames)
        const firstSheet = parsed.sheetNames[0] ?? ''
        setActiveSheet(firstSheet)
        const guessed = guessTypeFromSheet(firstSheet) ?? detectTypeFromHeaders(parsed.headers)
        const resolvedType = guessed ?? 'bookings'
        setImportType(resolvedType)
        setHeaders(parsed.headers)
        setRows(parsed.rows)
        setMapping(autoDetect(parsed.headers, resolvedType))
      }
      reader.readAsArrayBuffer(file)
    } else {
      setXlsxBuffer(null)
      setActiveSheet(null)
      reader.onload = (e) => {
        const raw = (e.target?.result as string)
        const clean = raw.replace(/^\uFEFF/, '')
        if (/(?:^|\n)# /.test(clean)) {
          const sections = clean.split(/\r?\n(?=# )/)
          const sectionMap: Record<string, { headers: string[]; rows: string[][] }> = {}
          for (const section of sections) {
            const lines = section.split(/\r?\n/)
            const sectionName = lines[0].replace(/^# /, '').trim()
            const csvContent = lines.slice(1).filter(l => !l.startsWith('#')).join('\n')
            if (!csvContent.trim()) continue
            const parsed = parseCSV(csvContent)
            if (!parsed.headers.length) continue
            sectionMap[sectionName] = parsed
          }
          const names = Object.keys(sectionMap)
          if (!names.length) return
          setCsvSections(sectionMap)
          setSheetNames(names)
          const first = names[0]
          setActiveSheet(first)
          const firstSection = sectionMap[first]
          const guessed = guessTypeFromSheet(first) ?? detectTypeFromHeaders(firstSection.headers) ?? 'bookings'
          setImportType(guessed)
          setHeaders(firstSection.headers)
          setRows(firstSection.rows)
          setMapping(autoDetect(firstSection.headers, guessed))
        } else {
          setCsvSections(null)
          setSheetNames([])
          const parsed = parseCSV(raw)
          const guessed = detectTypeFromHeaders(parsed.headers) ?? 'bookings'
          setImportType(guessed)
          setHeaders(parsed.headers)
          setRows(parsed.rows)
          setMapping(autoDetect(parsed.headers, guessed))
        }
      }
      reader.readAsText(file, 'UTF-8')
    }
  }, [])

  const switchSheet = (sheet: string) => {
    setActiveSheet(sheet)
    setSheetPicked(true)
    setResult(null)
    setMatchReport(null)
    setMismatchOk(false)
    if (xlsxBuffer) {
      const guessed = guessTypeFromSheet(sheet) ?? detectTypeFromHeaders(parseXLSX(xlsxBuffer, sheet).headers)
      const resolvedType = guessed ?? importType
      setImportType(resolvedType)
      applySheet(xlsxBuffer, sheet, resolvedType)
    } else if (csvSections?.[sheet]) {
      const section = csvSections[sheet]
      const guessed = guessTypeFromSheet(sheet) ?? detectTypeFromHeaders(section.headers) ?? importType
      setImportType(guessed)
      setHeaders(section.headers)
      setRows(section.rows)
      setMapping(autoDetect(section.headers, guessed))
    }
  }

  const pickFile = (file: File | undefined) => {
    const ok = file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))
    if (!ok) { toast.error('Csak .csv vagy .xlsx fájl fogadható el'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('A fájl mérete maximum 5 MB lehet'); return }
    loadFile(file)
  }

  const reset = () => {
    setFileName(null)
    setXlsxBuffer(null)
    setCsvSections(null)
    setSheetNames([])
    setActiveSheet(null)
    setSheetPicked(false)
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
    setAllSheetsResult(null)
    setMatchReport(null)
    setMismatchOk(false)
  }

  const handleTypeChange = (t: ImportType) => {
    setImportType(t)
    setMatchReport(null)
    setMismatchOk(false)
    if (xlsxBuffer && activeSheet) {
      applySheet(xlsxBuffer, activeSheet, t)
    } else if (headers.length) {
      setMapping(autoDetect(headers, t))
    }
  }

  // több munkalap: lapok a felismert típussal és a sorok számával (a listához)
  const sheetInfo = useMemo(() => sheetNames.map((name) => {
    const parsed = xlsxBuffer ? parseXLSX(xlsxBuffer, name) : csvSections?.[name] ?? { headers: [], rows: [] }
    const t = guessTypeFromSheet(name) ?? detectTypeFromHeaders(parsed.headers) ?? 'bookings'
    return { name, type: labelOf(t), rows: parsed.rows.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sheetNames, xlsxBuffer, csvSections])

  const importAllSheets = async () => {
    if (!sheetNames.length) return
    setLoading(true)
    const results: { sheet: string; count: number; label: string }[] = []
    for (const sheet of sheetNames) {
      let sHeaders: string[]
      let sRows: string[][]
      if (xlsxBuffer) {
        const parsed = parseXLSX(xlsxBuffer, sheet)
        sHeaders = parsed.headers
        sRows = parsed.rows
      } else if (csvSections?.[sheet]) {
        sHeaders = csvSections[sheet].headers
        sRows = csvSections[sheet].rows
      } else continue
      if (!sRows.length) continue
      const guessed = guessTypeFromSheet(sheet) ?? detectTypeFromHeaders(sHeaders) ?? 'bookings'
      const sheetMapping = autoDetect(sHeaders, guessed)
      try {
        const res = await fetch('/api/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ headers: sHeaders, rows: sRows, userMapping: sheetMapping, importType: guessed }),
        })
        const data = await res.json().catch(() => null)
        if (data?.imported) {
          const total = (Object.values(data.imported) as number[]).reduce((a, b) => a + b, 0)
          results.push({ sheet, count: total, label: labelOf(guessed) })
        }
      } catch { /* non-blocking */ }
    }
    setAllSheetsResult(results)
    setLoading(false)
    const total = results.reduce((a, r) => a + r.count, 0)
    toast.success(`Importálás kész — ${total} rekord összesen`)
  }

  const runImport = async (entityMap: EntityMap = decisions) => {
    if (!headers.length || !rows.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headers, rows, userMapping: mapping, importType, entityMap }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Import sikertelen')
      setResult(data)
      const counts = RESULT_LABELS[importType].map((r) => `${data.imported[r.key]} ${r.label}`).join(', ')
      toast.success(`${labelOf(importType)} importálás kész — ${counts}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }

  // a fájlbeli nevek párosítása a meglévő elemekkel. Ha nincs mit párosítani, az import egyből indul.
  const checkMatches = async () => {
    if (!headers.length || !rows.length) return
    setMatchLoading(true)
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headers, rows, userMapping: mapping, importType, mode: 'match' }),
      })
      const data = (await res.json().catch(() => null)) as MatchReport | { error?: string } | null
      if (!res.ok || !data || !('kinds' in data)) throw new Error((data as { error?: string } | null)?.error ?? 'A párosítás nem sikerült')
      if (!Object.values(data.kinds).some((k) => k?.rows.length)) {
        await runImport({})
        return
      }
      setMatchReport(data)
      setDecisions(initialDecisions(data))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setMatchLoading(false)
    }
  }

  const catalogImport = ['staff', 'services', 'service_categories', 'tables', 'rooms'].includes(importType)
  const fieldOptions = FIELD_OPTIONS_BY_TYPE[importType]
  const multi = sheetNames.length > 1
  // eltérő típus: a fájl oszlopai alapján mást ismerünk fel, mint ami ki van választva
  const detected = headers.length ? detectTypeFromHeaders(headers) : null
  const mismatch = !!detected && detected !== importType && FOR_KIND[kind].includes(detected)
  const blocked = mismatch && !mismatchOk
  const step = result || allSheetsResult ? 3 : matchReport ? 2 : fileName ? 1 : 0
  const base = kind === 'restaurant' ? '/restaurant' : '/dashboard'
  const HREF: Partial<Record<ImportType, [string, string]>> = {
    bookings: [`${base}/bookings`, 'Foglalások megnyitása'], customers: [`${base}/guests`, 'Vendégek megnyitása'], staff: [`${base}/staff`, 'Munkatársak megnyitása'],
    services: ['/dashboard/services', 'Szolgáltatások megnyitása'], service_categories: ['/dashboard/services', 'Szolgáltatások megnyitása'],
    tables: ['/restaurant/settings?tab=tables', 'Asztalok megnyitása'], rooms: ['/restaurant/settings?tab=tables', 'Asztalok megnyitása'],
  }

  // a párosított oszlopok előnézete a nálunk használt címekkel
  const mappedCols = headers.map((_, i) => i).filter((i) => mapping[i])
  const fieldLabel = (v: string) => fieldOptions.find((o) => o.value === v)?.label ?? v

  return (
    <div>
      <ImportSteps active={step} />
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />

      {/* 1. a fájl */}
      {!fileName && (
        <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}>
          <ImportDrop dragging={dragging} onPick={() => fileRef.current?.click()} sampleHref={sampleHref} />
        </div>
      )}

      {fileName && !result && (
        <ImportFileBar name={fileName} rows={multi ? null : rows.length}
          types={multi && !sheetPicked ? [] : types} type={importType} onType={(v) => handleTypeChange(v as ImportType)} onRemove={reset}
          willCreate={multi && !sheetPicked ? null : `${rows.length.toLocaleString('hu-HU')} sor → ${rows.length.toLocaleString('hu-HU')} ${UNIT[importType]}`}
          warn={mismatch && detected && (!multi || sheetPicked) ? {
            text: `A fájl oszlopai alapján ez ${LOOKS_LIKE[detected]} látszik. ${labelOf(importType)}ként minden sorból egy ${UNIT[importType]} lenne — biztosan így olvassuk be?`,
            detectedLabel: labelOf(detected), confirmed: mismatchOk, onConfirm: () => setMismatchOk(true), onRevert: () => handleTypeChange(detected),
          } : null} />
      )}

      {/* több munkalap: a lapok, egy gombbal mind; vagy egy lap átnézése */}
      {multi && !result && (
        <ImportSheets className="mt-4" active={sheetPicked ? activeSheet : null} busy={loading} onAll={importAllSheets} onSheet={switchSheet}
          sheets={sheetInfo.map((s) => ({ ...s, done: allSheetsResult ? allSheetsResult.find((r) => r.sheet === s.name)?.count ?? 0 : null }))} />
      )}
      {allSheetsResult && <Button variant="cell" className="mt-4 w-full" onClick={reset}>Új import</Button>}

      {/* 2. oszlopok */}
      {fileName && !result && !matchReport && !allSheetsResult && headers.length > 0 && (!multi || sheetPicked) && (
        <>
          <ImportMapping className="mt-6" fields={fieldOptions} onField={(k, v) => setMapping((prev) => ({ ...prev, [Number(k)]: v }))}
            rows={headers.map((h, i) => ({ key: i, header: h, field: mapping[i] ?? '', sample: rows[0]?.[i] }))} />
          {mappedCols.length > 0 && rows.length > 0 && (
            <ImportPreview className="mt-6" total={rows.length} head={mappedCols.map((i) => fieldLabel(mapping[i]))} rows={rows.slice(0, 5).map((r) => mappedCols.map((i) => r[i] ?? ''))} />
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-1.5 max-lg:[&>*]:min-w-0 max-lg:[&>*]:flex-1">
            <Button variant="cell" onClick={reset}>Mégse</Button>
            <Button loading={matchLoading || loading} disabled={blocked || !rows.length || !mappedCols.length} onClick={checkMatches}>Tovább: párosítás</Button>
          </div>
          {blocked && <Meta className="mt-2 text-right">Előbb döntsd el fent, milyen adatként olvassuk be.</Meta>}
        </>
      )}

      {/* 3. párosítás */}
      {matchReport && !result && (
        <>
          <ImportMatch className="mt-6" groups={buildMatchGroups(matchReport, decisions, catalogImport)} onChoice={(k, v, c) => setDecisions((d) => setMatchChoice(d, k, v, c))}
            note={catalogImport ? 'Az újak aktívan jönnek létre; a meglévők nem változnak.' : 'Amit újként hozunk létre, az inaktív marad (a szolgáltatások az „Importált” kategóriában), amíg be nem kapcsolod — a foglalóoldalon nem jelenik meg.'} />
          <div className="mt-6 flex flex-wrap justify-end gap-1.5">
            <Button variant="cell" onClick={() => setMatchReport(null)}>Vissza</Button>
            <Button loading={loading} onClick={() => runImport()}>{rows.length.toLocaleString('hu-HU')} sor importálása</Button>
          </div>
        </>
      )}

      {/* 4. kész */}
      {result && (
        <ImportResult className="mt-2" onAgain={reset} errors={result.errors} href={HREF[importType]?.[0]} hrefLabel={HREF[importType]?.[1]}
          stats={[
            ...RESULT_LABELS[importType].map((r) => ({ label: r.label, value: result.imported[r.key] })),
            ...(result.updated ? [{ label: 'Frissítve', value: result.updated }] : []),
            ...(result.duplicates ? [{ label: 'Már megvolt', value: result.duplicates }] : []),
            { label: 'Kihagyva', value: result.skipped },
          ]}>
          {result.created && Object.values(result.created).some((l) => l?.length) && (
            <div className="mt-3 rounded-ui-inner bg-ui-cell px-3 py-2.5">
              <div className="text-ui-meta text-ui-text">Újonnan létrehozva — nézd át</div>
              {(['services', 'staff', 'categories', 'tables', 'rooms'] as EntityKind[]).map((k) => result.created?.[k]?.length ? (
                <Meta key={k} className="mt-1"><span className="text-ui-text">{({ services: 'Szolgáltatások', staff: 'Munkatársak', categories: 'Kategóriák', tables: 'Asztalok', rooms: 'Termek' } as const)[k]}:</span> {result.created[k]!.join(', ')}</Meta>
              ) : null)}
              {!catalogImport && <Meta className="mt-1">Ezek inaktívak, így nem jelennek meg a foglalóoldalon — a Szolgáltatások / Munkatársak oldalon kapcsolhatod be vagy nevezheted át őket.</Meta>}
            </div>
          )}
        </ImportResult>
      )}
    </div>
  )
}
