import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { t, type Locale } from '@/lib/i18n'

/**
 * A beleegyező nyilatkozat PDF-példánya (2026-11) — az e-mail melléklete (sendConsentCopy / sendReservationConsentCopy).
 * A4, az app Onest betűjével (src/lib/pdf/fonts, OFL), mert a PDF beépített betűi nem ismerik az ő/ű-t. Tartalom: az üzlet
 * neve, a nyilatkozat címe, a vendég és a foglalás adatai, az elfogadás ideje / módja / IP-címe (bizonyíték), majd a
 * nyilatkozat teljes szövege (a foglaláson tárolt pillanatfelvétel), szükség esetén több oldalon.
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
const INK = rgb(0.13, 0.12, 0.1)
const SOFT = rgb(0.45, 0.44, 0.4)
const LINE = rgb(0.86, 0.85, 0.82)

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

export async function buildConsentPdf(o: {
  locale: Locale
  placeName: string
  title: string | null | undefined
  name: string
  email?: string | null
  phone?: string | null
  date: string
  time: string
  acceptedAt: string | null | undefined
  via: 'online' | 'onsite' | null | undefined
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
  doc.setTitle(`${title} — ${o.placeName}`)
  doc.setAuthor(o.placeName)
  doc.setCreator('davelopment booking')

  const tag = locale === 'hu' ? 'hu-HU' : locale
  const fmt = (iso: string) => new Date(iso).toLocaleString(tag, { timeZone: 'Europe/Budapest', dateStyle: 'long', timeStyle: 'short' })
  const dateLabel = (() => {
    const [y, m, d] = o.date.split('-').map(Number)
    return y ? new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(tag, { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric' }) : o.date
  })()

  const contentW = PAGE.w - PAGE.margin * 2
  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h])
  let y = PAGE.h - PAGE.margin
  const newPage = () => { page = doc.addPage([PAGE.w, PAGE.h]); y = PAGE.h - PAGE.margin }
  const ensure = (h: number) => { if (y - h < PAGE.margin + 24) newPage() }
  const draw = (s: string, x: number, size: number, font: PDFFont, color = INK) => page.drawText(clean(font, s), { x, y, size, font, color })

  // fejléc: üzlet neve, cím
  draw(o.placeName, PAGE.margin, 10, semibold, SOFT)
  y -= 30
  for (const l of wrap(semibold, 20, clean(semibold, title), contentW)) { ensure(26); draw(l, PAGE.margin, 20, semibold); y -= 26 }
  y -= 8

  // adatok — címke balra, érték jobbra igazítva tördelve
  const rows: [string, string][] = [
    [t(locale, 'email.consent.business'), o.placeName],
    [t(locale, 'email.label.name'), o.name],
    ...(o.email ? [[t(locale, 'email.label.email'), o.email] as [string, string]] : []),
    ...(o.phone ? [[t(locale, 'email.label.phone'), o.phone] as [string, string]] : []),
    [t(locale, 'email.label.date'), dateLabel],
    [t(locale, 'email.label.time'), o.time],
    ...(o.acceptedAt ? [[t(locale, 'email.consent.acceptedAt'), fmt(o.acceptedAt)] as [string, string]] : []),
    ...(o.via ? [[t(locale, 'email.consent.via'), t(locale, o.via === 'onsite' ? 'email.consent.viaOnsite' : 'email.consent.viaOnline')] as [string, string]] : []),
    ...(o.ip && o.ip !== 'unknown' ? [[t(locale, 'email.consent.ip'), o.ip] as [string, string]] : []),
  ]
  const labelW = 150
  for (const [label, value] of rows) {
    const lines = wrap(regular, 10.5, clean(regular, value), contentW - labelW)
    ensure(lines.length * 15 + 10)
    page.drawLine({ start: { x: PAGE.margin, y: y + 12 }, end: { x: PAGE.w - PAGE.margin, y: y + 12 }, thickness: 0.6, color: LINE })
    draw(label, PAGE.margin, 10, regular, SOFT)
    for (const l of lines) { draw(l, PAGE.margin + labelW, 10.5, regular); y -= 15 }
    y -= 8
  }
  page.drawLine({ start: { x: PAGE.margin, y: y + 12 }, end: { x: PAGE.w - PAGE.margin, y: y + 12 }, thickness: 0.6, color: LINE })
  y -= 22

  // a nyilatkozat teljes szövege
  ensure(40)
  draw(t(locale, 'email.consent.text').toUpperCase(), PAGE.margin, 9, semibold, SOFT)
  y -= 20
  for (const l of wrap(regular, 10.5, clean(regular, o.text), contentW)) {
    ensure(16)
    if (l) draw(l, PAGE.margin, 10.5, regular)
    y -= l ? 15.5 : 9
  }

  // lábléc minden oldalon: készült + oldalszám
  const pages = doc.getPages()
  const stamp = `${t(locale, 'email.consent.generated')}: ${fmt(new Date().toISOString())} · davelopment booking`
  pages.forEach((p, i) => {
    p.drawText(clean(regular, stamp), { x: PAGE.margin, y: PAGE.margin - 22, size: 8, font: regular, color: SOFT })
    const num = `${i + 1} / ${pages.length} ${t(locale, 'email.consent.page')}`
    p.drawText(num, { x: PAGE.w - PAGE.margin - regular.widthOfTextAtSize(num, 8), y: PAGE.margin - 22, size: 8, font: regular, color: SOFT })
  })

  return doc.save()
}

/** A melléklet fájlneve: pl. beleegyezo-nyilatkozat-2026-11-12.pdf */
export function consentPdfFilename(locale: Locale, date: string): string {
  return `${t(locale, 'email.consent.file')}-${date}.pdf`
}
