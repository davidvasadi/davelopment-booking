'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Input } from '@/components/ui-kit'

/**
 * Saját szín választása (a foglalóoldal-szerkesztő minta-körei mellé): a „+” kör egy kis fehér panelt nyit — színmező
 * (telítettség × világosság), alatta a színárnyalat-csúszka, a hex-kód mező és a Kész gomb. A böngésző saját
 * színválasztója helyett, a kit stílusában. A szín húzás közben csak a panelen változik; a Kész (vagy Enter) adja át.
 */
const HEX = /^#[0-9a-f]{6}$/i

type Hsv = { h: number; s: number; v: number }
function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}
function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)) }
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}
const clamp = (x: number) => Math.max(0, Math.min(1, x))

export function ColorPicker({ value, onChange, align = 'right', label = 'Saját szín' }: { value: string | null; onChange: (hex: string) => void; align?: 'left' | 'right'; label?: string }) {
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<Hsv>(hexToHsv(value && HEX.test(value) ? value : '#2F5D50')) // ui-allow: kezdő szín, ha még nincs saját
  const [hex, setHex] = useState(value ?? '')
  const area = useRef<HTMLDivElement>(null)
  const hue = useRef<HTMLDivElement>(null)
  const cur = hsvToHex(hsv)
  const setFrom = (next: Hsv) => { setHsv(next); setHex(hsvToHex(next)) }
  // húzás a színmezőn / a csúszkán (egér és érintés is)
  const drag = (ref: React.RefObject<HTMLDivElement | null>, apply: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const at = (ev: { clientX: number; clientY: number }) => { const r = el.getBoundingClientRect(); apply(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height)) }
    at(e)
    const move = (ev: PointerEvent) => at(ev)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const typed = (hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`).toUpperCase()
  const done = () => { onChange(cur); setOpen(false) }
  return (
    <span className="relative">
      <button type="button" title={label} aria-label={label} aria-expanded={open}
        onClick={() => { if (!open && value && HEX.test(value)) { setHsv(hexToHsv(value)); setHex(value) } setOpen((v) => !v) }}
        className="ui-press relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-dashed border-ui-dark/30 text-ui-muted"> {/* ui-allow: szaggatott „saját szín” kör, a minták méretében */}
        {value ? <span className="absolute inset-0" style={{ background: value }} /> : <Plus className="h-3.5 w-3.5" />} {/* ui-allow: a kör maga a választott szín */}
      </button>
      {open && <>
        <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
        <div className={`ui-pop-in absolute top-full z-50 mt-2 w-[240px] rounded-ui-card bg-white p-3 shadow-ui-popup ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {/* színmező: balra fehér → jobbra a tiszta árnyalat; lefelé sötétedik */}
          <div ref={area} onPointerDown={drag(area, (x, y) => setFrom({ ...hsv, s: x, v: 1 - y }))}
            className="relative h-[130px] w-full cursor-crosshair touch-none overflow-hidden rounded-ui-control"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}> {/* ui-allow: a színmező maga a szín */}
            <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-1 ring-ui-dark/30" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: cur }} /> {/* ui-allow: a választott pont */}
          </div>
          {/* színárnyalat-csúszka */}
          <div ref={hue} onPointerDown={drag(hue, (x) => setFrom({ ...hsv, h: x * 360 }))}
            className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}> {/* ui-allow: a színkör sávja */}
            <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-1 ring-ui-dark/30" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} /> {/* ui-allow: a csúszka gombja */}
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-dashed border-ui-divider pt-3">
            <span className="h-7 w-7 shrink-0 rounded-full ring-1 ring-ui-divider" style={{ background: cur }} /> {/* ui-allow: a választott szín előnézete */}
            <Input size="sm" value={hex} placeholder="#RRGGBB" maxLength={7}
              onChange={(e) => { setHex(e.target.value); const t = (e.target.value.trim().startsWith('#') ? e.target.value.trim() : `#${e.target.value.trim()}`); if (HEX.test(t)) setHsv(hexToHsv(t)) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && HEX.test(typed)) done() }} className="min-w-0 flex-1 uppercase" />
            <Button size="sm" onClick={done}>Kész</Button>
          </div>
        </div>
      </>}
    </span>
  )
}
