'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button, Field, IconButton, Input, Meta, Modal, Pill, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { BlockStyle, type BlockStyleSupport, type BlockStyleValue, type TextFormat } from '@/components/blocks/marketing'
import { BASE_SIZE, SIZE_FACTOR, type ColumnCell, type ComposerBlock, type ImageWidth, type RowButton } from '@/lib/emailBlocks'

/**
 * A levél-szerkesztők „Kijelölt blokk” kártyája (design 13.4) — a Marketing kampány-szerkesztője és a Beállítások › Vendég
 * e-mailek közösen: a kijelölt blokk levélen kívüli mezői (gomb felirata / linkje, kép alt / link, közösségi linkek), a
 * stílusa (háttér, szín, méret, igazítás, szélesség, cím-szint) és a szöveg formázása (félkövér, dőlt, aláhúzott, link —
 * a link címét felugró ablak kéri: `linkModal`, ezt a hívó teszi a lapra). `inspector`: a kártya tartalma (kijelölés
 * nélkül null).
 */
const TEXT_TYPES = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list']
const TITLE_TYPES = ['title', 'subtitle', 'heading'] as const
const IMAGE_WIDTHS: ImageWidth[] = ['sm', 'md', 'full']
const BLOCK_NAME: Record<string, string> = { text: 'Szöveg', title: 'Cím', subtitle: 'Alcím', heading: 'Kiemelés', bullet_list: 'Felsorolás', numbered_list: 'Számozott lista', button: 'Gomb', image: 'Kép', divider: 'Elválasztó', section: 'Szakasz', columns: 'Oszlopok', social_links: 'Közösségi', html: 'HTML', code: 'Kód', offers: 'Két ajánlat', voucher: 'Utalvány', booking_details: 'Foglalás adatai', button_row: 'Gombsor' }
/** a gombsor gombjainak színe: [háttér, betű, felirat] — a sötét az alap (null) */
const ROW_TONES: [string | null, string | null, string][] = [[null, null, 'Sötét'], ['#EEEEEE', '#383838', 'Világos'], ['#FFD85F', '#383838', 'Sárga']]
/** A szöveg linkjei (sorrendben): a felirat és a cím — a szerkesztő mutatja, hova visznek. */
function linksOf(html: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = []
  html.replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => { out.push({ href, text: inner.replace(/<[^>]+>/g, '').trim() }); return _m })
  return out
}
/** A `j`-edik link címének cseréje a szövegben (a felirat marad). */
function replaceLinkAt(html: string, j: number, url: string): string {
  let n = -1
  return html.replace(/(<a\b[^>]*?href=")([^"]*)("[^>]*>)/gi, (m, a: string, _h: string, b: string) => (++n === j ? `${a}${url.replace(/"/g, '&quot;')}${b}` : m))
}
export const blockName = (b: ComposerBlock) => (b.type === 'image' && b.kind === 'logo' ? 'Logó' : BLOCK_NAME[b.type])

export function useBlockInspector({ blocks, setBlocks, focusId, linkPlaceholder, linkPresets, logo, bizName }: {
  blocks: ComposerBlock[]
  setBlocks: (b: ComposerBlock[]) => void
  focusId: string | null
  /** a gomb / kép link-mezőjének mintája (pl. a foglalóoldal címe) */
  linkPlaceholder?: string
  /** gyors link-választó a gombhoz (pl. vendég-levélben: Naptár, Útvonal, Lemondás) — [felirat, érték] */
  linkPresets?: [string, string][]
  /** az üzlet logója — képnél „A logóm beillesztése” */
  logo?: string | null
  bizName?: string
}) {
  const focused = blocks.find((b) => b.id === focusId) ?? null
  const patchFocused = (p: Record<string, unknown>) => { if (focused) setBlocks(blocks.map((b) => (b.id === focused.id ? ({ ...b, ...p } as ComposerBlock) : b))) }
  // formázás (félkövér, dőlt, aláhúzott, link) a kijelölt blokk szövegén: a kijelölt részen, kijelölés nélkül az egészen
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const linkRange = useRef<Range | null>(null)
  const editableOf = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-block-id="${CSS.escape(id)}"] [contenteditable]`)].find((el) => el.offsetParent !== null) ?? null
  const selectIn = (root: HTMLElement) => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && !sel.isCollapsed && root.contains(sel.anchorNode)) return sel.getRangeAt(0)
    const r = document.createRange(); r.selectNodeContents(root); sel?.removeAllRanges(); sel?.addRange(r); return r
  }
  const format = (f: TextFormat) => {
    const root = focusId ? editableOf(focusId) : null
    if (!root) return
    const range = selectIn(root)
    if (f === 'link') { linkRange.current = range.cloneRange(); setLinkUrl('https://'); setLinkOpen(true); return }
    document.execCommand(f)
    root.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const applyLink = () => {
    const root = focusId ? editableOf(focusId) : null
    const url = linkUrl.trim()
    setLinkOpen(false)
    if (!root || !linkRange.current || !/^https?:\/\/\S+\.\S+/.test(url)) { if (url && url !== 'https://') toast.error('Érvénytelen link.'); return }
    root.focus()
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(linkRange.current)
    document.execCommand('createLink', false, url)
    root.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // a kijelölt blokk tartalom-mezői, amik nem a levélben íródnak (gomb felirata / linkje, kép alt / link, utalvány linkje)
  // gombsor: gombonként felirat, link (gyors-választóval) és szín; 1–3 gomb
  const putRow = (j: number, p: Partial<RowButton>) => { if (focused?.type === 'button_row') patchFocused({ items: focused.items.map((x, n) => (n === j ? { ...x, ...p } : x)) }) }
  const rowFields = focused?.type === 'button_row' ? (
    <div className="space-y-3 pb-1 pt-2">
      {focused.items.map((it, j) => {
        const tone = ROW_TONES.findIndex(([bg]) => (it.bg ?? null) === bg)
        return (
          <div key={j} className="space-y-1.5 rounded-ui-inner bg-ui-cell p-2.5">
            <div className="flex items-center justify-between gap-2"><Meta className="text-ui-label">{j + 1}. gomb</Meta>{focused.items.length > 1 && <IconButton icon={X} label="Gomb törlése" size="sm" variant="cell" onClick={() => patchFocused({ items: focused.items.filter((_, n) => n !== j) })} />}</div>
            <Field label="Felirat"><Input size="sm" value={it.label} onChange={(e) => putRow(j, { label: e.target.value })} /></Field>
            <Field label="Link"><Input size="sm" value={it.url} onChange={(e) => putRow(j, { url: e.target.value })} placeholder={linkPlaceholder} /></Field>
            {linkPresets && linkPresets.length > 0 && <div className="flex flex-wrap gap-1">{linkPresets.map(([l, v]) => <button key={v} type="button" onClick={() => putRow(j, { url: v })} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill size="sm" tone={it.url === v ? 'dark' : 'white'}>{l}</Pill></button>)}</div>}
            <Segmented size="sm" tone="cell" options={ROW_TONES.map(([, , l]) => l)} active={Math.max(0, tone)} onSelect={(i) => putRow(j, { bg: ROW_TONES[i][0], color: ROW_TONES[i][1] })} />
          </div>
        )
      })}
      {focused.items.length < 3 && <Button variant="cell" size="sm" icon={Plus} onClick={() => patchFocused({ items: [...focused.items, { label: 'Gomb', url: '', bg: '#EEEEEE', color: '#383838' }] })}>Gomb hozzáadása</Button>}
    </div>
  ) : null
  // szöveg-blokk linkjei: mi a szövegük és hova visznek (a változós linkeknél a nevük, pl. „Lemondás”) — átirányítható
  const textLinks = focused && 'html' in focused && typeof focused.html === 'string' ? linksOf(focused.html) : []
  const setLinkAt = (j: number, url: string) => { if (focused && 'html' in focused && typeof focused.html === 'string') patchFocused({ html: replaceLinkAt(focused.html, j, url) }) }
  const linkName = (url: string) => linkPresets?.find(([, v]) => v === url)?.[0]
  const linkFields = textLinks.length ? (
    <div className="space-y-2 pb-1 pt-2">
      <Meta className="text-ui-label">Linkek a szövegben</Meta>
      {textLinks.map((l, j) => (
        <div key={j} className="space-y-1.5 rounded-ui-inner bg-ui-cell p-2.5">
          <div className="text-ui-meta text-ui-text">„{l.text}”</div>
          <Meta className="text-ui-label">{linkName(l.href) ? `${linkName(l.href)} — a vendég saját linkje, kiküldéskor töltődik ki` : l.href || 'nincs cím'}</Meta>
          {linkPresets && linkPresets.length > 0 && <div className="flex flex-wrap gap-1">{linkPresets.map(([lab, v]) => <button key={v} type="button" onClick={() => setLinkAt(j, v)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill size="sm" tone={l.href === v ? 'dark' : 'white'}>{lab}</Pill></button>)}</div>}
          {!linkName(l.href) && <Input size="sm" value={l.href} onChange={(e) => setLinkAt(j, e.target.value)} placeholder="https://" aria-label="Link címe" />}
        </div>
      ))}
    </div>
  ) : null
  const blockFields = rowFields ?? linkFields ?? (focused && focused.type === 'social_links' ? (
    <div className="space-y-1.5 pb-1 pt-2">
      {focused.links.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input size="sm" value={l.url} onChange={(e) => patchFocused({ links: focused.links.map((x, j) => (j === i ? { url: e.target.value } : x)) })} placeholder="https://instagram.com/…" aria-label="Közösségi link" />
          <IconButton icon={X} label="Link törlése" size="sm" variant="cell" onClick={() => patchFocused({ links: focused.links.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Button variant="cell" size="sm" icon={Plus} onClick={() => patchFocused({ links: [...focused.links, { url: '' }] })}>Link hozzáadása</Button>
    </div>
  ) : focused && (focused.type === 'button' || focused.type === 'image' || focused.type === 'voucher') ? (
    <div className="space-y-1.5 pb-1 pt-2">
      {focused.type === 'button' && <Field label="Felirat"><Input size="sm" value={focused.label} onChange={(e) => patchFocused({ label: e.target.value })} /></Field>}
      {focused.type === 'voucher' && <Field label="Gomb felirata"><Input size="sm" value={focused.label} onChange={(e) => patchFocused({ label: e.target.value })} /></Field>}
      {focused.type === 'image' && <Field label="Mi látható a képen"><Input size="sm" value={focused.alt} onChange={(e) => patchFocused({ alt: e.target.value })} /></Field>}
      <Field label="Link"><Input size="sm" value={(focused.type === 'image' ? focused.link : focused.url) ?? ''} onChange={(e) => patchFocused(focused.type === 'image' ? { link: e.target.value } : { url: e.target.value })} placeholder={linkPlaceholder} /></Field>
      {focused.type === 'button' && linkPresets && linkPresets.length > 0 && (
        <div className="flex flex-wrap gap-1">{linkPresets.map(([l, v]) => <button key={v} type="button" onClick={() => patchFocused({ url: v })} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill size="sm" tone={focused.url === v ? 'dark' : 'cell'}>{l}</Pill></button>)}</div>
      )}
      {focused.type === 'image' && logo && focused.url !== logo && <Button variant="cell" size="sm" icon={Plus} onClick={() => patchFocused({ url: logo, alt: focused.alt || bizName, kind: 'logo', width: 'md', align: 'center' })}>A logóm beillesztése</Button>}
    </div>
  ) : null)
  const ft = focused?.type ?? ''
  const isText = TEXT_TYPES.includes(ft)
  const fullBtn = focused?.type === 'button' && focused.width === 'full'
  // a foglalás adatai (vendég-levél): mint egy gomb — háttér, betűszín, szélesség, igazítás; a tartalma nem
  const isDetails = ft === 'booking_details'
  const fullImg = focused?.type === 'image' && focused.kind !== 'logo' && (!focused.width || focused.width === 'full')
  const support: BlockStyleSupport = {
    bg: isText || ft === 'section' || ft === 'button' || isDetails, color: isText || ft === 'button' || isDetails, size: isText,
    level: (TITLE_TYPES as readonly string[]).includes(ft), format: isText,
    width: ft === 'image' && focused?.type === 'image' && focused.kind === 'logo' ? ['Kicsi', 'Közepes', 'Nagy'] : ft === 'image' ? ['Kicsi', 'Közepes', 'Teljes'] : ft === 'button' || isDetails ? ['Szöveghez', 'Teljes'] : ft === 'columns' ? ['2 kép', '3 kép'] : undefined,
    widthLabel: ft === 'columns' ? 'Képek egy sorban' : focused?.type === 'image' && focused.kind === 'logo' ? 'Méret' : undefined,
    align: isText || isDetails || ft === 'button_row' || ft === 'social_links' || (ft === 'button' && !fullBtn) || (ft === 'image' && !fullImg),
  }
  const styleValue: BlockStyleValue = (() => {
    const f = focused as (ComposerBlock & { bg?: string | null; color?: string | null; fontSize?: number; align?: string; width?: string }) | null
    const base = f ? BASE_SIZE[f.type] ?? 14 : 14
    const width = !f ? 0 : f.type === 'image' ? IMAGE_WIDTHS.indexOf((f.width as ImageWidth) ?? (f.kind === 'logo' ? 'md' : 'full')) : f.type === 'button' || f.type === 'booking_details' ? (f.width === 'full' ? 1 : 0) : f.type === 'columns' ? (f.cols.length >= 3 ? 1 : 0) : 0
    const level = Math.max(0, (TITLE_TYPES as readonly string[]).indexOf(f?.type ?? '')) as 0 | 1 | 2
    const align = f?.align === 'center' || f?.align === 'right' ? f.align : f?.type === 'social_links' && !f.align ? 'center' : 'left'
    return { bg: f?.bg ?? null, color: f?.color ?? null, size: !f?.fontSize ? 1 : f.fontSize < base ? 0 : 2, align, level, width }
  })()
  const setStyle = (v: BlockStyleValue) => {
    if (!focused) return
    setBlocks(blocks.map((b) => {
      if (b.id !== focused.id) return b
      const x = { ...b } as Record<string, unknown>
      if (support.level) x.type = TITLE_TYPES[v.level]
      const base = BASE_SIZE[String(x.type)] ?? 14
      if (support.bg) x.bg = v.bg
      if (support.color) x.color = v.color
      if (support.size) x.fontSize = v.size === 1 ? undefined : Math.round(base * SIZE_FACTOR[v.size])
      if (b.type === 'image') x.width = IMAGE_WIDTHS[v.width] ?? 'full'
      if (b.type === 'button' || b.type === 'booking_details') x.width = v.width === 1 ? 'full' : 'auto'
      if (b.type === 'columns') { const n = v.width === 1 ? 3 : 2; x.cols = Array.from({ length: n }, (_, i): ColumnCell => b.cols[i] ?? { type: 'image', url: '', alt: '' }) }
      if (support.align || b.type === 'image' || b.type === 'button') x.align = v.align
      return x as ComposerBlock
    }))
  }


  const linkModal = (
      <PopupModal open={linkOpen} onClose={() => setLinkOpen(false)} panel={
        <Modal title="Link" subtitle="A kijelölt szöveg erre a címre mutat." onClose={() => setLinkOpen(false)} footer={<><Button variant="cell" onClick={() => setLinkOpen(false)}>Mégse</Button><Button onClick={applyLink}>Beszúrás</Button></>}>
          <Input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyLink() }} placeholder="https://" aria-label="Link címe" />
        </Modal>
      } />
  )
  const inspector = focused ? <>{blockFields}<BlockStyle value={styleValue} onChange={setStyle} onFormat={format} supports={support} /></> : null
  return { focused, blockFields, support, styleValue, setStyle, format, linkModal, inspector, name: focused ? blockName(focused) ?? 'Blokk' : null }
}
