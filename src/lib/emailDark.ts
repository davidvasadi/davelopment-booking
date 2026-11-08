/**
 * Sötét mód a levelekben (design: E-mailek › Sötét mód; telefonon, Gmail appban tesztelve 2026-11-08).
 *
 * A Gmail app (iPhone, Android) és az Outlook sötét módban MAGÁTÓL átszínezi a levelet — a „csak világos” jelzést
 * figyelmen kívül hagyják. A döntés (Dave): a sima fehér részt hagyjuk elsötétíteni (a szöveg olvasható marad), a
 * SZÍNES felületek (gomb, színes blokk, lábléc, utalvány-jegy) viszont megtartják a beállított színüket — akármit
 * választ a tulaj a szerkesztőben. A képekhez a Gmail nem nyúl.
 *
 * Hogyan:
 *  - háttér: `background-image: linear-gradient(c,c)` — a Gmail a háttérképet nem fordítja (a sima színt igen);
 *  - világos felület sötét szövege: „kioltó” réteg (multiply + difference) a TELJES felületen — a Gmail
 *    színfordítását visszafordítja; sötét módban a felület legfeljebb egy árnyalattal mélyebb;
 *  - sötét felület világos szövege: a screen + difference trükk (Rémi Parmentier) — a világos szöveg világos marad.
 * A trükk csak a Gmailben él (`u + .body` — a Gmail a doctype helyére <u>-t tesz); máshol a sima színek látszanak.
 */

/** a levél <head>-jébe (a body-n `class="body"` kell) */
export const DARK_CSS = `
u + .body .dk-o { background:#000000; mix-blend-mode:multiply; }
u + .body .dk-i { background:#FFFFFF; mix-blend-mode:difference; }
u + .body .dl-s { background:#000000; mix-blend-mode:screen; }
u + .body .dl-d { background:#000000; mix-blend-mode:difference; }`

/** #RGB / #RRGGBB / rgb(a) → [r,g,b,a] (0–255, a: 0–1); más (pl. 'transparent', név) → null */
function parse(c: string | null | undefined): [number, number, number, number] | null {
  const s = (c ?? '').trim()
  let m = s.match(/^#([0-9a-f]{3})$/i)
  if (m) { const [r, g, b] = m[1].split('').map((h) => parseInt(h + h, 16)); return [r, g, b, 1] }
  m = s.match(/^#([0-9a-f]{6})$/i)
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1]
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (m) return [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1]
  return null
}

/** világos-e a szín (a szöveg rajta sötét) — ismeretlen szín: világosnak vesszük (fehér levél) */
export function isLightColor(c: string | null | undefined): boolean {
  const p = parse(c)
  if (!p) return true
  const [r, g, b] = p
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

/** színes-e (nem fehér / átlátszó) — csak ezeket védjük; a fehér rész sötétedhet */
export function isSurface(c: string | null | undefined): boolean {
  const p = parse(c)
  if (!p) return false
  const [r, g, b, a] = p
  return a >= 0.99 && !(r > 245 && g > 245 && b > 245)
}

/** A háttér stílusa: színes felületnél úgy, hogy a Gmail ne fordítsa át (a sima szín az Outlooknak marad). */
export function keepBg(c: string): string {
  return isSurface(c) ? `background-color:${c};background-image:linear-gradient(${c},${c})` : `background:${c}`
}

/**
 * A színes felület TARTALMA (szöveg) úgy, hogy a Gmail sötét módja se színezze át. `pad`: a felület belső margója —
 * a rétegnek a teljes felületet le kell fednie (különben a szöveg mögött folt látszik), ezért a padding a rétegen van,
 * nem a felületen. `radius`: a felület lekerekítése (a réteg sarkai ne lógjanak ki). `block`: blokk-szintű tartalom.
 */
export function keepContent(bg: string, html: string, o: { pad?: string; radius?: string; block?: boolean } = {}): string {
  const pad = o.pad ? `padding:${o.pad};` : ''
  const rad = o.radius ? `border-radius:${o.radius};` : ''
  if (!isSurface(bg)) return o.block ? `<div style="${pad}">${html}</div>` : `<span style="display:inline-block;${pad}">${html}</span>`
  const d = o.block ? 'display:block;' : 'display:inline-block;'
  if (isLightColor(bg)) {
    const tag = o.block ? 'div' : 'span'
    return `<${tag} class="dk-o" style="${d}${rad}"><${tag} class="dk-i" style="${d}${rad}${pad}">${html}</${tag}></${tag}>`
  }
  const tag = o.block ? 'div' : 'span'
  return `<${tag} style="${d}${pad}"><${tag} class="dl-s" style="${d}"><${tag} class="dl-d" style="${d}">${html}</${tag}></${tag}></${tag}>`
}

/** Gomb (link) színes háttérrel — a szín és a felirat sötét módban is marad. `font`: a felirat stílusa (szín, méret). */
export function keepButton(o: { href: string; bg: string; label: string; font: string; pad: string; radius?: string; style?: string }): string {
  const radius = o.radius ?? '999px'
  return `<a href="${o.href}" style="display:inline-block;${keepBg(o.bg)};border-radius:${radius};text-decoration:none;${o.font};${o.style ?? ''}">${keepContent(o.bg, o.label, { pad: o.pad, radius })}</a>`
}

/**
 * A kész levélben minden színes hátterű gombot (link `background:` + `padding:` stílussal) átalakít a fenti védett
 * formára — így a levelekben kézzel írt gombok (és a később írtak) is megtartják a színüket sötét módban.
 * A `keepButton`-nal készültek már `background-color`-t használnak, azokat nem érinti.
 */
export function darkSafeButtons(html: string): string {
  return html.replace(/<a\b([^>]*?)\bstyle="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi, (whole, pre: string, style: string, post: string, label: string) => {
    const bg = style.match(/(?:^|;)\s*background:\s*([^;]+)/i)?.[1]?.trim()
    const pad = style.match(/(?:^|;)\s*padding:\s*([^;]+)/i)?.[1]?.trim()
    if (!bg || !pad || !isSurface(bg)) return whole
    const radius = style.match(/(?:^|;)\s*border-radius:\s*([^;]+)/i)?.[1]?.trim() ?? '0'
    const rest = style.replace(/(?:^|;)\s*(background|padding):[^;]*/gi, '').replace(/^;+/, '')
    return `<a${pre}style="${keepBg(bg)};${rest}"${post}>${keepContent(bg, label, { pad, radius })}</a>`
  })
}
