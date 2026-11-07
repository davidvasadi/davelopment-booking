'use client'

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Bold, Check, Italic, Link2, Plus, Settings } from 'lucide-react'
import { Button, Input, Pill } from '@/components/ui-kit'
import { EditorQuickBar, QuickColor, QuickTool } from '@/components/blocks/editor'
import { postToEditor, type BarTool } from '@/lib/editorBridge'
import { formatSelection } from './EditableText'
import { ColorPicker } from '@/components/blocks/color-picker'

const ICONS = { up: ArrowUp, down: ArrowDown, settings: Settings, bold: Bold, italic: Italic } as const

/**
 * A kijelölt elem gyors-sávja az előnézetben (design 21.6.3): elöl a neve, utána az eszközei (amit a szerkesztő küld),
 * a végén az X. A formázó gombok nem veszik el a fókuszt a szövegtől (mousedown-nál megállítjuk), a link egy kis mezőt
 * nyit a sávban; a szín pöttye a sáv alatt a választható színeket.
 */
export function PreviewQuickBar({ id, label, tools }: { id: string; label: string; tools: BarTool[] }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('https://')
  const [colorOpen, setColorOpen] = useState(false)
  const range = useRef<Range | null>(null)
  const act = (action: string, value?: string | null) => postToEditor({ type: 'action', id, action, value })
  const keep = (e: React.MouseEvent) => e.preventDefault() // a szöveg kijelölése maradjon meg
  const color = tools.find((x): x is Extract<BarTool, { t: 'color' }> => x.t === 'color')
  // saját (hex) szín: nincs a minták közt — a pötty és a „+” kör ezt mutatja
  const custom = color?.value && color.value.startsWith('#') ? color.value : null
  const current = color?.options.find((o) => o.v === color.value) ?? (custom ? { v: custom, css: custom, label: 'Saját' } : color?.options[0])

  const applyLink = () => {
    const sel = window.getSelection()
    if (range.current && sel) { sel.removeAllRanges(); sel.addRange(range.current) }
    if (/^(https?:\/\/.+|mailto:.+|tel:.+)/i.test(url.trim())) formatSelection('link', url.trim())
    setLinkOpen(false); setUrl('https://')
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <EditorQuickBar name={label} onClose={() => postToEditor({ type: 'close' })}>
        {tools.map((x, i) => {
          if (x.t === 'format') return (
            <span key={i} className="flex shrink-0 items-center gap-1" onMouseDown={keep}>
              <QuickTool icon={Bold} label="Félkövér" onClick={() => formatSelection('bold')} />
              <QuickTool icon={Italic} label="Dőlt" onClick={() => formatSelection('italic')} />
              <QuickTool icon={Link2} label="Link" on={linkOpen} onClick={() => { const s = window.getSelection(); range.current = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; setLinkOpen((v) => !v) }} />
            </span>
          )
          if (x.t === 'color') return <span key={i} onMouseDown={keep}><QuickColor css={current?.css} onClick={() => setColorOpen((v) => !v)} /></span>
          if (x.t === 'toggle') return (
            <button key={i} type="button" onClick={() => act(x.action)} aria-pressed={x.on} className="ui-press shrink-0 rounded-full">
              <Pill tone={x.on ? 'white' : 'ghostDark'} size="sm">{x.on && <Check className="h-3 w-3" />}{x.label}</Pill>
            </button>
          )
          if (x.t === 'icon') return <QuickTool key={i} icon={ICONS[x.icon]} label={x.label} on={x.on} onClick={() => act(x.action)} />
          if (x.t === 'button') return <Button key={i} variant="yellow" size="sm" className="shrink-0" onClick={() => act(x.action)}>{x.label}</Button>
          return <span key={i} className="shrink-0 px-2 text-ui-meta text-white/80">{x.label}</span>
        })}
      </EditorQuickBar>
      {/* a link címe — a kijelölt szövegre kerül */}
      {linkOpen && (
        <div className="flex w-[280px] max-w-full items-center gap-1.5 rounded-full bg-white p-1.5 shadow-ui-popup">
          <Input size="sm" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }} className="min-w-0 flex-1" />
          <Button size="sm" onClick={applyLink}>Link</Button>
        </div>
      )}
      {/* a szöveg színe: csak olvasható színek (a szerkesztő küldi) */}
      {color && colorOpen && (
        <div className="flex items-center gap-3 rounded-ui-card bg-white p-3 shadow-ui-popup">
          {color.options.map((o) => (
            <button key={o.v} type="button" onClick={() => { act('color', o.v); setColorOpen(false) }} className="ui-press flex flex-col items-center gap-1 rounded-ui-control">
              <span className={`block h-7 w-7 rounded-full ${o.v === current?.v ? 'ring-2 ring-ui-dark ring-offset-2' : 'ring-1 ring-ui-divider'}`} style={{ background: o.css }} />
              <span className="text-ui-label text-ui-muted">{o.label}</span>
            </button>
          ))}
          {/* a választott saját szín (ha nincs a minták közt) */}
          {custom && !color.options.some((o) => o.v.toLowerCase() === custom.toLowerCase()) && (
            <span className="flex flex-col items-center gap-1"><span className="block h-7 w-7 rounded-full ring-2 ring-ui-dark ring-offset-2" style={{ background: custom }} /><span className="text-ui-label text-ui-muted">Saját</span></span>
          )}
          {/* saját szín — a kit színválasztója (a szerkesztő olvashatóra igazítja, ha kell) */}
          <span className="flex flex-col items-center gap-1">
            <ColorPicker value={null} align="left" onChange={(c) => { act('color', c); setColorOpen(false) }} />
            <span className="text-ui-label text-ui-muted">Új</span>
          </span>
        </div>
      )}
    </div>
  )
}
