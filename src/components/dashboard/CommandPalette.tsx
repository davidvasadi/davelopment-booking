'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft, Calendar, User as UserIcon, Store, CreditCard, type LucideIcon } from 'lucide-react'
import { getNavConfig, type DashboardVariant } from './navConfig'
import type { SearchHit } from '@/app/api/search/route'
import { Input, MenuItem, Meta, Panel, Pill, MarqueeText } from '@/components/ui-kit'

type Cmd = { id: string; label: string; sub?: string; href: string; icon: LucideIcon }

/**
 * ⌘K command-palette: nav-oldalak közti gyors ugrás ÉS élő foglalás/vendég keresés
 * (a /api/search végponton). Apple-szerű: középre tett, blur-hátterű panel, billentyűs
 * navigációval (↑/↓, Enter, Esc). A topbar keresőmező és a ⌘K is ezt nyitja.
 */
export function CommandPalette({ variant }: { variant: DashboardVariant }) {
  const router = useRouter()
  const { items: navItems } = getNavConfig(variant)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K bárhol megnyitja; egyedi esemény a topbar gombnak.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('davelopment:open-command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('davelopment:open-command', onOpen)
    }
  }, [])

  // Megnyitáskor üres állapot + fókusz.
  useEffect(() => {
    if (open) {
      setQuery('')
      setHits([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  // Debounce-olt keresés a foglalások/vendégek között.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setHits([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setHits(data.hits ?? [])
      } catch { /* csendben */ }
    }, 180)
    return () => clearTimeout(t)
  }, [query, open])

  // A szűrt nav-parancsok (mindig láthatók, ha a query illik a címre).
  const navCmds: Cmd[] = navItems
    .filter((n) => !query.trim() || n.label.toLowerCase().includes(query.trim().toLowerCase()))
    .map((n) => ({ id: `nav-${n.href}`, label: n.label, href: n.href, icon: n.icon }))

  const resultIcon = (kind: SearchHit['kind']): LucideIcon => {
    if (kind === 'place') return Store
    if (kind === 'subscription') return CreditCard
    if (kind === 'reservation' || kind === 'booking') return Calendar
    return UserIcon
  }
  const resultCmds: Cmd[] = hits.map((h) => ({
    id: `${h.kind}-${h.id}`,
    label: h.name,
    sub: h.sub,
    href: h.href,
    icon: resultIcon(h.kind),
  }))

  // Admin (backstage) kereső találatai „Helyek", a tulajoknál „Foglalások".
  const isBackstage = variant === 'backstage'
  const resultGroupLabel = isBackstage ? 'Helyek' : 'Foglalások'

  const all = [...navCmds, ...resultCmds]

  const go = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  useEffect(() => { setActive(0) }, [query, hits.length])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
      <Panel pad="none" size="md" className="relative overflow-hidden font-onest">
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, all.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (all[active]) go(all[active].href) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      >
        <div className="p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isBackstage ? 'Keresés oldalakra, helyekre (szalon/étterem)…' : 'Keresés oldalakra, foglalásokra, vendégekre…'}
              className="pl-10 sm:pr-16"
            />
            <Pill tone="white" size="sm" className="absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">Esc</Pill>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto overscroll-contain px-2 pb-2" data-lenis-prevent>
          {all.length === 0 ? (
            <Meta className="px-4 py-8 text-center">{query.trim().length < 2 ? 'Kezdj el gépelni a kereséshez…' : 'Nincs találat.'}</Meta>
          ) : (
            <>
              {navCmds.length > 0 && <Meta className="px-3 pb-1 pt-1">Oldalak</Meta>}
              {navCmds.map((c) => <Row key={c.id} cmd={c} active={all[active]?.id === c.id} onClick={() => go(c.href)} />)}
              {resultCmds.length > 0 && <Meta className="px-3 pb-1 pt-3">{resultGroupLabel}</Meta>}
              {resultCmds.map((c) => <Row key={c.id} cmd={c} active={all[active]?.id === c.id} onClick={() => go(c.href)} />)}
            </>
          )}
        </div>
      </div>
      </Panel>
    </div>,
    document.body,
  )
}

function Row({ cmd, active, onClick }: { cmd: Cmd; active: boolean; onClick: () => void }) {
  const { icon, label, sub } = cmd
  return (
    <MenuItem icon={icon} active={active} onClick={onClick} trailing={active && <CornerDownLeft className="h-3.5 w-3.5" />}>
      <MarqueeText>{label}</MarqueeText>
      {sub && <MarqueeText className="text-ui-meta text-ui-muted">{sub}</MarqueeText>}
    </MenuItem>
  )
}
