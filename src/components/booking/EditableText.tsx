'use client'

import { createContext, useContext, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import type { FieldPlaceholders } from '@/lib/publicPageView'
import { postToEditor } from '@/lib/editorBridge'
import { RichText, domToRich, richToHtml } from '@/lib/richText'
import { cn } from '@/lib/utils'

/**
 * Helyben szerkesztés a foglalóoldal-szerkesztő előnézetében (design 21.6.3). A `PublicPlaceView` adja a kijelölést
 * (`EditorSelection`), így a foglaló kártya belseje (munkatárs bemutatkozása, köszönő cím) is helyben írható.
 */
export const EditorSelection = createContext<{ editor: boolean; selected: string | null }>({ editor: false, selected: null })
export const useEditorSelection = () => useContext(EditorSelection)

/** Az üzlet saját szövegei a foglaló kártyán (a szerkesztő írja): a köszönő cím és a színe (CSS, már ellenőrizve). */
export const PageTexts = createContext<{ successTitle: string | null; successColor: string | null; placeholders?: FieldPlaceholders; texts?: Record<string, string> }>({ successTitle: null, successColor: null })

/**
 * A foglalás egy szövege (cím, magyarázó sor, gomb felirata): az üzlet saját szövege (`texts[k]`), különben az alap
 * (`children`). A szerkesztőben kijelölve helyben írható (`txt:<kulcs>`), mint a főoldal szövegei.
 */
export function Txt({ k, children, className, rich = false }: { k: string; children: string; className?: string; rich?: boolean }) {
  const { texts } = useContext(PageTexts)
  return <EditableText as="span" id={`txt:${k}`} value={texts?.[k] || children} single={!rich} rich={rich} className={className} />
}

/**
 * A foglaló űrlap egy mezőjének helykitöltője (design 21.6.3): az üzlet saját szövege, különben az alap. A szerkesztőben
 * a kijelölt mezőbe írva nem a vendég adatát töltöd ki, hanem a helykitöltőt írod át (minden leütés `text` üzenetként
 * `ph:<mező>` azonosítóval megy a szerkesztőnek). A visszaadott props a mezőre teendő UTOLJÁRA (felülírja value / onChange).
 */
export function useFieldPlaceholder(key: keyof FieldPlaceholders, fallback: string, selectId = `field:${key}`) {
  const { editor, selected } = useEditorSelection()
  const { placeholders } = useContext(PageTexts)
  const text = placeholders?.[key] || fallback
  const editing = editor && selected === selectId
  // írás közben a saját állapot (a szerkesztő visszaküldött draftja késve érkezik — különben a kurzor ugrana)
  const [local, setLocal] = useState(text)
  useEffect(() => { if (editing) setLocal(text) }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps
  // a szerkesztő előnézetében a mező üres (nem a mintakitöltés látszik), így mindig a helykitöltő látszik
  if (!editing) return editor ? { placeholder: text, value: '' } : { placeholder: text }
  return {
    placeholder: fallback,
    value: local,
    // ide írni lehet (a szerkesztőben minden más mezőbe tilos — a vendég adatát nem töltjük ki)
    'data-ph-edit': '',
    // halványan, ahogy a vendég látja (a helykitöltő színe) — hogy ne tűnjön beírt értéknek
    style: { color: 'color-mix(in srgb, currentColor 50%, transparent)' },
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setLocal(e.target.value); postToEditor({ type: 'text', id: `ph:${key}`, value: e.target.value }) },
  }
}

/**
 * Szöveg, ami a szerkesztőben kijelölve helyben írható; minden leütés `text` üzenetként megy a szerkesztőnek.
 * `rich`: **félkövér**, *dőlt*, [link] — a gyors-sáv gombjai (a böngésző saját formázása a kijelölt szövegen); a tárolt
 * alak jelöléses szöveg (lib/richText). `single`: egysoros (Enter befejezi). Kijelölés nélkül sima megjelenítés.
 *
 * Szerkesztés közben a szöveget NEM a React rendereli (nincs gyereke) — a böngésző kezeli, mi csak induláskor töltjük
 * bele; ha a React is írná (a draft visszaérkezésekor), a kettő összeakad, és a szöveg megduplázódik. A `key` miatt a
 * sima és a szerkeszthető elem külön DOM-elem.
 */
export function EditableText({ id, value, className, style, single = false, rich = false, as: Tag = 'p' }: {
  id: string; value: string; className?: string; style?: CSSProperties; single?: boolean; rich?: boolean; as?: 'p' | 'h1' | 'span' | 'div'
}) {
  const { editor, selected } = useEditorSelection()
  const editing = editor && selected === id
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    if (rich) el.innerHTML = richToHtml(value)
    else el.textContent = value
    el.focus()
    // a kurzor a szöveg végére
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- csak a szerkesztés kezdetekor töltjük be a szöveget
  }, [editing])
  if (!editing) return <Tag key="view" data-edit-id={id} className={className} style={style}>{rich ? <RichText text={value} /> : value}</Tag>
  const send = (el: HTMLElement) => postToEditor({ type: 'text', id, value: rich ? domToRich(el) : el.innerText })
  return (
    <Tag
      key="edit"
      ref={(n: HTMLElement | null) => { ref.current = n }}
      data-edit-id={id}
      data-editable
      contentEditable={rich ? true : 'plaintext-only'}
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => send(e.currentTarget as HTMLElement)}
      // beillesztés: csak sima szöveg (idegen formázás, kép ne kerüljön bele)
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }}
      onKeyDown={single ? (e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur() } } : undefined}
      className={cn(className, className?.includes('line-clamp') && 'line-clamp-none', 'cursor-text outline-none')}
      style={style}
    />
  )
}

/** A gyors-sáv formázó gombja a kijelölt (szerkesztett) szövegen: félkövér, dőlt, link — utána a szöveg mentése. */
export function formatSelection(kind: 'bold' | 'italic' | 'link', url?: string) {
  const el = document.querySelector<HTMLElement>('[data-editable]')
  if (!el) return
  el.focus()
  if (kind === 'link') { if (url) document.execCommand('createLink', false, url) }
  else document.execCommand(kind)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
