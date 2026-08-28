'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'
import {
  Type, LayoutGrid, Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered,
  RectangleHorizontal, Minus, Trash2, Bold, Italic, Underline, Strikethrough, Link2,
  AlignLeft, AlignCenter, AlignRight, Paintbrush, Image as ImageIcon, Play, GripVertical,
  Rows2, Columns2, Columns3, Columns4, Share2, Code2, Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonHover } from '@/lib/motion'
import { compressImage } from '@/lib/compressImage'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'
import { blocksToHtml, emptyTextBlock, nextId, type ComposerBlock, type ColumnCell, type TextAlign } from '@/lib/emailBlocks'

export { blocksToHtml, emptyTextBlock }
export type { ComposerBlock }

/**
 * Blokk-alapú hírlevél-szerkesztő — a Resend-féle sablon-builder vizuális nyelvét követi
 * (lebegő fekete ikon-sín bal oldalon, kattintásra kinyíló fekete flyout-menü blokk-
 * típusokkal). YouTube/X/Diagram embedek egyik email-kliensben sem futnak (nincs iframe/JS) —
 * ezért ezek is (a valódi Resend-szerkesztőhöz hasonlóan) egy sima, kattintható KÉP-blokkot
 * szúrnak be, opcionális kimenő linkkel.
 */

// ── YouTube-borítókép ────────────────────────────────────────────────────────────
// A YouTube API-kulcs nélkül is kiszolgál egy kiszámítható borítókép-URL-t bármelyik videóhoz
// — ezt használjuk ki: a felhasználó csak beilleszti a videó linkjét, a videó-ID-t innen
// nyerjük ki, a többi automatikus (borítókép + lejátszás-gomb overlay + link a videóra).
function parseYouTubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.replace(/^www\./, '').endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
      if (m) return m[2]
    }
    return null
  } catch {
    return null
  }
}
function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

type InsertableType = ComposerBlock['type']
type RailItem = { type: InsertableType; label: string; icon: typeof Type; cols?: number; kind?: 'image' | 'youtube' }

const TEXT_ITEMS: RailItem[] = [
  { type: 'text', label: 'Szöveg', icon: Pilcrow },
  { type: 'title', label: 'Cím', icon: Heading1 },
  { type: 'subtitle', label: 'Alcím', icon: Heading2 },
  { type: 'heading', label: 'Kiemelés', icon: Heading3 },
  { type: 'bullet_list', label: 'Felsorolás', icon: List },
  { type: 'numbered_list', label: 'Számozott lista', icon: ListOrdered },
]

const IMAGE_ITEMS: RailItem[] = [
  { type: 'image', label: 'Kép', icon: ImageIcon },
  { type: 'image', label: 'YouTube', icon: Play, kind: 'youtube' },
]

const LAYOUT_ITEMS: RailItem[] = [
  { type: 'button', label: 'Gomb', icon: RectangleHorizontal },
  { type: 'divider', label: 'Elválasztó', icon: Minus },
  { type: 'section', label: 'Szakasz', icon: Rows2 },
  { type: 'columns', label: '2 oszlop', icon: Columns2, cols: 2 },
  { type: 'columns', label: '3 oszlop', icon: Columns3, cols: 3 },
  { type: 'columns', label: '4 oszlop', icon: Columns4, cols: 4 },
  { type: 'social_links', label: 'Közösségi linkek', icon: Share2 },
  { type: 'html', label: 'HTML', icon: Code2 },
  { type: 'code', label: 'Kód', icon: Braces },
]

const RAIL_GROUPS: { key: 'text' | 'image' | 'layout'; icon: typeof Type; items: RailItem[]; title: string }[] = [
  { key: 'text', icon: Type, items: TEXT_ITEMS, title: 'Szöveg-blokkok' },
  { key: 'image', icon: ImageIcon, items: IMAGE_ITEMS, title: 'Média' },
  { key: 'layout', icon: LayoutGrid, items: LAYOUT_ITEMS, title: 'Elemek' },
]

const PLACEHOLDER: Record<string, string> = {
  text: 'Írj egy bekezdést…',
  title: 'Cím…',
  subtitle: 'Alcím…',
  heading: 'Kiemelt szöveg…',
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Szöveg',
  title: 'Cím',
  subtitle: 'Alcím',
  heading: 'Kiemelés',
  bullet_list: 'Felsorolás',
  numbered_list: 'Számozott lista',
}
const TEXT_TYPE_OPTIONS = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list'] as const

function newBlock(type: InsertableType, opts?: { cols?: number; kind?: 'image' | 'youtube' }): ComposerBlock {
  const id = nextId()
  switch (type) {
    case 'button': return { id, type: 'button', label: 'Gomb szövege', url: '' }
    case 'divider': return { id, type: 'divider' }
    case 'image': return { id, type: 'image', url: '', alt: '', link: '', kind: opts?.kind ?? 'image' }
    case 'section': return { id, type: 'section', html: '', bg: '#F7F5F0' }
    case 'columns': return { id, type: 'columns', cols: Array.from({ length: opts?.cols ?? 2 }, (): ColumnCell => ({ type: 'empty' })) }
    case 'social_links': return { id, type: 'social_links', links: [{ url: '' }] }
    case 'html': return { id, type: 'html', code: '' }
    case 'code': return { id, type: 'code', code: '' }
    default: return { id, type, html: '' }
  }
}

/** Apple-szerű "genie" belépő — a UserMenu fiók-popoverének bevált mintája (spring
 *  scale+fade, a gyerek-sorok streamszerű stagger-rel folynak be utána). */
const FLYOUT_PANEL = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.9, staggerChildren: 0.03, delayChildren: 0.04 } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.12, ease: 'easeIn' as const } },
}
const FLYOUT_ITEM = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

/** A `ComposerBlock` union `align`/`bg` mezői OPCIONÁLISAK — friss blokkon (pl. `{ id, type:
 *  'text', html: '' }`) a mező szó szerint nincs is jelen, csak akkor kerül rá, ha valaki
 *  ténylegesen módosította. Ezért a támogatottságot a `type` alapján kell eldönteni, NEM a
 *  `'align' in block` futásidejű ellenőrzéssel (az egy friss blokknál mindig hamis lenne). */
const ALIGN_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list', 'button', 'image']
const BG_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list', 'section']
/** Betűszín/betűméret/sorköz csak a "valódi" szöveg-blokkokon értelmezhető (gomb/kép/szakasz
 *  kimarad — azoknak nincs ilyen mezőjük az adatmodellben). */
const TEXT_STYLE_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list']

/** A 4. sín-gomb ("Formázás") tartalma NEM blokk-beszúrás, hanem a fókuszált blokk (vagy —
 *  ha épp egy oszlop-cella van fókuszban — a cella) igazítását/szín-mezőit szerkeszti — ezért
 *  nem illik a `RailFlyout` insertable-item mintájába, saját komponenst kapott. A támogatott
 *  mezőket (és jelenlegi értéküket) a HÍVÓ számolja ki — a blokk és a cella eltérő típus, ezt
 *  a komponensnek nem kell ismernie, csak a végeredményt kapja meg. */
function FormatFlyout({ hasTarget, supportsAlign, supportsBg, supportsColor, supportsSize, currentAlign, currentBg, currentColor, currentFontSize, currentLineHeight, onAlign, onBg, onColor, onFontSize, onLineHeight, align = 'top' }: {
  hasTarget: boolean
  supportsAlign: boolean
  supportsBg: boolean
  supportsColor: boolean
  supportsSize: boolean
  currentAlign: TextAlign
  currentBg: string | null
  currentColor: string | null
  currentFontSize: number | undefined
  currentLineHeight: number | undefined
  onAlign: (a: TextAlign) => void
  onBg: (bg: string | null) => void
  onColor: (c: string | null) => void
  onFontSize: (n: number | undefined) => void
  onLineHeight: (n: number | undefined) => void
  align?: 'top' | 'bottom'
}) {
  return (
    <motion.div
      variants={FLYOUT_PANEL}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: 'left center' }}
      className={cn(
        'absolute left-full z-30 ml-2 w-56 rounded-2xl bg-ink-dark p-3 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]',
        align === 'top' ? 'top-0' : 'bottom-0',
      )}
    >
      {!hasTarget ? (
        <p className="px-1 py-1.5 text-[12.5px] text-white/50">Jelölj ki egy blokkot a tartalomban.</p>
      ) : !supportsAlign && !supportsBg ? (
        <p className="px-1 py-1.5 text-[12.5px] text-white/50">Ez a blokk-típus nem támogat formázást.</p>
      ) : (
        <div className="space-y-3">
          {supportsAlign && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Igazítás</p>
              <div className="flex items-center gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <motion.button
                    key={a}
                    type="button"
                    variants={buttonHover}
                    initial="rest"
                    whileHover="hover"
                    whileTap="hover"
                    onClick={() => onAlign(a)}
                    className={cn('flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white', currentAlign === a && 'bg-white/15 text-white')}
                    title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
                  >
                    {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {supportsColor && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Betűszín</p>
              <div className="flex items-center gap-2 px-1">
                <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-[7px] border border-white/15">
                  <span className="absolute inset-0" style={{ background: currentColor ?? '#3B3B3B' }} />
                  <input type="color" value={currentColor ?? '#3B3B3B'} onChange={(e) => onColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                {currentColor && (
                  <button type="button" onClick={() => onColor(null)} className="text-[11.5px] font-medium text-white/50 hover:text-white">törlés</button>
                )}
              </div>
            </div>
          )}
          {supportsBg && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Háttérszín</p>
              <div className="flex items-center gap-2 px-1">
                <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-[7px] border border-white/15">
                  <span className="absolute inset-0" style={{ background: currentBg ?? '#ffffff' }} />
                  <input type="color" value={currentBg ?? '#ffffff'} onChange={(e) => onBg(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                {currentBg && (
                  <button type="button" onClick={() => onBg(null)} className="text-[11.5px] font-medium text-white/50 hover:text-white">törlés</button>
                )}
              </div>
            </div>
          )}
          {supportsSize && (
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Betűméret</p>
                <div className="flex items-center gap-1.5 rounded-[8px] bg-white/10 px-2">
                  <input
                    type="number"
                    min={10}
                    max={48}
                    placeholder="Alap"
                    value={currentFontSize ?? ''}
                    onChange={(e) => onFontSize(e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 w-full min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                  />
                  <span className="shrink-0 text-[11px] text-white/40">px</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Sorköz</p>
                <div className="flex items-center gap-1.5 rounded-[8px] bg-white/10 px-2">
                  <input
                    type="number"
                    min={1}
                    max={3}
                    step={0.1}
                    placeholder="Alap"
                    value={currentLineHeight ?? ''}
                    onChange={(e) => onLineHeight(e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 w-full min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function RailFlyout({ items, onPick, align = 'top' }: { items: RailItem[]; onPick: (item: RailItem) => void; align?: 'top' | 'bottom' }) {
  return (
    <motion.div
      variants={FLYOUT_PANEL}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: 'left center' }}
      className={cn(
        'absolute left-full z-30 ml-2 max-h-[80vh] w-52 overflow-y-auto rounded-2xl bg-ink-dark p-1.5 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]',
        align === 'top' ? 'top-0' : 'bottom-0',
      )}
    >
      {items.map((it, i) => (
        <motion.button
          variants={FLYOUT_ITEM}
          key={`${it.type}-${i}`}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(it)}
          whileHover={{ x: 2 }}
          whileTap={{ x: 2 }}
          transition={{ duration: 0.12 }}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <it.icon className="h-4 w-4 shrink-0 text-white/60" strokeWidth={1.8} />
          {it.label}
        </motion.button>
      ))}
    </motion.div>
  )
}

/** KontentEditable szöveg-blokk — a DOM-ot csak MOUNTKOR töltjük fel (üresen indul minden új
 *  blokk), utána a böngésző saját szerkesztés-állapotát sose írjuk felül React-ből — így a
 *  kurzor sosem ugrik el gépelés közben. Kifelé csak `onInput`-tal jelentünk. */
function EditableBlock({ type, html, align, bg, color, fontSize, lineHeight, autoFocus, cellIndex, onInput }: { type: string; html: string; align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number; autoFocus?: boolean; cellIndex?: number; onInput: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !ref.current) return
    seeded.current = true
    if (type === 'bullet_list' || type === 'numbered_list') ref.current.innerHTML = html || '<li></li>'
    else ref.current.innerHTML = html
    if (autoFocus) ref.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, html])

  const cls = cn(
    'w-full min-w-0 break-words bg-transparent outline-none [&:empty]:before:text-ink-soft2 [&:empty]:before:content-[attr(data-placeholder)]',
    type === 'title' && 'text-[22px] font-bold text-ink',
    type === 'subtitle' && 'text-[17px] font-semibold text-ink',
    type === 'heading' && 'text-[15px] font-semibold text-ink',
    type === 'text' && 'text-[14px] text-ink',
    (type === 'bullet_list') && 'list-disc pl-5 text-[14px] text-ink [&:empty]:before:content-none',
    (type === 'numbered_list') && 'list-decimal pl-5 text-[14px] text-ink [&:empty]:before:content-none',
  )

  const Tag = type === 'bullet_list' ? 'ul' : type === 'numbered_list' ? 'ol' : 'div'
  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onInput((e.target as HTMLElement).innerHTML)}
      data-placeholder={PLACEHOLDER[type]}
      data-cell-index={cellIndex ?? undefined}
      className={cls}
      style={{
        textAlign: align ?? 'left',
        background: bg ?? undefined,
        padding: bg ? '10px 14px' : undefined,
        borderRadius: bg ? '8px' : undefined,
        color: color ?? undefined,
        fontSize: fontSize ? `${fontSize}px` : undefined,
        lineHeight: lineHeight ?? undefined,
      }}
    />
  )
}

type ImageBlock = Extract<ComposerBlock, { type: 'image' }>

/** Kép-blokk szerkesztő — ugyanaz a feltöltés-minta, mint a szalon/étterem logó/borítókép
 *  feltöltésénél (`SalonSettingsForm.tsx`): kliens-oldali tömörítés (`compressImage`) + FormData
 *  POST a Payload `/api/media` végpontjára. */
function ImageBlockEditor({ block, onChange }: { block: ImageBlock; onChange: (patch: Partial<ImageBlock>) => void }) {
  const [uploading, setUploading] = useState(false)
  const [ytInput, setYtInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      onChange({ url: json.doc.url })
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(false)
    }
  }

  const applyYoutube = (raw: string) => {
    const id = parseYouTubeId(raw)
    if (!id) { toast.error('Ez nem egy felismerhető YouTube-link.'); return }
    onChange({ url: youtubeThumbUrl(id), link: youtubeWatchUrl(id), alt: block.alt || 'YouTube videó' })
  }

  const alignRow = block.url ? (
    <div className="flex items-center gap-1">
      {(['left', 'center', 'right'] as const).map((a) => (
        <motion.button
          key={a}
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ align: a })}
          className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (block.align ?? 'left') === a && 'bg-paper text-ink')}
          title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
        >
          {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
        </motion.button>
      ))}
    </div>
  ) : null

  if (block.kind === 'youtube') {
    return (
      <div className="space-y-2 py-1.5">
        {alignRow}
        {block.url ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.url} alt={block.alt} className="max-h-48 rounded-[10px] border border-line" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
            </div>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => onChange({ url: '', link: '' })} title="Videó eltávolítása" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm transition-colors hover:text-[#C0392B]">
              <Trash2 className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        ) : (
          <input
            value={ytInput}
            onChange={(e) => {
              const v = e.target.value
              setYtInput(v)
              if (parseYouTubeId(v)) applyYoutube(v)
            }}
            placeholder="YouTube videó linkje…"
            autoFocus
            className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
        )}
        <input
          value={block.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Alternatív szöveg (alt)"
          className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 py-1.5">
      {alignRow}
      {block.url ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.alt} className="max-h-48 rounded-[10px] border border-line" />
          <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => onChange({ url: '' })} title="Kép törlése" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm transition-colors hover:text-[#C0392B]">
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      ) : (
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full max-w-[320px] items-center justify-center rounded-[10px] border border-dashed border-line-strong text-[13px] font-medium text-ink-soft2 hover:border-gold/60 hover:text-ink disabled:opacity-60"
        >
          {uploading ? 'Feltöltés…' : 'Kép feltöltése'}
        </motion.button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      <input
        value={block.alt}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alternatív szöveg (alt)"
        className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      />
      <input
        value={block.link ?? ''}
        onChange={(e) => onChange({ link: e.target.value })}
        placeholder="Link a képre kattintva (opcionális)"
        className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      />
    </div>
  )
}

/** Egy oszlop-cella szerkesztője — üresen 3 típus közül lehet választani (Szöveg/Kép/Gomb),
 *  utána a választott típus szerkesztő-felülete jelenik meg, egy "ürítés" gombbal visszaváltva
 *  üres állapotba. */
function ColumnCellEditor({ cell, cellIndex, onChange, onFocus }: { cell: ColumnCell; cellIndex: number; onChange: (next: ColumnCell) => void; onFocus: () => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      onChange({ type: 'image', url: json.doc.url, alt: '' })
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(false)
    }
  }

  if (cell.type === 'empty') {
    return (
      <div className="flex h-9 items-center justify-center gap-1">
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ type: 'text', html: '' })}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink"
          title="Szöveg"
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </motion.button>
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
          title="Kép"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </motion.button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ type: 'button', label: 'Gomb', url: '' })}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink"
          title="Gomb"
        >
          <RectangleHorizontal className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5" onClick={onFocus}>
      <div className="flex justify-end">
        <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={(e) => { e.stopPropagation(); onChange({ type: 'empty' }) }} className="text-ink-soft2 transition-colors hover:text-[#C0392B]" title="Cella ürítése">
          <Trash2 className="h-3.5 w-3.5" />
        </motion.button>
      </div>
      {cell.type === 'text' && (
        <EditableBlock type="text" html={cell.html} align={cell.align} color={cell.color} bg={cell.bg} cellIndex={cellIndex} onInput={(html) => onChange({ ...cell, html })} />
      )}
      {cell.type === 'image' && (
        cell.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cell.url} alt={cell.alt} className="w-full rounded-[8px]" />
        ) : (
          <>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-16 w-full items-center justify-center rounded-[8px] border border-dashed border-line-strong text-[12px] text-ink-soft2 hover:border-gold/60 hover:text-ink disabled:opacity-60">
              {uploading ? 'Feltöltés…' : 'Kép feltöltése'}
            </motion.button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
          </>
        )
      )}
      {cell.type === 'button' && (
        <div className="space-y-1.5">
          <input value={cell.label} onChange={(e) => onChange({ ...cell, label: e.target.value })} placeholder="Gomb szövege" className="block h-8 w-full rounded-[8px] border border-line-strong bg-white px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60" />
          <input value={cell.url} onChange={(e) => onChange({ ...cell, url: e.target.value })} placeholder="https://…" className="block h-8 w-full rounded-[8px] border border-line-strong bg-white px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60" />
        </div>
      )}
    </div>
  )
}

/** Egy blokk-sor — `Reorder.Item`-ként, saját `dragControls`-szal, hogy CSAK a bal szélen lévő
 *  fogópont indítson húzást (`dragListener={false}`), ne az egész blokk (ami elvinné a
 *  contentEditable-ök normál kattintás/szövegkijelölés viselkedését). */
function BlockRow({
  block: b,
  isFocused,
  focusedCellIndex,
  onFocusBlock,
  onFocusCell,
  remove,
  patch,
  updateHtml,
  updateButton,
}: {
  block: ComposerBlock
  isFocused: boolean
  focusedCellIndex: number | null
  onFocusBlock: () => void
  onFocusCell: (index: number) => void
  remove: (id: string) => void
  patch: (id: string, fn: (b: ComposerBlock) => ComposerBlock) => void
  updateHtml: (id: string, html: string) => void
  updateButton: (id: string, field: 'label' | 'url', value: string) => void
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="div"
      value={b}
      dragListener={false}
      dragControls={dragControls}
      data-block-id={b.id}
      onFocusCapture={onFocusBlock}
      onClick={onFocusBlock}
      className={cn('group relative rounded-[10px] px-2 py-1.5 transition-colors hover:bg-paper/70', isFocused && 'bg-paper/50')}
    >
      {/* Húzó fogópont a bal szélen, függőlegesen középen — csak a pöttyök, nincs kör/keret
          körülötte (mindig látható, nem hoverre jelenik meg). */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute left-1 top-1/2 z-10 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-ink-soft2 active:cursor-grabbing"
        title="Húzd az átrendezéshez"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <motion.button
        type="button"
        variants={buttonHover}
        initial="rest"
        whileHover="hover"
        whileTap="hover"
        onClick={() => remove(b.id)}
        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-white text-ink-soft shadow-[0_1px_4px_rgba(0,0,0,.12)] hover:text-[#C0392B]"
        title="Blokk törlése"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </motion.button>

      {b.type === 'divider' ? (
        <hr className="my-3 border-t border-line" />
      ) : b.type === 'button' ? (
        <div className="space-y-2 py-1.5 pl-6">
          <div className="mb-1 flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onClick={() => patch(b.id, (x) => (x.type === 'button' ? { ...x, align: a } : x))}
                className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (b.align ?? 'left') === a && 'bg-paper text-ink')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
              </motion.button>
            ))}
          </div>
          <input
            value={b.label}
            onChange={(e) => updateButton(b.id, 'label', e.target.value)}
            placeholder="Gomb szövege"
            className="inline-flex h-9 items-center rounded-full bg-ink-dark px-4 text-[13px] font-semibold text-white outline-none placeholder:text-white/50"
          />
          <input
            value={b.url}
            onChange={(e) => updateButton(b.id, 'url', e.target.value)}
            placeholder="https://…"
            className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
        </div>
      ) : b.type === 'image' ? (
        <div className="pl-6">
          <ImageBlockEditor block={b} onChange={(p) => patch(b.id, (x) => (x.type === 'image' ? { ...x, ...p } : x))} />
        </div>
      ) : b.type === 'section' ? (
        <div className="space-y-1.5 py-1.5 pl-6">
          <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink" title="Háttérszín">
            <Paintbrush className="h-3 w-3" />
            <input
              type="color"
              value={b.bg ?? '#F7F5F0'}
              onChange={(e) => patch(b.id, (x) => (x.type === 'section' ? { ...x, bg: e.target.value } : x))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <div style={{ background: b.bg ?? '#F7F5F0', borderRadius: 10, padding: 14 }}>
            <EditableBlock type="text" html={b.html} autoFocus={isFocused} onInput={(html) => updateHtml(b.id, html)} />
          </div>
        </div>
      ) : b.type === 'columns' ? (
        // A cellák a sorban lévő legmagasabb testvérhez igazodnak (böngésző-alapértelmezett grid
        // `align-items: stretch`), hogy a sor mindig egyenletes/rendezett maradjon. Ha egy cella
        // tartalma (pl. üres állapot ikon-sora, vagy egy rövid "közösségi link" szerkesztő)
        // rövidebb, mint a sor legmagasabb testvére, a `flex justify-center` FÜGGŐLEGESEN
        // KÖZÉPRE igazítja a stretchelt dobozon belül — így nem egy csúnya, tetejére tapadt,
        // alul üresen lógó dobozként hat, hanem szándékosan középre rendezettként. A `layout`
        // propon keresztül a méretváltás (üres → kitöltött állapot) framer-motion-nal simán
        // animálódik — ekkor a TÖBBI cella is vele animálva nő/csökken, mert a sor egy közös
        // magasságra igazodik.
        <div className="grid gap-2 py-1.5 pl-6" style={{ gridTemplateColumns: `repeat(${b.cols.length}, minmax(0,1fr))` }}>
          {b.cols.map((c, i) => (
            <motion.div
              key={i}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className={cn(
                'flex flex-col justify-center rounded-[10px] border border-dashed p-2 transition-colors',
                focusedCellIndex === i ? 'border-gold bg-gold/5' : 'border-line-strong',
              )}
            >
              <ColumnCellEditor
                cell={c}
                cellIndex={i}
                onFocus={() => onFocusCell(i)}
                onChange={(next) => patch(b.id, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === i ? next : cc)) } : x))}
              />
            </motion.div>
          ))}
        </div>
      ) : b.type === 'social_links' ? (
        <div className="space-y-2 pb-1.5 pl-6 pt-6">
          <div className="mb-1 flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, align: a } : x))}
                className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (b.align ?? 'center') === a && 'bg-paper text-ink')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
              </motion.button>
            ))}
          </div>
          {b.links.map((l, i) => {
            const platform = detectPlatform(l.url)
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex h-10 flex-1 items-center gap-2 rounded-[10px] border border-line-strong bg-white pl-1.5 pr-3 focus-within:ring-2 focus-within:ring-gold/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={socialIconDataUri(platform)} alt={SOCIAL_LABELS[platform]} className="h-7 w-7 shrink-0 rounded-full" />
                  <input
                    value={l.url}
                    onChange={(e) => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: x.links.map((ll, li) => (li === i ? { ...ll, url: e.target.value } : ll)) } : x))}
                    placeholder="https://instagram.com/felhasznalonev"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
                  />
                </div>
                <motion.button
                  type="button"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  whileTap="hover"
                  onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: x.links.filter((_, li) => li !== i) } : x))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 transition-colors hover:text-[#C0392B]"
                  title="Link törlése"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: [...x.links, { url: '' }] } : x))}
            className="text-[12px] font-semibold text-ink-soft hover:text-ink"
          >
            + Link hozzáadása
          </button>
        </div>
      ) : b.type === 'html' ? (
        <textarea
          value={b.code}
          onChange={(e) => patch(b.id, (x) => (x.type === 'html' ? { ...x, code: e.target.value } : x))}
          placeholder="<div>Egyedi HTML…</div>"
          rows={4}
          className="w-full resize-y rounded-[10px] border border-line-strong bg-white py-2 pl-6 pr-3 font-mono text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      ) : b.type === 'code' ? (
        <input
          value={b.code}
          onChange={(e) => patch(b.id, (x) => (x.type === 'code' ? { ...x, code: e.target.value } : x))}
          placeholder="pl. KEDVEZMENY20"
          className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white py-0 pl-6 pr-3 font-mono text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      ) : (
        <div className="pl-6">
          <EditableBlock type={b.type} html={b.html} align={b.align} bg={b.bg} color={b.color} fontSize={b.fontSize} lineHeight={b.lineHeight} autoFocus={isFocused} onInput={(html) => updateHtml(b.id, html)} />
        </div>
      )}
    </Reorder.Item>
  )
}

export function NewsletterBlockEditor({
  blocks, onChange,
  minHeight = 520,
  // 'floating' (alap, hírlevél): a sín `lg:`-től `absolute`-ba vált, a legközelebbi `relative`
  // ősre tapad — ehhez a HÍVÓNAK kell egy tágas, `relative` konténert adnia (ld. NewsletterManager).
  // 'flow' (pl. tranzakciós email bevezetője, szűkebb form-mező): a sín MINDIG normál flex-
  // oszlopként ül a tartalom mellett, sosem vált absolute-ba — nincs szükség külön `relative`
  // ősre/paddingre a hívó oldalán, és garantáltan nem lóghat bele a tartalomba.
  railMode = 'floating',
}: { blocks: ComposerBlock[]; onChange: (b: ComposerBlock[]) => void; minHeight?: number; railMode?: 'flow' | 'floating' }) {
  const [openMenu, setOpenMenu] = useState<'text' | 'image' | 'layout' | 'format' | null>(null)
  // Melyik blokkot szerkeszted épp — a bal sínből beszúrt új blokk EMÖGÉ kerül, nem mindig a
  // lista végére (mint egy Notion-szerű szerkesztőben: oda kerül, ahol éppen dolgozol).
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Melyik oszlop-CELLA van fókuszban — ha ez be van állítva, a bal sínből választott elem NEM
  // új top-level blokkot szúr be, hanem ebbe a cellába kerül (ez helyettesíti a korábbi,
  // cellánként háromszor ismételt Szöveg/Kép/Gomb választó-gombokat, ami 4 oszlopnál kilátszott
  // a képernyőből — most a MEGLÉVŐ bal sáv szolgál választóként, ahogy a canvas többi részén is).
  const [focusedCell, setFocusedCell] = useState<{ blockId: string; index: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Szöveg-kijelöléskor lebegő "bubble" eszköztár jelenik meg a kijelölés fölött (mint a
  // referencia-szerkesztőben) — típus-váltó legördülő + igazítás + inline formázás.
  const [bubble, setBubble] = useState<{ top: number; left: number; blockId: string; cellIndex?: number } | null>(null)
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !containerRef.current) { setBubble(null); return }
      const range = sel.getRangeAt(0)
      if (!containerRef.current.contains(range.commonAncestorContainer)) { setBubble(null); return }
      // Oszlop-cellák tartalma UGYANAZT a `data-block-id`-t örökli (az egész oszlop-blokk sora
      // hordozza), de a cella saját contentEditable-jén van egy `data-cell-index` is — ez teszi
      // lehetővé, hogy a bubble a KONKRÉT cellára célozzon, ne a teljes oszlop-blokkra (aminek
      // típusa 'columns', tehát önmagában sose "szöveg-szerű").
      let node: Node | null = range.commonAncestorContainer
      let blockId: string | null = null
      let cellIndex: number | undefined
      while (node) {
        if (node instanceof HTMLElement) {
          if (cellIndex === undefined && node.dataset.cellIndex !== undefined) cellIndex = Number(node.dataset.cellIndex)
          if (node.dataset.blockId) { blockId = node.dataset.blockId; break }
        }
        node = node.parentNode
      }
      if (!blockId) { setBubble(null); return }
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) { setBubble(null); return }
      setBubble({ top: rect.top, left: rect.left + rect.width / 2, blockId, cellIndex })
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  // A bal sáv MINDIG a szokásos top-level beszúrást végzi, akkor is, ha épp egy oszlop-cella van
  // fókuszban — a cellák saját, helyi ikon-sorral (Szöveg/Kép/Gomb/Közösségi) kapnak tartalmat,
  // nem a sávból. (Korábban a sáv a fókuszált cellába routolt, ami zavaró volt: ha valaki egy
  // cellára kattintott, majd a sávból Képet/YouTube-ot választott top-level beszúrás szándékkal,
  // az véletlenül a cellába szúrt be.)
  const insert = (item: RailItem) => {
    const block = newBlock(item.type, { cols: item.cols, kind: item.kind })
    const idx = focusedId ? blocks.findIndex((b) => b.id === focusedId) : -1
    if (idx === -1) onChange([...blocks, block])
    else onChange([...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)])
    setFocusedId(block.id)
    setFocusedCell(null)
    setOpenMenu(null)
  }
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const patch = (id: string, fn: (b: ComposerBlock) => ComposerBlock) => onChange(blocks.map((b) => (b.id === id ? fn(b) : b)))
  const updateHtml = (id: string, html: string) =>
    onChange(blocks.map((b) => (b.id === id && b.type !== 'button' && b.type !== 'divider' && b.type !== 'image' && b.type !== 'columns' && b.type !== 'social_links' && b.type !== 'html' && b.type !== 'code' ? { ...b, html } : b)))
  const updateButton = (id: string, field: 'label' | 'url', value: string) =>
    onChange(blocks.map((b) => (b.id === id && b.type === 'button' ? { ...b, [field]: value } : b)))
  const updateType = (id: string, type: typeof TEXT_TYPE_OPTIONS[number]) =>
    onChange(blocks.map((b) => (b.id === id && b.type !== 'button' && b.type !== 'divider' && b.type !== 'image' && b.type !== 'section' && b.type !== 'columns' && b.type !== 'social_links' && b.type !== 'html' && b.type !== 'code' ? { ...b, type } : b)))
  // FONTOS: a `'align' in x` / `'bg' in x` futásidejű ellenőrzés HAMIS egy friss blokkon, mert
  // ott a mező szó szerint nincs jelen (csak `align?`/`bg?`, sose lett még beállítva) — emiatt
  // korábban a formázás-gombok némán nem csináltak semmit. A TÍPUS alapján kell eldönteni, nem a
  // property jelenléte alapján (a cast biztonságos, mert a listák pontosan a union tagjait
  // sorolják fel, amiken az adott mező ténylegesen létezik).
  const setAlign = (id: string, a: TextAlign) => patch(id, (x) => (ALIGN_TYPES.includes(x.type) ? { ...x, align: a } as ComposerBlock : x))
  const setBg = (id: string, bg: string | null) => patch(id, (x) => (BG_TYPES.includes(x.type) ? { ...x, bg } as ComposerBlock : x))
  const setColor = (id: string, color: string | null) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, color } as ComposerBlock : x))
  const setFontSize = (id: string, fontSize: number | undefined) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, fontSize } as ComposerBlock : x))
  const setLineHeight = (id: string, lineHeight: number | undefined) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, lineHeight } as ComposerBlock : x))
  /** Ugyanez oszlop-cella szöveg-tartalmára — a `columns` blokk `cols` tömbjének adott elemét
   *  frissíti, nem a blokkot magát (a blokk típusa `'columns'` marad). */
  const setCellAlign = (blockId: string, cellIndex: number, a: TextAlign) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, align: a } : cc)) } : x))
  const setCellColor = (blockId: string, cellIndex: number, color: string | null) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, color } : cc)) } : x))
  const setCellBg = (blockId: string, cellIndex: number, bg: string | null) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, bg } : cc)) } : x))

  const exec = (cmd: string) => document.execCommand(cmd, false)

  const focusedBlock = blocks.find((b) => b.id === focusedId)
  const setFocusedAlign = (a: TextAlign) => { if (focusedId) setAlign(focusedId, a) }
  const setFocusedBg = (bg: string | null) => { if (focusedId) setBg(focusedId, bg) }
  const setFocusedColor = (c: string | null) => { if (focusedId) setColor(focusedId, c) }
  const setFocusedFontSize = (n: number | undefined) => { if (focusedId) setFontSize(focusedId, n) }
  const setFocusedLineHeight = (n: number | undefined) => { if (focusedId) setLineHeight(focusedId, n) }

  // A "Formázás" sín-panel a fókuszált BLOKKOT szerkeszti — DE ha épp egy oszlop-cella van
  // fókuszban (`focusedCell`), a cella szöveg-tartalmát kell célozni, nem a körülötte lévő
  // `columns` blokkot (aminek önmagában nincs se igazítása, se színe). Ugyanaz a panel, más cél.
  const focusedCellData = focusedCell
    ? (() => {
        const parent = blocks.find((b) => b.id === focusedCell.blockId)
        const cell = parent?.type === 'columns' ? parent.cols[focusedCell.index] : null
        return cell?.type === 'text' ? cell : null
      })()
    : null
  const formatTarget = focusedCell
    ? {
        hasTarget: !!focusedCellData,
        supportsAlign: !!focusedCellData,
        supportsBg: !!focusedCellData,
        supportsColor: !!focusedCellData,
        supportsSize: false,
        currentAlign: (focusedCellData?.align || 'left') as TextAlign,
        currentBg: focusedCellData?.bg ?? null,
        currentColor: focusedCellData?.color ?? null,
        currentFontSize: undefined as number | undefined,
        currentLineHeight: undefined as number | undefined,
        onAlign: (a: TextAlign) => setCellAlign(focusedCell.blockId, focusedCell.index, a),
        onBg: (bg: string | null) => setCellBg(focusedCell.blockId, focusedCell.index, bg),
        onColor: (c: string | null) => setCellColor(focusedCell.blockId, focusedCell.index, c),
        onFontSize: () => {},
        onLineHeight: () => {},
      }
    : {
        hasTarget: !!focusedBlock,
        supportsAlign: !!focusedBlock && ALIGN_TYPES.includes(focusedBlock.type),
        supportsBg: !!focusedBlock && BG_TYPES.includes(focusedBlock.type),
        supportsColor: !!focusedBlock && TEXT_STYLE_TYPES.includes(focusedBlock.type),
        supportsSize: !!focusedBlock && TEXT_STYLE_TYPES.includes(focusedBlock.type),
        currentAlign: ((focusedBlock && 'align' in focusedBlock && focusedBlock.align) || 'left') as TextAlign,
        currentBg: (focusedBlock && 'bg' in focusedBlock ? focusedBlock.bg : null) ?? null,
        currentColor: (focusedBlock && 'color' in focusedBlock ? focusedBlock.color : null) ?? null,
        currentFontSize: focusedBlock && 'fontSize' in focusedBlock ? focusedBlock.fontSize : undefined,
        currentLineHeight: focusedBlock && 'lineHeight' in focusedBlock ? focusedBlock.lineHeight : undefined,
        onAlign: setFocusedAlign,
        onBg: setFocusedBg,
        onColor: setFocusedColor,
        onFontSize: setFocusedFontSize,
        onLineHeight: setFocusedLineHeight,
      }

  return (
    <div className="flex gap-3" style={{ minHeight }}>
      {/* Lebegő fekete ikon-sín — desktopon (`lg:`) `absolute`-ba vált, ami a legközelebbi
          POZICIONÁLT ősre (a szélesebb kártyára, ld. NewsletterManager `composerRef` `relative`
          osztálya) tapad, NEM erre a keskeny tartalom-oszlopra — így pont a kártya saját
          `px-6 sm:px-8` szegélyéhez igazodik. Ehhez ennek a konténernek NEM szabad `relative`-nek
          lennie. (Egy scroll-követő `sticky` verzió próbaként megvolt, de nem sikerült
          megbízhatóan élesíteni — visszaállítva erre, a korábban működő állapotra.) */}
      <div className={cn(
        'sticky top-1/2 z-30 flex h-fit shrink-0 -translate-y-1/2 flex-col gap-1 rounded-full bg-ink-dark p-1.5',
        railMode === 'floating' && 'lg:absolute lg:left-8',
      )}>
        {RAIL_GROUPS.map((g) => (
          <div key={g.key} className="relative">
            <motion.button
              type="button"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              whileTap="hover"
              onClick={() => setOpenMenu((m) => (m === g.key ? null : g.key))}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors', openMenu === g.key ? 'bg-white/15' : 'hover:bg-white/10')}
              title={g.title}
            >
              <g.icon className="h-4 w-4" strokeWidth={1.8} />
            </motion.button>
            <AnimatePresence>
              {openMenu === g.key && <RailFlyout items={g.items} onPick={insert} align={g.key === 'layout' ? 'bottom' : 'top'} />}
            </AnimatePresence>
          </div>
        ))}
        <div className="relative">
          <motion.button
            type="button"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            onClick={() => setOpenMenu((m) => (m === 'format' ? null : 'format'))}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors', openMenu === 'format' ? 'bg-white/15' : 'hover:bg-white/10')}
            title="Formázás"
          >
            <AlignLeft className="h-4 w-4" strokeWidth={1.8} />
          </motion.button>
          <AnimatePresence>
            {openMenu === 'format' && <FormatFlyout {...formatTarget} align="bottom" />}
          </AnimatePresence>
        </div>
      </div>

      {openMenu && <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />}

      {/* A blokkok — húzható-átrendezhető lista (`Reorder`), a fogópont a `BlockRow` bal
          szélén indítja a húzást. */}
      <Reorder.Group as="div" axis="y" values={blocks} onReorder={onChange} ref={containerRef} className="min-w-0 flex-1 space-y-1">
        {blocks.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-soft2">Adj hozzá egy blokkot a bal oldali menüből…</p>
        )}
        {blocks.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            isFocused={focusedId === b.id}
            focusedCellIndex={focusedCell?.blockId === b.id ? focusedCell.index : null}
            onFocusBlock={() => { setFocusedId(b.id); if (b.type !== 'columns') setFocusedCell(null) }}
            onFocusCell={(index) => { setFocusedCell({ blockId: b.id, index }); setFocusedId(b.id) }}
            remove={remove}
            patch={patch}
            updateHtml={updateHtml}
            updateButton={updateButton}
          />
        ))}
      </Reorder.Group>

      {/* Kijelölés-eszköztár — szöveget kijelölve/duplán kattintva jelenik meg fölötte, mint a
          referenciában: típus-váltó + igazítás + inline formázás. */}
      {bubble && (() => {
        const block = blocks.find((b) => b.id === bubble.blockId)
        if (!block) return null
        // Oszlop-cella szövege: a blokk maga `'columns'` típusú (nem szöveg-szerű), a TÉNYLEGES
        // kijelölt tartalom a `bubble.cellIndex`-edik cellában van — külön ágon kezeljük, mert a
        // cellának nincs típus-váltója (nem `title`/`heading` stb.), csak igazítás+inline formázás.
        const isCell = block.type === 'columns' && bubble.cellIndex !== undefined
        const cell = isCell ? (block as Extract<ComposerBlock, { type: 'columns' }>).cols[bubble.cellIndex!] : null
        if (isCell && (!cell || cell.type !== 'text')) return null
        if (!isCell && !TEXT_TYPE_OPTIONS.includes(block.type as typeof TEXT_TYPE_OPTIONS[number])) return null
        const currentAlign: TextAlign = isCell
          ? (cell as Extract<ColumnCell, { type: 'text' }>).align || 'left'
          : ('align' in block && block.align) || 'left'
        const applyAlign = (a: TextAlign) => (isCell ? setCellAlign(block.id, bubble.cellIndex!, a) : setAlign(block.id, a))
        // Portál a body-ra: a `fixed` pozíció csak akkor számol helyesen viewport-koordinátákkal
        // (`getBoundingClientRect()`), ha NINCS `transform`-os ős (pl. egy animált beállítás-panel
        // `motion.div`-je) — az ilyen ős a `fixed` elemet saját magához "fixálja", ami a
        // beállítások-oldalon eltolt/túllógó eszköztárat okozott. Ugyanaz a minta, mint a
        // teljes-képernyős blur-modaloknál (ld. overlay-portál).
        return createPortal(
          <div
            className="fixed z-40 flex items-center gap-1 rounded-2xl bg-ink-dark p-1.5 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]"
            style={{ top: bubble.top, left: bubble.left, transform: 'translate(-50%, calc(-100% - 8px))' }}
          >
            {!isCell && (
              <>
                <div className="relative">
                  <select
                    value={block.type}
                    onChange={(e) => updateType(block.id, e.target.value as typeof TEXT_TYPE_OPTIONS[number])}
                    className="cursor-pointer appearance-none rounded-[10px] bg-white/10 py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-white outline-none"
                  >
                    {TEXT_TYPE_OPTIONS.map((t) => <option key={t} value={t} className="text-ink">{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <span className="mx-0.5 h-4 w-px bg-white/20" />
              </>
            )}
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyAlign(a)}
                className={cn('flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white', currentAlign === a && 'bg-white/15 text-white')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3.5 w-3.5" /> : a === 'center' ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
              </motion.button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => { const url = window.prompt('Link URL-je:'); if (url) document.execCommand('createLink', false, url) }} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Link"><Link2 className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Félkövér"><Bold className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Dőlt"><Italic className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Aláhúzott"><Underline className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Áthúzott"><Strikethrough className="h-3.5 w-3.5" /></motion.button>
          </div>,
          document.body,
        )
      })()}
    </div>
  )
}
