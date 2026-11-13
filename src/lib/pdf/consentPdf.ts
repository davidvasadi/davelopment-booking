import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { t, type Locale } from '@/lib/i18n'

/**
 * A beleegyező nyilatkozat PDF-példánya (2026-11) — a vendégnek küldött levél melléklete (visszaigazoló, vagy külön
 * levél: sendConsentCopy / sendReservationConsentCopy). A4, az app Onest betűjével (src/lib/pdf/fonts, OFL), mert a PDF
 * beépített betűi nem ismerik az ő/ű-t.
 *
 * Felépítés: fejléc (az üzlet neve + elérhetősége, jobbra a dokumentum típusa) · cím + „másolat a vendég részére” +
 * dokumentum-azonosító · adat-kártya (vendég, időpont) · a nyilatkozat teljes szövege (a foglaláson tárolt
 * pillanatfelvétel) · elfogadás-blokk (mikor, hogyan) · lábléc minden oldalon (üzlet, készült, oldalszám).
 * Az IP-cím szándékosan NINCS benne (személyes adat, a vendégnek nem mond semmit) — bizonyítékként a foglaláson marad.
 * Az azonosító a foglalás + az elfogadás ideje + a szöveg lenyomatából képzett rövid kód: ha a szöveget utólag
 * módosítanák, nem egyezne.
 */

const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts')
let fontCache: { regular: Uint8Array; semibold: Uint8Array } | null = null
async function loadFonts() {
  if (!fontCache) {
    const [regular, semibold] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, 'Onest-Regular.ttf')),
      fs.readFile(path.join(FONT_DIR, 'Onest-SemiBold.ttf')),
    ])
    fontCache = { regular, semibold }
  }
  return fontCache
}

const PAGE = { w: 595.28, h: 841.89, margin: 56 }
const FOOTER_H = 44
const INK = rgb(0.13, 0.12, 0.1)
const SOFT = rgb(0.45, 0.44, 0.4)
const FAINT = rgb(0.62, 0.61, 0.58)
const LINE = rgb(0.88, 0.87, 0.84)
const CARD = rgb(0.955, 0.952, 0.94)
const OK = rgb(0.3, 0.48, 0.18)
const OK_BG = rgb(0.9, 0.95, 0.87)

/** Csak a betűben meglévő karakterek maradnak (pl. emoji nélkül), különben a pdf-lib kódolási hibát dob. */
function clean(font: PDFFont, s: string): string {
  const set = new Set(font.getCharacterSet())
  return Array.from(s.replace(/\t/g, '    ')).filter((ch) => ch === '\n' || set.has(ch.codePointAt(0)!)).join('')
}

/** Szóhatáron tördel a megadott szélességre; a túl hosszú szót karakterenként vágja. */
function wrap(font: PDFFont, size: number, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue }
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxW) { line = next; continue }
      if (line) out.push(line)
      if (font.widthOfTextAtSize(word, size) <= maxW) { line = word; continue }
      let chunk = ''
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxW) { out.push(chunk); chunk = ch } else chunk += ch
      }
      line = chunk
    }
    out.push(line)
  }
  return out
}

/** Lekerekített téglalap (a pdf-lib-ben nincs sarok-sugár) — SVG-útvonalként. A `y` az alsó él. */
function roundedRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number, o: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb> }) {
  const p = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  // az SVG-útvonal y-tengelye lefelé nő: a bal FELSŐ sarokhoz igazítunk
  page.drawSvgPath(p, { x, y: y + h, color: o.fill, borderColor: o.border, borderWidth: o.border ? 0.8 : 0 })
}

/** Rövid, ellenőrizhető dokumentum-azonosító: pl. „F1150-7K3Q-92ME”. */
function documentId(ref: string | number | null | undefined, acceptedAt: string | null | undefined, text: string): string {
  const h = crypto.createHash('sha256').update(`${ref ?? ''}|${acceptedAt ?? ''}|${text}`).digest('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  return `${ref ?? 'D'}-${h.slice(0, 4)}-${h.slice(4, 8)}`
}

export async function buildConsentPdf(o: {
  locale: Locale
  placeName: string
  /** az üzlet elérhetősége a fejlécben (ami meg van adva) */
  place?: { address?: string | null; phone?: string | null; email?: string | null }
  /** a foglalás azonosítója (a dokumentum-azonosítóhoz), pl. „F1150” (szalon) / „A812” (étterem) */
  reference?: string | number | null
  title: string | null | undefined
  name: string
  email?: string | null
  phone?: string | null
  date: string
  time: string
  acceptedAt: string | null | undefined
  via: 'online' | 'onsite' | null | undefined
  /** nem kerül a PDF-be (ld. fent) — a régi hívók miatt marad a típusban */
  ip?: string | null
  text: string
}): Promise<Uint8Array> {
  const { locale } = o
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadFonts()
  const regular = await doc.embedFont(fonts.regular, { subset: true })
  const semibold = await doc.embedFont(fonts.semibold, { subset: true })
  const title = o.title?.trim() || t(locale, 'email.consent.title')
  const docId = documentId(o.reference, o.acceptedAt, o.text)
  doc.setTitle(`${title} — ${o.placeName}`)
  doc.setAuthor(o.placeName)
  doc.setSubject(`${t(locale, 'email.consent.reference')}: ${docId}`)
  doc.setCreator('davelopment booking')
  doc.setProducer('davelopment booking')

  const tag = locale === 'hu' ? 'hu-HU' : locale
  const fmt = (iso: string) => new Date(iso).toLocaleString(tag, { timeZone: 'Europe/Budapest', dateStyle: 'long', timeStyle: 'short' })
  const dateLabel = (() => {
    const [y, m, d] = o.date.split('-').map(Number)
    return y ? new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(tag, { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : o.date
  })()

  const L = PAGE.margin
  const contentW = PAGE.w - PAGE.margin * 2
  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h])
  let y = PAGE.h - PAGE.margin
  const bottom = PAGE.margin + FOOTER_H
  const newPage = () => { page = doc.addPage([PAGE.w, PAGE.h]); y = PAGE.h - PAGE.margin }
  const ensure = (h: number) => { if (y - h < bottom) newPage() }
  const text = (s: string, x: number, size: number, font: PDFFont, color = INK, at = y) => page.drawText(clean(font, s), { x, y: at, size, font, color })
  const right = (s: string, size: number, font: PDFFont, color = SOFT, at = y) => { const c = clean(font, s); page.drawText(c, { x: PAGE.w - PAGE.margin - font.widthOfTextAtSize(c, size), y: at, size, font, color }) }
  const rule = (at: number, color = LINE) => page.drawLine({ start: { x: L, y: at }, end: { x: PAGE.w - PAGE.margin, y: at }, thickness: 0.7, color })

  // ── fejléc: az üzlet + elérhetősége, jobbra a dokumentum típusa ──
  text(o.placeName, L, 13, semibold)
  right(t(locale, 'email.consent.title').toUpperCase(), 7.5, semibold, FAINT, y + 3)
  const contact = [o.place?.address, o.place?.phone, o.place?.email].map((v) => v?.trim()).filter(Boolean).join('  ·  ')
  y -= 15
  if (contact) { for (const l of wrap(regular, 8.5, clean(regular, contact), contentW)) { text(l, L, 8.5, regular, SOFT); y -= 11.5 } }
  y -= 8
  rule(y)
  y -= 34

  // ── cím, alatta: másolat a vendég részére · azonosító ──
  for (const l of wrap(semibold, 21, clean(semibold, title), contentW)) { ensure(28); text(l, L, 21, semibold); y -= 27 }
  text(`${t(locale, 'email.consent.copyFor')}  ·  ${t(locale, 'email.consent.reference')}: ${docId}`, L, 9, regular, SOFT, y + 6)
  y -= 22

  // ── adat-kártya: két oszlopban címke + érték ──
  const cells: [string, string][] = [
    [t(locale, 'email.label.name'), o.name],
    [t(locale, 'email.consent.business'), o.placeName],
    ...(o.email ? [[t(locale, 'email.label.email'), o.email] as [string, string]] : []),
    ...(o.phone ? [[t(locale, 'email.label.phone'), o.phone] as [string, string]] : []),
    [t(locale, 'email.label.date'), dateLabel],
    [t(locale, 'email.label.time'), o.time],
  ]
  const pad = 16, gap = 18
  const colW = (contentW - pad * 2 - gap) / 2
  const rows: { cells: { label: string; lines: string[] }[]; h: number }[] = []
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2).map(([label, value]) => ({ label, lines: wrap(regular, 10.5, clean(regular, value), colW) }))
    rows.push({ cells: pair, h: 13 + Math.max(...pair.map((c) => c.lines.length)) * 14 })
  }
  const cardH = pad * 2 + rows.reduce((s, r) => s + r.h, 0) + (rows.length - 1) * 10
  ensure(cardH + 10)
  roundedRect(page, L, y - cardH, contentW, cardH, 12, { fill: CARD })
  let cy = y - pad - 9
  for (const r of rows) {
    r.cells.forEach((c, ci) => {
      const x = L + pad + ci * (colW + gap)
      text(c.label, x, 8, regular, SOFT, cy)
      c.lines.forEach((l, li) => text(l, x, 10.5, regular, INK, cy - 14 - li * 14))
    })
    cy -= r.h + 10
  }
  y -= cardH + 30

  // ── a nyilatkozat szövege ──
  ensure(40)
  text(t(locale, 'email.consent.text').toUpperCase(), L, 7.5, semibold, FAINT)
  y -= 18
  for (const l of wrap(regular, 10.5, clean(regular, o.text), contentW)) {
    ensure(16)
    if (l) text(l, L, 10.5, regular)
    y -= l ? 15.5 : 8
  }
  y -= 18

  // ── elfogadás: pipa + mikor / hogyan ──
  if (o.acceptedAt || o.via) {
    const boxH = 58
    ensure(boxH + 6)
    roundedRect(page, L, y - boxH, contentW, boxH, 12, { border: LINE })
    const cx = L + 30, cyc = y - boxH / 2
    page.drawCircle({ x: cx, y: cyc, size: 12, color: OK_BG })
    page.drawSvgPath('M 0 4.2 L 3.6 7.6 L 10 0.8', { x: cx - 5, y: cyc + 4, borderColor: OK, borderWidth: 1.8 })
    const when = [o.acceptedAt ? fmt(o.acceptedAt) : null, o.via ? t(locale, o.via === 'onsite' ? 'email.consent.viaOnsite' : 'email.consent.viaOnline') : null].filter(Boolean).join('  ·  ')
    text(t(locale, 'email.consent.electronic'), L + 54, 10.5, semibold, INK, cyc + 3)
    text(when, L + 54, 9, regular, SOFT, cyc - 11)
    y -= boxH + 10
  }

  // ── lábléc minden oldalon ──
  const pages = doc.getPages()
  const stamp = `${o.placeName}  ·  ${t(locale, 'email.consent.generated')}: ${fmt(new Date().toISOString())}  ·  davelopment booking`
  pages.forEach((p, i) => {
    const fy = PAGE.margin - 18
    p.drawLine({ start: { x: L, y: fy + 14 }, end: { x: PAGE.w - PAGE.margin, y: fy + 14 }, thickness: 0.6, color: LINE })
    p.drawText(clean(regular, stamp), { x: L, y: fy, size: 7.5, font: regular, color: FAINT })
    const num = `${i + 1} / ${pages.length}`
    p.drawText(num, { x: PAGE.w - PAGE.margin - regular.widthOfTextAtSize(num, 7.5), y: fy, size: 7.5, font: regular, color: FAINT })
  })

  return doc.save()
}

/** A melléklet fájlneve: pl. beleegyezo-nyilatkozat-2026-11-12.pdf */
export function consentPdfFilename(locale: Locale, date: string): string {
  return `${t(locale, 'email.consent.file')}-${date}.pdf`
}
