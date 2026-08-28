import { COLORS, escapeHtml, renderTemplateHtml } from '@/lib/emailLayout'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'

/**
 * Blokk-alapú email-tartalom → HTML renderelő — a hírlevél-szerkesztőből (NewsletterBlockEditor)
 * kiemelve ide, hogy a TRANZAKCIÓS emailek (visszaigazoló, lemondó, emlékeztető, stb.) is
 * ugyanezt a motort használhassák szerver-oldali küldéskor (Payload hookból/cronból, kliens
 * nélkül) — a hírlevélnél ez eddig csak a böngészőben futott (a kliens rendereli, és a KÉSZ
 * HTML-t küldi a szervernek), a tranzakciós emaileknél viszont a szervernek magának kell
 * blokkból HTML-t építenie, DOM/böngésző nélkül. Ez a fájl tisztán string-alapú, nincs benne
 * semmilyen böngésző-API, ezért mindkét oldalon (kliens-szerkesztő ÉS szerver-küldés) biztonságos.
 */

let idCounter = 0
export function nextId(): string {
  idCounter += 1
  return `blk-${Date.now()}-${idCounter}`
}

export type TextAlign = 'left' | 'center' | 'right'

/** Egy oszlop-cella tartalma — NEM csak szöveg, hanem kép/gomb is lehet. */
export type ColumnCell =
  | { type: 'empty' }
  | { type: 'text'; html: string; align?: TextAlign; color?: string | null; bg?: string | null }
  | { type: 'image'; url: string; alt: string; link?: string }
  | { type: 'button'; label: string; url: string }

export type ComposerBlock =
  | { id: string; type: 'text' | 'title' | 'subtitle' | 'heading' | 'bullet_list' | 'numbered_list'; html: string; align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number }
  | { id: string; type: 'button'; label: string; url: string; align?: TextAlign }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; url: string; alt: string; link?: string; align?: TextAlign; kind?: 'image' | 'youtube' }
  | { id: string; type: 'section'; html: string; bg?: string | null }
  | { id: string; type: 'columns'; cols: ColumnCell[] }
  | { id: string; type: 'social_links'; links: { url: string }[]; align?: TextAlign }
  | { id: string; type: 'html'; code: string }
  | { id: string; type: 'code'; code: string }

function textBlockStyle(b: { align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number }, extra: string): string {
  const align = b.align && b.align !== 'left' ? `text-align:${b.align};` : ''
  const bg = b.bg ? `background:${b.bg};padding:10px 14px;border-radius:8px;` : ''
  const color = b.color ? `color:${b.color};` : ''
  const fontSize = b.fontSize ? `font-size:${b.fontSize}px;` : ''
  const lineHeight = b.lineHeight ? `line-height:${b.lineHeight};` : ''
  return `${extra}${align}${bg}${color}${fontSize}${lineHeight}`
}

/** A szerkesztő `contentEditable` mezője Enterre `<div>`-et szúr be, ami `<p>`/`<h1>`-en belül
 *  érvénytelen — `<br>`-re cseréljük, mielőtt bármilyen blokk-elembe kerülne. */
function sanitizeInlineHtml(html: string): string {
  return html.replace(/<\/div>\s*<div>/gi, '<br>').replace(/<\/?div>/gi, '')
}

const PLAY_ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)"/><path d="M26 20l20 12-20 12z" fill="#fff"/></svg>',
)}`

export function blocksToHtml(blocks: ComposerBlock[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case 'title':
        return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${COLORS.text};line-height:1.25;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h1>`
      case 'subtitle':
        return `<h2 style="margin:0 0 10px;font-size:18px;font-weight:600;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h2>`
      case 'heading':
        return `<h3 style="margin:0 0 8px;font-size:16px;font-weight:600;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h3>`
      case 'bullet_list':
        return `<ul style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ul>`
      case 'numbered_list':
        return `<ol style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ol>`
      case 'button': {
        const align = b.align ?? 'left'
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : ''}"><tr><td style="background:${COLORS.ink};border-radius:999px"><a href="${b.url || '#'}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:999px">${escapeHtml(b.label || 'Gomb')}</a></td></tr></table>`
      }
      case 'divider':
        return `<hr style="margin:18px 0;border:none;border-top:1px solid ${COLORS.border}" />`
      case 'image': {
        if (!b.url) return ''
        const align = b.align ?? 'left'
        const img = b.kind === 'youtube'
          ? `<span style="position:relative;display:inline-block;max-width:100%"><img src="${b.url}" alt="${escapeHtml(b.alt)}" style="max-width:100%;border-radius:10px;display:block;border:0" /><img src="${PLAY_ICON_DATA_URI}" alt="" width="60" height="60" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:0" /></span>`
          : `<img src="${b.url}" alt="${escapeHtml(b.alt)}" style="max-width:100%;border-radius:10px;display:inline-block;border:0" />`
        const inner = b.link?.trim() ? `<a href="${b.link.trim()}" target="_blank" style="text-decoration:none">${img}</a>` : img
        return `<p style="margin:0 0 14px;text-align:${align}">${inner}</p>`
      }
      case 'section':
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr><td style="padding:20px;border-radius:14px;background:${b.bg || '#F7F5F0'};color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere">${sanitizeInlineHtml(b.html)}</td></tr></table>`
      case 'columns': {
        const n = b.cols.length || 1
        const width = Math.floor(100 / n)
        const cells = b.cols.map((c) => {
          let inner = ''
          if (c.type === 'text') {
            const style = `${c.align && c.align !== 'left' ? `text-align:${c.align};` : ''}${c.bg ? `background:${c.bg};padding:10px 14px;border-radius:8px;` : ''}${c.color ? `color:${c.color};` : ''}`
            const cellHtml = sanitizeInlineHtml(c.html)
            inner = style ? `<div style="${style}">${cellHtml}</div>` : cellHtml
          }
          else if (c.type === 'image' && c.url) {
            const img = `<img src="${c.url}" alt="${escapeHtml(c.alt)}" style="max-width:100%;border-radius:8px;display:block;border:0" />`
            inner = c.link?.trim() ? `<a href="${c.link.trim()}" style="text-decoration:none">${img}</a>` : img
          } else if (c.type === 'button') {
            inner = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${COLORS.ink};border-radius:999px"><a href="${c.url || '#'}" style="display:inline-block;padding:10px 18px;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:999px">${escapeHtml(c.label || 'Gomb')}</a></td></tr></table>`
          }
          return `<td style="width:${width}%;vertical-align:top;padding:0 10px;color:${COLORS.text};font-size:14px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere">${inner}</td>`
        }).join('')
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr>${cells}</tr></table>`
      }
      case 'social_links': {
        const items = b.links.filter((l) => l.url.trim()).map((l) => {
          const platform = detectPlatform(l.url)
          return `<td style="padding:0 6px"><a href="${l.url.trim()}" style="display:inline-block;text-decoration:none"><img src="${socialIconDataUri(platform)}" width="36" height="36" alt="${escapeHtml(SOCIAL_LABELS[platform])}" style="display:block;border:0;border-radius:999px" /></a></td>`
        }).join('')
        if (!items) return ''
        const align = b.align ?? 'center'
        const marginStyle = align === 'center' ? 'margin:0 auto 14px' : align === 'right' ? 'margin:0 0 14px 0;margin-left:auto' : 'margin:0 0 14px'
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="${marginStyle}"><tr>${items}</tr></table>`
      }
      case 'html':
        return b.code || ''
      case 'code':
        return b.code ? `<p style="margin:0 0 14px;text-align:center"><code style="display:inline-block;padding:10px 18px;border-radius:8px;background:${COLORS.muted};border:1px dashed ${COLORS.border};font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;color:${COLORS.text};letter-spacing:.04em">${escapeHtml(b.code)}</code></p>` : ''
      case 'text':
      default:
        return `<p style="margin:0 0 14px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</p>`
    }
  }).join('')
}

export function emptyTextBlock(): ComposerBlock {
  return { id: nextId(), type: 'text', html: '' }
}

/** Sima, `\n\n`-nel tagolt szöveget alakít blokk-tömbbé (egy bekezdés = egy 'text' blokk, az
 *  egyszeres sortörés `<br>`-ra vált) — a sablon-betöltő "gyári" szövegei (amik olvashatóság
 *  kedvéért sima stringként vannak megírva) ebből lesznek valódi, szerkeszthető blokkok. */
export function plainTextToBlocks(text: string): ComposerBlock[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length === 0) return []
  return paragraphs.map((p) => ({ id: nextId(), type: 'text', html: p.replace(/\n/g, '<br>') }))
}

/** A `*_email_intro` JSON-mező (Payload `json`-mező → nyers `unknown`) blokk-tömbként való
 *  biztonságos kiolvasása. Bármi mást ad vissza (null, régi string a migráció előttről, stb.)
 *  → üres tömb, a hívó nem küld intro-blokkot. */
export function parseEmailBlocks(json: unknown): ComposerBlock[] {
  return Array.isArray(json) ? (json as ComposerBlock[]) : []
}

/**
 * A tranzakciós emailek (visszaigazoló/lemondó/emlékeztető/stb.) blokk-alapú bevezető
 * szakasza — a `lib/emailLayout.ts` `introBlock()`-jának blokk-alapú megfelelője: ugyanabba a
 * `<tr><td>` üveg-kártyába kerül, DE a szöveg helyett a teljes hírlevél-szerkesztő blokk-
 * palettáját (kép, gomb, formázás, social linkek…) engedi. A `{{name}}`/`{{date}}`/stb.
 * változók a blokkok RENDERELT HTML-jében is működnek (escape nélküli csere, a tulaj saját
 * tartalma, csak a behelyettesített érték escape-elt).
 */
export function introBlockFromHtml(html: string, vars: Record<string, string>): string {
  if (!html.trim()) return ''
  return `<tr>
    <td style="background:${COLORS.surface};padding:22px 28px 0">
      ${renderTemplateHtml(html, vars)}
    </td>
  </tr>`
}

export function introBlockFromJson(json: unknown, vars: Record<string, string>): string {
  return introBlockFromHtml(blocksToHtml(parseEmailBlocks(json)), vars)
}
