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
  | { id: string; type: 'text' | 'title' | 'subtitle' | 'heading' | 'bullet_list' | 'numbered_list'; html: string; align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number; font?: BlockFont }
  /** `width`: 'full' = a levél teljes szélességében (a marketing-levél alapja), különben a felirathoz igazodik */
  | { id: string; type: 'button'; label: string; url: string; align?: TextAlign; width?: 'auto' | 'full'; bg?: string | null; color?: string | null }
  /** vendég-levél (Beállítások › Vendég e-mailek): a foglalás adatai — a tartalmat a rendszer tölti (nap, idő, részletek:
   *  `{{date_label}}`, `{{time}}`, `{{details}}`), csak a stílusa szerkeszthető, mint egy gombé */
  | { id: string; type: 'booking_details'; align?: TextAlign; width?: 'auto' | 'full'; bg?: string | null; color?: string | null }
  /** gombsor: 2–3 gomb egymás mellett (pl. Naptárba + Útvonalterv) — gombonként felirat, link, szín */
  | { id: string; type: 'button_row'; items: RowButton[]; align?: TextAlign }
  | { id: string; type: 'divider' }
  /** `width`: kicsi (pl. logó) / közepes / teljes szélesség (alap) */
  | { id: string; type: 'image'; url: string; alt: string; link?: string; align?: TextAlign; kind?: 'image' | 'youtube' | 'logo'; width?: ImageWidth }
  | { id: string; type: 'section'; html: string; bg?: string | null }
  | { id: string; type: 'columns'; cols: ColumnCell[] }
  | { id: string; type: 'social_links'; links: { url: string }[]; align?: TextAlign }
  | { id: string; type: 'html'; code: string }
  | { id: string; type: 'code'; code: string }
  /** két ajánlat árral egymás mellett (design 13.1 levél) */
  | { id: string; type: 'offers'; items: { name: string; was: string; now: string }[] }
  /** utalvány-blokk: a kártya kicsiben + szöveg + gomb a foglalóoldalra (design 13.1 levél) */
  | { id: string; type: 'voucher'; amount: string; title: string; text: string; label: string; url: string }

export type RowButton = { label: string; url: string; bg?: string | null; color?: string | null }

export type ImageWidth = 'sm' | 'md' | 'full'
/** a kép szélessége a levél szélességéhez képest (%) */
export const IMAGE_WIDTH_PCT: Record<ImageWidth, number> = { sm: 18, md: 50, full: 100 }
/** a logó magassága (px) — széles és négyzetes logó is arányos marad; a `width` itt a méret: kicsi / közepes / nagy */
export const LOGO_HEIGHT: Record<ImageWidth, number> = { sm: 36, md: 52, full: 72 }

/** betűtípus (design 13.4 Blokk stílusa): Alap / Elegáns / Kerek */
export type BlockFont = 'base' | 'serif' | 'round'
export const FONT_STACK: Record<BlockFont, string | null> = {
  base: null,
  serif: "Georgia,'Times New Roman',serif",
  round: "'Trebuchet MS','Avenir Next',Arial,sans-serif",
}
/** A Blokk stílusa (design 13.4) választható színei — a levélbe kerülő értékek (`null` = a blokk alapja). */
export const EMAIL_BG: (string | null)[] = [null, '#F7F5F0', '#FFD85F', '#383838']
export const EMAIL_TEXT: (string | null)[] = [null, '#828282', '#FFFFFF', '#FFD85F']

/** a szöveg-blokkok alap betűmérete (px) — a szerkesztő előnézete és a kiküldött levél is ezt használja */
export const BASE_SIZE: Record<string, number> = { title: 24, subtitle: 18, heading: 16, text: 14, bullet_list: 14, numbered_list: 14 }
/** a méret S / M / L szorzója az alaphoz */
export const SIZE_FACTOR = [0.8, 1, 1.3] as const
/** sötét háttéren (saját betűszín nélkül) fehér a szöveg, különben olvashatatlan */
export function autoTextColor(bg?: string | null): string | null {
  const m = bg && /^#?([0-9a-f]{6})$/i.exec(bg.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum < 0.55 ? '#FFFFFF' : null
}

function textBlockStyle(b: { align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number; font?: BlockFont }, extra: string): string {
  const family = b.font ? FONT_STACK[b.font] : null
  const font = family ? `font-family:${family};` : ''
  const align = b.align && b.align !== 'left' ? `text-align:${b.align};` : ''
  const bg = b.bg ? `background:${b.bg};padding:10px 14px;border-radius:8px;` : ''
  const c = b.color ?? autoTextColor(b.bg)
  const color = c ? `color:${c};` : ''
  const fontSize = b.fontSize ? `font-size:${b.fontSize}px;` : ''
  const lineHeight = b.lineHeight ? `line-height:${b.lineHeight};` : ''
  return `${extra}${align}${bg}${color}${fontSize}${lineHeight}${font}`
}

/** A szerkesztő `contentEditable` mezője Enterre `<div>`-et szúr be, ami `<p>`/`<h1>`-en belül
 *  érvénytelen — `<br>`-re cseréljük, mielőtt bármilyen blokk-elembe kerülne. */
function sanitizeInlineHtml(html: string): string {
  return html.replace(/<\/div>\s*<div>/gi, '<br>').replace(/<\/?div>/gi, '')
}

const PLAY_ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)"/><path d="M26 20l20 12-20 12z" fill="#fff"/></svg>',
)}`

/** `voucherLabel`: az utalvány-kártya felirata a levél nyelvén (alap: magyar) */
export function blocksToHtml(blocks: ComposerBlock[], opts: { voucherLabel?: string } = {}): string {
  return blocks.map((b) => {
    switch (b.type) {
      case 'title':
        return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:300;color:${COLORS.text};line-height:1.25;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h1>`
      case 'subtitle':
        return `<h2 style="margin:0 0 10px;font-size:18px;font-weight:300;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h2>`
      case 'heading':
        return `<h3 style="margin:0 0 8px;font-size:16px;font-weight:500;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h3>`
      case 'bullet_list':
        return `<ul style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ul>`
      case 'numbered_list':
        return `<ol style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ol>`
      case 'button': {
        const align = b.align ?? 'left'
        const bg = b.bg ?? COLORS.ink
        const fg = b.color ?? (b.bg ? autoTextColor(b.bg) ?? COLORS.ink : '#ffffff')
        if (b.width === 'full') return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0"><tr><td align="center" style="background:${bg};border-radius:999px"><a href="${b.url || '#'}" style="display:block;padding:0 20px;line-height:44px;color:${fg};font-size:13px;font-weight:500;text-align:center;text-decoration:none;border-radius:999px">${escapeHtml(b.label || 'Gomb')}</a></td></tr></table>`
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : ''}"><tr><td style="background:${bg};border-radius:999px"><a href="${b.url || '#'}" style="display:inline-block;padding:0 20px;line-height:44px;color:${fg};font-size:13px;font-weight:500;text-decoration:none;border-radius:999px">${escapeHtml(b.label || 'Gomb')}</a></td></tr></table>`
      }
      case 'button_row': {
        const align = b.align ?? 'left'
        const cells = b.items.map((it, i) => {
          const bg = it.bg ?? COLORS.ink
          const fg = it.color ?? (it.bg ? autoTextColor(it.bg) ?? COLORS.ink : '#ffffff')
          return `<td style="padding:0 ${i < b.items.length - 1 ? 8 : 0}px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${bg};border-radius:999px"><a href="${it.url || '#'}" style="display:inline-block;padding:0 20px;line-height:44px;color:${fg};font-size:13px;font-weight:500;text-decoration:none;border-radius:999px;white-space:nowrap">${escapeHtml(it.label || 'Gomb')}</a></td></tr></table></td>`
        }).join('')
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : ''}"><tr>${cells}</tr></table>`
      }
      case 'booking_details': {
        const bg = b.bg ?? '#EEEEEE'
        const fg = b.color ?? autoTextColor(bg) ?? COLORS.text
        const align = b.align ?? 'left'
        const box = `<td style="background:${bg};border-radius:16px;padding:14px 18px;text-align:${align}"><div style="font-size:15px;color:${fg}">{{date_label}} · {{time}}</div><div style="margin-top:2px;font-size:13px;color:${fg};opacity:.7">{{details}}</div></td>`
        if (b.width === 'full') return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px"><tr>${box}</tr></table>`
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : ''}"><tr>${box}</tr></table>`
      }
      case 'divider':
        return `<hr style="margin:18px 0;border:none;border-top:1px solid ${COLORS.border}" />`
      case 'image': {
        if (!b.url) return ''
        const align = b.align ?? (b.kind === 'logo' ? 'center' : 'left')
        const img = b.kind === 'youtube'
          ? `<span style="position:relative;display:inline-block;max-width:100%"><img src="${b.url}" alt="${escapeHtml(b.alt)}" style="max-width:100%;border-radius:10px;display:block;border:0" /><img src="${PLAY_ICON_DATA_URI}" alt="" width="60" height="60" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:0" /></span>`
          : b.kind === 'logo'
          ? `<img src="${b.url}" alt="${escapeHtml(b.alt)}" height="${LOGO_HEIGHT[b.width ?? 'md']}" style="height:${LOGO_HEIGHT[b.width ?? 'md']}px;width:auto;max-width:60%;display:inline-block;border:0" />`
          : `<img src="${b.url}" alt="${escapeHtml(b.alt)}" style="${b.width && b.width !== 'full' ? `width:${IMAGE_WIDTH_PCT[b.width]}%;` : ''}max-width:100%;border-radius:10px;display:inline-block;border:0" />`
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
      case 'offers': {
        const cells = b.items.map((o) => `<td style="width:${Math.floor(100 / (b.items.length || 1))}%;vertical-align:top;padding:0 5px"><div style="background:#F7F5F0;border-radius:10px;padding:12px 14px"><div style="font-size:13px;color:${COLORS.text}">${escapeHtml(o.name)}</div><div style="margin-top:4px"><span style="font-size:20px;font-weight:300;color:${COLORS.text}">${escapeHtml(o.now)}</span>${o.was ? ` <span style="font-size:12px;color:#828282;text-decoration:line-through">${escapeHtml(o.was)}</span>` : ''}</div></div></td>`).join('')
        return cells ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr>${cells}</tr></table>` : ''
      }
      case 'voucher':
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="width:150px;vertical-align:middle;padding-right:12px"><div style="background:#FFD85F;border-radius:12px;padding:14px;color:#383838"><div style="font-size:11px">${escapeHtml(opts.voucherLabel ?? 'Ajándékutalvány')}</div><div style="margin-top:10px;font-size:20px;font-weight:300">${escapeHtml(b.amount)}</div></div></td><td style="vertical-align:middle;color:${COLORS.text}"><div style="font-size:14px">${escapeHtml(b.title)}</div>${b.text ? `<div style="margin-top:2px;font-size:12px;color:#828282">${escapeHtml(b.text)}</div>` : ''}<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr><td style="background:#EEEEEE;border-radius:999px"><a href="${b.url || '#'}" style="display:inline-block;padding:9px 18px;color:#383838;font-size:12px;font-weight:600;text-decoration:none;border-radius:999px">${escapeHtml(b.label || 'Utalványt veszek')}</a></td></tr></table></td></tr></table>`
      case 'text':
      default:
        return `<p style="margin:0 0 14px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</p>`
    }
  }).join('')
}

/** A levél fő képe: az első blokk, ha teljes szélességű (sima) kép — erre kerül az üzlet neve / logója (a szerkesztőben és
 *  a kiküldött levélben is), a többi blokk alatta. */
export function coverOf(blocks: ComposerBlock[]): { cover: Extract<ComposerBlock, { type: 'image' }> | null; rest: ComposerBlock[] } {
  const f = blocks[0]
  if (f && f.type === 'image' && (!f.kind || f.kind === 'image') && (!f.width || f.width === 'full')) return { cover: f, rest: blocks.slice(1) }
  return { cover: null, rest: blocks }
}

/** A vendég-levél saját blokkokból áll-e (van benne „foglalás adatai” blokk) — ilyenkor a kiküldött levél a régi, fix
 *  részeket (adat-kártya, naptár / útvonal gomb, kapcsolat, lemondás-sor) nem teszi hozzá, mert a levélben már ott vannak. */
export function hasBookingBlock(json: unknown): boolean {
  return parseEmailBlocks(json).some((b) => b.type === 'booking_details')
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
