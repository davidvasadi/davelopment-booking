'use client'

import { useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button, IconButton, Panel } from '@/components/ui-kit'
import { useExclusivePopover } from '@/lib/exclusivePopover'

/**
 * Szűrő-gomb a lista-eszköztárakhoz (mint a Foglalások / Naptár szűrője): az ikonra nyíló fehér panel, fent „Szűrők”
 * címmel és a piros „Törlés”-sel (`onReset`), alatta a szűrők (`children`). Aktív szűrőnél pötty (`dot`). A panel arra
 * az oldalra nyílik, ahol elfér; egyszerre csak egy lenyíló van nyitva.
 */
export function FilterPopover({ dot = false, onReset, children }: { dot?: boolean; onReset?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(true)
  const anchor = useRef<HTMLSpanElement>(null)
  useExclusivePopover(open, () => setOpen(false))
  return (
    <span ref={anchor} className="relative flex">
      <IconButton icon={Settings2} label="Szűrők" dot={dot} aria-expanded={open}
        onClick={() => { const r = anchor.current?.getBoundingClientRect(); setLeft(!r || r.left + 360 < window.innerWidth); setOpen((v) => !v) }} />
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <Panel className={`ui-pop-in absolute top-full z-50 mt-2 w-[340px] ${left ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-ui-title font-light text-ui-text">Szűrők</span>
              {onReset && <Button variant="danger" size="sm" onClick={onReset}>Törlés</Button>}
            </div>
            {children}
          </Panel>
        </>
      )}
    </span>
  )
}
