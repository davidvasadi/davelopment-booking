'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, X, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { read, utils } from 'xlsx'

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

function parseXLSX(buffer: ArrayBuffer, sheetName?: string): { headers: string[]; rows: string[][]; sheetNames: string[] } {
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

type ImportType =
  | 'bookings' | 'customers' | 'staff' | 'tables' | 'services'
  | 'opening_hours' | 'rooms' | 'service_categories' | 'billing_info'

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

const ALIASES_BY_TYPE: Record<ImportType, Record<string, string>> = {
  opening_hours: {
    'nap': 'day_of_week', 'day': 'day_of_week', 'day of week': 'day_of_week',
    'weekday': 'day_of_week', 'napja': 'day_of_week', 'hét napja': 'day_of_week',
    'nyitva': 'is_open', 'is_open': 'is_open', 'nyitva?': 'is_open', 'open': 'is_open', 'open?': 'is_open',
    'nyitás': 'open_time', 'nyitas': 'open_time', 'open time': 'open_time',
    'opens': 'open_time', 'nyitási idő': 'open_time', 'from': 'open_time', 'tól': 'open_time',
    'zárás': 'close_time', 'zaras': 'close_time', 'close time': 'close_time',
    'closes': 'close_time', 'záró idő': 'close_time', 'zárási idő': 'close_time',
  },
  rooms: {
    'terem': 'name', 'terem neve': 'name', 'room': 'name', 'room name': 'name',
    'name': 'name', 'név': 'name', 'szoba': 'name', 'helyiség': 'name',
    'zóna': 'name', 'zona': 'name', 'section': 'name', 'szekció': 'name', 'area': 'name',
    'szabadtéri': 'is_outdoor', 'szabadteri': 'is_outdoor', 'outdoor': 'is_outdoor',
    'aktív': 'is_active', 'aktiv': 'is_active', 'active': 'is_active',
  },
  service_categories: {
    'kategória': 'name', 'kategoria': 'name', 'category': 'name', 'name': 'name', 'név': 'name',
    'csoport': 'name', 'group': 'name', 'type': 'name', 'típus': 'name',
    'sorrend': 'sort_order', 'sort': 'sort_order', 'order': 'sort_order',
    'pozíció': 'sort_order', 'sort order': 'sort_order',
  },
  billing_info: {
    'cégnév': 'legal_name', 'cegnev': 'legal_name', 'legal name': 'legal_name',
    'company name': 'legal_name', 'vállalkozás neve': 'legal_name', 'company': 'legal_name',
    'adószám': 'tax_number', 'adoszam': 'tax_number', 'tax number': 'tax_number',
    'vat number': 'tax_number', 'vat': 'tax_number', 'tax id': 'tax_number',
    'cégjegyzékszám': 'company_reg_number', 'company registration': 'company_reg_number',
    'reg number': 'company_reg_number', 'cégj szám': 'company_reg_number',
    'székhely': 'registered_seat', 'registered address': 'registered_seat', 'registered seat': 'registered_seat',
    'számlázási email': 'billing_email', 'billing email': 'billing_email', 'email': 'billing_email',
    'irányítószám': 'billing_postal_code', 'irsz': 'billing_postal_code',
    'postal code': 'billing_postal_code', 'zip': 'billing_postal_code',
    'város': 'billing_city', 'varos': 'billing_city', 'city': 'billing_city',
    'utca': 'billing_street', 'cím': 'billing_street', 'street': 'billing_street',
    'számlázási cím': 'billing_street', 'billing address': 'billing_street',
  },
  bookings: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
    'vendég': 'customer_name', 'vendég neve': 'customer_name',
    'név': 'customer_name', 'name': 'customer_name',
    'client': 'customer_name', 'client name': 'customer_name',
    'customer': 'customer_name', 'customer name': 'customer_name',
    'guest': 'customer_name', 'guest name': 'customer_name',
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
    'fő': 'pax', 'pax': 'pax', 'guests': 'pax', 'vendégek száma': 'pax', 'covers': 'pax', 'party size': 'pax',
    'szolgáltatás': 'service', 'service': 'service', 'treatment': 'service', 'kezelés': 'service', 'service name': 'service',
    'munkatárs': 'staff', 'szakember': 'staff', 'staff': 'staff',
    'stylist': 'staff', 'employee': 'staff', 'therapist': 'staff', 'provider': 'staff',
    'időtartam (perc)': 'duration', 'időtartam': 'duration', 'duration': 'duration',
    'duration (min)': 'duration', 'duration (minutes)': 'duration',
    'ár (ft)': 'price', 'ár': 'price', 'price': 'price', 'díj': 'price', 'cost': 'price',
    'státusz': 'status', 'status': 'status', 'booking status': 'status',
    'megjegyzés': 'notes', 'megjegyzések': 'notes', 'notes': 'notes', 'note': 'notes', 'comment': 'notes',
  },
  customers: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
    'vendég': 'customer_name', 'vendég neve': 'customer_name',
    'név': 'customer_name', 'name': 'customer_name',
    'customer': 'customer_name', 'customer name': 'customer_name',
    'guest': 'customer_name', 'guest name': 'customer_name',
    'email': 'customer_email', 'e-mail': 'customer_email', 'e-mail cím': 'customer_email',
    'telefon': 'customer_phone', 'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
    'megjegyzés': 'notes', 'notes': 'notes', 'note': 'notes', 'comment': 'notes',
  },
  staff: {
    'név': 'name', 'name': 'name', 'munkatárs': 'name', 'munkatárs neve': 'name',
    'employee': 'name', 'employee name': 'name', 'staff name': 'name', 'full name': 'name',
    'email': 'email', 'e-mail': 'email', 'e-mail cím': 'email',
    'telefon': 'phone', 'phone': 'phone', 'mobile': 'phone', 'mobil': 'phone',
    'pozíció': 'role_title', 'beosztás': 'role_title', 'role': 'role_title',
    'title': 'role_title', 'job title': 'role_title', 'foglalkozás': 'role_title',
    'részleg': 'department', 'department': 'department', 'team': 'department', 'csapat': 'department',
    'születésnap': 'birthday', 'birthday': 'birthday', 'date of birth': 'birthday', 'dob': 'birthday',
  },
  tables: {
    'asztal': 'name', 'asztal neve': 'name', 'table': 'name', 'table name': 'name',
    'name': 'name', 'név': 'name', 'azonosító': 'name',
    'férőhely': 'capacity', 'kapacitás': 'capacity', 'capacity': 'capacity',
    'seats': 'capacity', 'max guests': 'capacity', 'max fő': 'capacity',
  },
  services: {
    'szolgáltatás': 'name', 'service': 'name', 'service name': 'name',
    'name': 'name', 'kezelés': 'name', 'treatment': 'name', 'név': 'name',
    'időtartam': 'duration', 'duration': 'duration', 'időtartam (perc)': 'duration', 'duration (min)': 'duration',
    'ár': 'price', 'price': 'price', 'díj': 'price', 'cost': 'price', 'ár (ft)': 'price',
    'kategória': 'category', 'category': 'category', 'group': 'category', 'csoport': 'category',
  },
}

const FIELD_OPTIONS_BY_TYPE: Record<ImportType, { value: string; label: string }[]> = {
  opening_hours: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'day_of_week', label: 'Nap (pl. Hétfő / Monday)' },
    { value: 'is_open', label: 'Nyitva? (igen/nem)' },
    { value: 'open_time', label: 'Nyitási idő (ÓÓ:PP)' },
    { value: 'close_time', label: 'Zárási idő (ÓÓ:PP)' },
  ],
  rooms: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Terem / zóna neve' },
    { value: 'is_outdoor', label: 'Szabadtéri? (igen/nem)' },
    { value: 'is_active', label: 'Aktív? (igen/nem)' },
  ],
  service_categories: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Kategória neve' },
    { value: 'sort_order', label: 'Sorrend (szám)' },
  ],
  billing_info: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'legal_name', label: 'Cégnév (jogi név)' },
    { value: 'tax_number', label: 'Adószám' },
    { value: 'company_reg_number', label: 'Cégjegyzékszám' },
    { value: 'registered_seat', label: 'Székhely (teljes cím)' },
    { value: 'billing_email', label: 'Számlázási email' },
    { value: 'billing_postal_code', label: 'Irányítószám' },
    { value: 'billing_city', label: 'Város' },
    { value: 'billing_street', label: 'Utca / számlázási cím' },
  ],
  bookings: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'customer_name', label: 'Ügyfél / vendég neve' },
    { value: 'customer_email', label: 'Email' },
    { value: 'customer_phone', label: 'Telefon' },
    { value: 'date', label: 'Dátum (ÉÉÉÉ-HH-NN)' },
    { value: 'start_time', label: 'Kezdési idő' },
    { value: 'end_time', label: 'Befejezési idő' },
    { value: 'pax', label: 'Fő (étterem)' },
    { value: 'service', label: 'Szolgáltatás neve' },
    { value: 'staff', label: 'Munkatárs neve' },
    { value: 'duration', label: 'Időtartam (perc)' },
    { value: 'price', label: 'Ár' },
    { value: 'status', label: 'Státusz' },
    { value: 'notes', label: 'Megjegyzés' },
  ],
  customers: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'customer_name', label: 'Vendég neve' },
    { value: 'customer_email', label: 'Email' },
    { value: 'customer_phone', label: 'Telefon' },
    { value: 'notes', label: 'Megjegyzés' },
  ],
  staff: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Neve' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Telefon' },
    { value: 'role_title', label: 'Pozíció / beosztás' },
    { value: 'department', label: 'Részleg / csapat' },
    { value: 'birthday', label: 'Születésnap' },
  ],
  tables: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Asztal neve' },
    { value: 'capacity', label: 'Férőhely (fő)' },
  ],
  services: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Szolgáltatás neve' },
    { value: 'duration', label: 'Időtartam (perc)' },
    { value: 'price', label: 'Ár' },
    { value: 'category', label: 'Kategória neve' },
  ],
}

function autoDetect(headers: string[], type: ImportType): Record<string, string> {
  const aliases = ALIASES_BY_TYPE[type]
  const map: Record<string, string> = {}
  for (const h of headers) {
    const match = aliases[h.toLowerCase().trim()]
    if (match) map[h] = match
  }
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
  skipped: number
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

// ── Component ────────────────────────────────────────────────────────────

// Sheet name → import type auto-suggestion
const SHEET_NAME_MAP: Record<string, ImportType> = {
  'munkatársak': 'staff', 'munkatarsak': 'staff', 'staff': 'staff', 'employees': 'staff', 'team': 'staff',
  'szolgáltatások': 'services', 'szolgaltatasok': 'services', 'services': 'services', 'treatments': 'services',
  'asztalok': 'tables', 'tables': 'tables',
  'vendégek': 'customers', 'vendegek': 'customers', 'customers': 'customers', 'guests': 'customers', 'ügyfelek': 'customers', 'ugyfelek': 'customers',
  'foglalások': 'bookings', 'foglalasok': 'bookings', 'bookings': 'bookings', 'reservations': 'bookings', 'appointments': 'bookings',
  'nyitvatartás': 'opening_hours', 'nyitvatartas': 'opening_hours', 'opening hours': 'opening_hours', 'hours': 'opening_hours', 'órarend': 'opening_hours',
  'termek': 'rooms', 'szobák': 'rooms', 'szobak': 'rooms', 'rooms': 'rooms', 'sections': 'rooms', 'zónák': 'rooms', 'zones': 'rooms',
  'kategóriák': 'service_categories', 'kategoriak': 'service_categories', 'categories': 'service_categories', 'kategoriák': 'service_categories',
  'számlázás': 'billing_info', 'szamlazas': 'billing_info', 'billing': 'billing_info', 'cégadatok': 'billing_info', 'cegadatok': 'billing_info', 'company': 'billing_info',
}

function guessTypeFromSheet(name: string): ImportType | null {
  return SHEET_NAME_MAP[name.toLowerCase().trim()] ?? null
}

function detectTypeFromHeaders(headers: string[]): ImportType | null {
  const norm = headers.map((h) => h.toLowerCase().trim())
  let best: ImportType | null = null
  let bestScore = 0
  for (const [type, aliases] of Object.entries(ALIASES_BY_TYPE) as [ImportType, Record<string, string>][]) {
    const score = norm.filter((h) => h in aliases).length
    if (score > bestScore) { bestScore = score; best = type }
  }
  return bestScore >= 2 ? best : null
}

export function ImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ImportType>('bookings')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [csvSections, setCsvSections] = useState<Record<string, { headers: string[]; rows: string[][] }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [allSheetsResult, setAllSheetsResult] = useState<{ sheet: string; count: number; label: string }[] | null>(null)
  const [showTypeOverride, setShowTypeOverride] = useState(false)

  const applySheet = useCallback((buffer: ArrayBuffer, sheet: string, type: ImportType) => {
    const parsed = parseXLSX(buffer, sheet)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(autoDetect(parsed.headers, type))
  }, [])

  const loadFile = useCallback((file: File) => {
    setResult(null)
    setAllSheetsResult(null)
    setShowTypeOverride(false)
    setFileName(file.name)
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const reader = new FileReader()
    if (isExcel) {
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer
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
        const clean = raw.replace(/^﻿/, '')
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
    setResult(null)
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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    const ok = file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))
    if (ok) loadFile(file)
    else toast.error('Csak .csv vagy .xlsx fájl fogadható el')
  }, [loadFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  const reset = () => {
    setFileName(null)
    setXlsxBuffer(null)
    setCsvSections(null)
    setSheetNames([])
    setActiveSheet(null)
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
    setAllSheetsResult(null)
    setShowTypeOverride(false)
  }

  const handleTypeChange = (t: ImportType) => {
    setImportType(t)
    if (xlsxBuffer && activeSheet) {
      applySheet(xlsxBuffer, activeSheet, t)
    } else if (headers.length) {
      setMapping(autoDetect(headers, t))
    }
  }

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
          results.push({ sheet, count: total, label: IMPORT_TYPES.find((t) => t.value === guessed)?.label ?? guessed })
        }
      } catch { /* non-blocking */ }
    }
    setAllSheetsResult(results)
    setLoading(false)
    const total = results.reduce((a, r) => a + r.count, 0)
    toast.success(`Importálás kész — ${total} rekord összesen`)
  }

  const runImport = async () => {
    if (!headers.length || !rows.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ headers, rows, userMapping: mapping, importType }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Import sikertelen')
      setResult(data)
      const typeLabel = IMPORT_TYPES.find((t) => t.value === importType)?.label ?? ''
      const counts = RESULT_LABELS[importType].map((r) => `${data.imported[r.key]} ${r.label}`).join(', ')
      toast.success(`${typeLabel} importálás kész — ${counts}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }

  const fieldOptions = FIELD_OPTIONS_BY_TYPE[importType]
  const currentTypeInfo = IMPORT_TYPES.find((t) => t.value === importType)!
  const PREVIEW_ROWS = 5

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Importálj adatokat más foglalórendszerből (Salonic, Fresha, SimplyBook, Vagaro stb.) vagy töltsd fel vállalkozásod
        összes alap-adatát — CSV vagy Excel formátumban. A rendszer automatikusan felismeri az oszlopokat és az adattípust.
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
            <p className="font-medium text-ink">CSV vagy Excel fájl feltöltése</p>
            <p className="text-sm text-ink-soft mt-0.5">Húzd ide vagy kattints — a rendszer automatikusan felismeri az adattípust</p>
            <p className="text-xs text-ink-soft2 mt-2">.csv · .xlsx · .xls — Salonic · Fresha · SimplyBook · saját export</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
        </button>
      )}

      {/* File loaded */}
      {fileName && (
        <div className="space-y-5">

          {/* File info + detected type + reset */}
          <div className="rounded-2xl dav-card-glass px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                <span className="text-sm font-medium text-ink truncate">{fileName}</span>
                {sheetNames.length <= 1 && <span className="text-xs text-ink-soft2 shrink-0">{rows.length} sor</span>}
              </div>
              <button type="button" onClick={reset} className="shrink-0 text-ink-soft hover:text-ink transition-colors" aria-label="Fájl eltávolítása">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Detected type badge + override */}
            {sheetNames.length <= 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-soft2">Felismert típus:</span>
                <span className="text-xs font-semibold text-gold">{currentTypeInfo.label}</span>
                <button
                  type="button"
                  onClick={() => setShowTypeOverride((v) => !v)}
                  className="text-xs text-ink-soft2 underline underline-offset-2 hover:text-ink transition-colors"
                >
                  {showTypeOverride ? 'Bezárás' : 'Módosítás'}
                </button>
              </div>
            )}

            {/* Type override (inline, compact) */}
            {showTypeOverride && sheetNames.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {IMPORT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { handleTypeChange(t.value); setShowTypeOverride(false) }}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition-all border',
                      importType === t.value
                        ? 'bg-ink-dark text-white border-ink-dark'
                        : 'bg-white text-ink border-line-strong hover:bg-paper',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Multi-sheet XLSX: import all + sheet tabs */}
          {sheetNames.length > 1 && (
            <div className="space-y-3">
              {/* "Import all sheets" — primary action */}
              {!allSheetsResult && (
                <button
                  type="button"
                  onClick={importAllSheets}
                  disabled={loading}
                  className={cn(
                    'w-full rounded-2xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    'bg-ink-dark text-white hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Importálás folyamatban…</>
                    : <><Upload className="h-4 w-4" /> Összes munkalap importálása ({sheetNames.length} lap)</>
                  }
                </button>
              )}

              {/* All-sheets result */}
              {allSheetsResult && (
                <div className="rounded-[22px] dav-card-glass p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-ink">Összes munkalap importálva</p>
                  </div>
                  <div className="space-y-2">
                    {allSheetsResult.map((r) => (
                      <div key={r.sheet} className="flex items-center justify-between rounded-xl bg-paper px-4 py-2.5">
                        <div>
                          <span className="text-sm font-medium text-ink">{r.sheet}</span>
                          <span className="ml-2 text-xs text-ink-soft2">{r.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-ink">{r.count} db</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={reset} className="w-full rounded-2xl border border-line-strong bg-white py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors">
                    Új importálás
                  </button>
                </div>
              )}

              {/* Divider + sheet tabs (for importing one at a time if needed) */}
              {!allSheetsResult && (
                <div>
                  <div className="flex items-center gap-3 my-1">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[11px] text-ink-soft2">vagy munkalaponként</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sheetNames.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => switchSheet(s)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-medium transition-all border',
                          activeSheet === s
                            ? 'bg-ink-dark text-white border-ink-dark'
                            : 'bg-white text-ink border-line-strong hover:bg-paper',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column mapping + preview + import (single sheet or active sheet) */}
          {!allSheetsResult && headers.length > 0 && (
            <>
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
                          {fieldOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-soft2 pointer-events-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                                <span className="ml-1 text-gold font-normal">→ {fieldOptions.find(o => o.value === mapping[h])?.label.split(' ')[0]}</span>
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
                    : <><Upload className="h-4 w-4" /> {rows.length} sor importálása ({currentTypeInfo.label})</>
                  }
                </button>
              )}

              {result && (
                <div className="rounded-[22px] dav-card-glass p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-ink">Importálás kész</p>
                  </div>
                  <div className={cn('grid gap-3', RESULT_LABELS[importType].length === 1 ? 'grid-cols-2' : 'grid-cols-3')}>
                    {RESULT_LABELS[importType].map((r) => (
                      <div key={r.key} className="rounded-2xl bg-paper px-4 py-3 text-center">
                        <p className="text-2xl font-light text-ink">{result.imported[r.key]}</p>
                        <p className="text-xs text-ink-soft mt-0.5">{r.label}</p>
                      </div>
                    ))}
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
                  <button type="button" onClick={reset} className="w-full rounded-2xl border border-line-strong bg-white py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors">
                    Új importálás
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
