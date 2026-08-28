'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const MIN_ZOOM = 1
const MAX_ZOOM = 3

/**
 * Borítókép crop-szerkesztő — az Instagram/Facebook-féle "húzd és nagyítsd" mintát követi: EGY
 * kereten belül húzhatod a képet, és egy csúszkával nagyíthatsz rá, ha a lényeg csak a kép egy
 * kis részén van. A mentett pozíció (0-100%) + nagyítás mindenhol ugyanazzal a CSS-sel
 * (object-position + transform: scale) alkalmazódik, ahol a borítókép megjelenik.
 */
export function CoverFocalPointEditor({
  imageUrl, initialX = 50, initialY = 50, initialZoom = 1, onSave, onCancel,
}: {
  imageUrl: string
  initialX?: number
  initialY?: number
  initialZoom?: number
  /** Ténylegesen menti a szerverre (a hívó azonnal PATCH-eli a pozíciót/nagyítást) — a modal a
   *  Promise teljesüléséig pörgő ikonnal jelzi, hogy tényleg történik valami, nem csak becsukja
   *  magát látszat-visszajelzés nélkül. */
  onSave: (x: number, y: number, zoom: number) => Promise<boolean> | boolean
  onCancel: () => void
}) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })
  const [zoom, setZoom] = useState(clamp(initialZoom, MIN_ZOOM, MAX_ZOOM))
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null)
  const dragStartRef = useRef({ px: 0, py: 0, x: initialX, y: initialY })

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    dragStartRef.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !frameRef.current || !naturalSizeRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    // A kép a kereten BELÜL "cover"-rel tölt ki, PLUSZ a nagyítás — az így kapott tényleges
    // megjelenített méretből számoljuk, mennyi "túllógás" van, amin belül húzható a pozíció.
    const coverScale = Math.max(rect.width / naturalSizeRef.current.w, rect.height / naturalSizeRef.current.h)
    const scale = coverScale * zoom
    const overflowX = Math.max(naturalSizeRef.current.w * scale - rect.width, 1)
    const overflowY = Math.max(naturalSizeRef.current.h * scale - rect.height, 1)
    const dx = e.clientX - dragStartRef.current.px
    const dy = e.clientY - dragStartRef.current.py
    // Húzás jobbra → a képből a BAL oldal látszódjon jobban → x% csökken (közvetlen "megfogom
    // és arrébb tolom" érzés, nem a nézőablak, hanem a kép mozog a kéz alatt).
    setPos({
      x: clamp(dragStartRef.current.x - (dx / overflowX) * 100, 0, 100),
      y: clamp(dragStartRef.current.y - (dy / overflowY) * 100, 0, 100),
    })
  }

  const handlePointerUp = () => setDragging(false)

  const objectPosition = `${pos.x}% ${pos.y}%`

  const handleSave = async () => {
    setSaving(true)
    try {
      const ok = await onSave(pos.x, pos.y, zoom)
      if (!ok) setSaving(false)
    } catch {
      setSaving(false)
    }
  }

  // Portálban a body-ra, ne a beállítás-form belsejében — különben a form saját lebegő
  // mentés-sávja (más stacking context) a modal FÖLÉ kerülhet.
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-semibold text-ink">Borítókép beállítása</p>

        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative aspect-[16/9] w-full touch-none select-none overflow-hidden rounded-xl bg-line-strong"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={(img) => {
              // A kép jó eséllyel MÁR a böngésző cache-éből jön (ugyanaz az URL, mint az
              // előnézeté) — ilyenkor `onLoad` nem mindig sül el újra, ezért itt, a mountoláskor
              // is ellenőrizzük a `complete`/`naturalWidth`-et, hogy a húzás ne ragadjon be.
              if (img && img.complete && img.naturalWidth > 0) {
                naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight }
              }
            }}
            src={imageUrl}
            alt=""
            draggable={false}
            onLoad={(e) => { naturalSizeRef.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight } }}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition, transform: `scale(${zoom})`, transformOrigin: objectPosition }}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-ink-soft2" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line-strong accent-ink-dark"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-ink-soft2" />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-soft2">Húzd a képet a pozícióhoz, a csúszkával nagyíthatsz rá.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-soft hover:bg-paper disabled:opacity-40">
            <X className="h-3.5 w-3.5" /> Mégse
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex min-w-[110px] items-center justify-center gap-1.5 rounded-full bg-ink-dark px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-70">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
