import { Fragment, type ReactNode } from 'react'

/**
 * Egyszerű formázott szöveg a foglalóoldalon (a szerkesztő gyors-sávja, design 21.6.3): **félkövér**, *dőlt* és
 * [link](https://…) — a meglévő szöveg-mezőkben tárolva (leírás, munkatárs bemutatkozása, köszönő cím). Ahol a szöveg
 * nem HTML-ként jelenik meg (Google-leírás, strukturált adat, llms.txt, e-mail tárgy), ott a `stripRich` tisztítja.
 * Csak ez a három jelölés él; minden más sima szöveg marad (nincs HTML, nincs script).
 */

const TOKEN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
/** Csak biztonságos linkek: http(s), mailto, tel. */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i

/** A jelöléses szöveg React-elemekként (a sortörések megmaradnak). */
export function RichText({ text, linkClassName = 'underline underline-offset-4' }: { text: string | null | undefined; linkClassName?: string }) {
  if (!text) return null
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-medium">{m[1]}</strong>)
    else if (m[2] !== undefined) out.push(<em key={k++}>{m[2]}</em>)
    else if (SAFE_URL.test(m[4])) out.push(<a key={k++} href={m[4]} target="_blank" rel="noopener noreferrer" className={linkClassName}>{m[3]}</a>)
    else out.push(m[3])
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</>
}

/** A jelölések nélküli, sima szöveg (meta-leírás, strukturált adat, előnézetek). */
export function stripRich(text: string | null | undefined): string {
  return (text ?? '').replace(TOKEN, (_m, b, i, label) => b ?? i ?? label ?? '')
}

/** Jelöléses szövegből a szerkeszthető elem HTML-je (a helyben szerkesztéshez) — a szöveg escape-elve. */
export function richToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  let html = ''
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    html += esc(text.slice(last, m.index))
    if (m[1] !== undefined) html += `<b>${esc(m[1])}</b>`
    else if (m[2] !== undefined) html += `<i>${esc(m[2])}</i>`
    else html += SAFE_URL.test(m[4]) ? `<a href="${esc(m[4])}">${esc(m[3])}</a>` : esc(m[3])
    last = m.index! + m[0].length
  }
  return (html + esc(text.slice(last))).replace(/\n/g, '<br>')
}

/** A szerkeszthető elem tartalmából (DOM) jelöléses szöveg: b/strong → **…**, i/em → *…*, a → [..](..), br/div → sortörés. */
export function domToRich(root: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return (n.textContent ?? '').replace(/\*/g, '')
    if (n.nodeType !== 1) return ''
    const el = n as HTMLElement
    const inner = Array.from(el.childNodes).map(walk).join('')
    const tag = el.tagName
    if (tag === 'BR') return '\n'
    if (tag === 'DIV' || tag === 'P') return (el.previousSibling ? '\n' : '') + inner
    const weight = el.style?.fontWeight
    if (tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600) return inner.trim() ? `**${inner}**` : inner
    if (tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic') return inner.trim() ? `*${inner}*` : inner
    if (tag === 'A') { const href = el.getAttribute('href') ?? ''; return SAFE_URL.test(href) && inner.trim() ? `[${inner}](${href})` : inner }
    return inner
  }
  return Array.from(root.childNodes).map(walk).join('').replace(/ /g, ' ')
}
