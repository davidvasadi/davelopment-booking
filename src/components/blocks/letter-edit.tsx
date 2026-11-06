'use client'

import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { UploadTile, type UploadState } from './upload'
import { uploadMedia } from '@/lib/uploadMedia'

/* A kampány-levél szerkesztés-darabjai (a `LetterBlocks` írás-módja használja, design 13.4): helyben szerkeszthető
 * szöveg és kép-hely. Külön kliens-modul, hogy a levél-blokk maga hook nélküli maradjon (a design oldal is rendereli). */

/** Helyben szerkeszthető szöveg (contentEditable) — a tartalmat csak egyszer tölti be, így gépelés közben nem ugrik a
 *  kurzor; `list`: felsorolás (<ul>, soronként <li>). */
export function Editable({ html, onChange, placeholder, list = false, className = '', style }: { html: string; onChange: (html: string) => void; placeholder?: string; list?: boolean; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = list ? html || '<li></li>' : html
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const Tag = (list ? 'ul' : 'div') as 'div'
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
      onInput={(e) => onChange((e.target as HTMLElement).innerHTML)} style={style}
      className={`min-w-0 break-words outline-none [&:empty]:before:text-ui-muted [&:empty]:before:content-[attr(data-placeholder)] ${className}`} />
  )
}

/** A kép helye írás-módban: üresen szaggatott „Kép feltöltése” csempe, feltöltés közben a közös UploadTile százalékkal,
 *  kész képnél a kép (rákattintva csere). */
/** `fit`: a kép a saját arányában (logó) — a magasságot a `className` adja, a szélesség ehhez igazodik */
export function ImageSlot({ url, onChange, className = '', fit = false }: { url: string; onChange: (url: string) => void; className?: string; fit?: boolean }) {
  const [up, setUp] = useState<UploadState | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const pick = () => input.current?.click()
  const upload = async (f: File) => {
    try { const r = await uploadMedia(f, setUp); onChange(r.url); setUp(null) }
    catch (e) { setUp((u) => (u ? { ...u, error: 'hiba' } : null)); toast.error(e instanceof Error ? e.message : 'Kép feltöltése sikertelen') }
  }
  return (
    <>
      {up ? <UploadTile src={up.src} pct={up.pct} proc={up.proc} error={!!up.error} onRetry={() => { setUp(null); pick() }} className={`w-full ${className}`} />
        : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <button type="button" onClick={pick} title="Kép cseréje" className={`outline-none ${fit ? 'inline-block max-w-[60%]' : 'block w-full'}`}><img src={url} alt="" className={`${fit ? 'w-auto max-w-full object-contain' : 'w-full object-cover'} ${className}`} /></button>
        ) : (
          <button type="button" onClick={pick} className={`flex w-full flex-col items-center justify-center gap-1.5 border border-dashed border-ui-divider bg-ui-cell text-ui-label text-ui-muted outline-none hover:text-ui-text ${className}`}>
            <ImageIcon className="h-5 w-5" strokeWidth={1.8} />Kép feltöltése
          </button>
        )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
    </>
  )
}
