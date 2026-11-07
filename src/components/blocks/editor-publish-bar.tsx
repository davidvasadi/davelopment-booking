'use client'

import { useState } from 'react'
import { Languages, Redo2, Undo2, X } from 'lucide-react'
import { Button, IconButton, Menu, MenuItem, Pill } from '@/components/ui-kit'

/** A szerkesztő alsó sávja: visszavonás / újra, nyelvek, módosítások száma, Közzététel. Élőben `onUndo` / `onRedo`
 *  (`canUndo` / `canRedo`), `langs` + `onLang` (a szerkesztett nyelv), `changes`, `onPublish` (`busy`). */
export function EditorPublishBar({ compact = false, onClose, onUndo, onRedo, canUndo = true, canRedo = false, langs = [{ code: 'hu', active: true }, { code: 'en', active: false }, { code: 'de', active: false }], onLang, changes = 3, onPublish, busy = false, publishLabel = 'Közzététel' }: {
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean
  langs?: { code: string; active: boolean }[]; onLang?: (code: string) => void
  changes?: number; onPublish?: () => void; busy?: boolean; publishLabel?: string
  /** keskeny kijelző: a módosítás-szám helyett mellette bezárás (X); kettőnél több nyelvnél egy nyelv-ikon menü */
  compact?: boolean; onClose?: () => void
}) {
  const [langOpen, setLangOpen] = useState(false)
  const active = langs.find((l) => l.active)
  const langMenu = compact && langs.length > 2
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ui-dark p-1.5 text-white shadow-ui-float">
      <IconButton icon={Undo2} label="Visszavonás" size="sm" variant="ghostDark" onClick={onUndo} disabled={!canUndo} className="disabled:opacity-40" />
      <IconButton icon={Redo2} label="Újra" size="sm" variant="ghostDark" onClick={onRedo} disabled={!canRedo} className="disabled:opacity-40" />
      {langMenu && <>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
        <span className="relative shrink-0">
          <button type="button" onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen} className="ui-press rounded-full"><Pill tone="onDark" icon={Languages}>{active?.code.toUpperCase()}</Pill></button>
          {langOpen && <>
            <span className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} aria-hidden />
            <Menu className="absolute bottom-full left-0 z-20 mb-2 w-40">
              {langs.map((l) => <MenuItem key={l.code} active={l.active} onClick={() => { setLangOpen(false); onLang?.(l.code) }}>{l.code.toUpperCase()}</MenuItem>)}
            </Menu>
          </>}
        </span>
      </>}
      {!langMenu && langs.length > 1 && <>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
        {langs.map((l) => onLang
          ? <button key={l.code} type="button" onClick={() => onLang(l.code)} aria-pressed={l.active} className="ui-press shrink-0 rounded-full"><Pill tone={l.active ? 'onDark' : 'ghostDark'}>{l.code.toUpperCase()}</Pill></button>
          : <Pill key={l.code} tone={l.active ? 'onDark' : 'ghostDark'}>{l.code.toUpperCase()}</Pill>)}
      </>}
      <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
      {!compact && <span className="mr-1 shrink-0 text-ui-meta text-white/55">{changes ? `${changes} módosítás` : 'Nincs módosítás'}</span>}
      <Button variant="yellow" onClick={onPublish} loading={busy} disabled={!changes} className="shrink-0">{publishLabel}</Button>
      {compact && <IconButton icon={X} label="Bezárás" size="sm" variant="ghostDark" onClick={onClose} className="shrink-0" />}
    </div>
  )
}
