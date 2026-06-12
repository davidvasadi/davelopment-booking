'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft, Calendar, User as UserIcon, Store, CreditCard, type LucideIcon } from 'lucide-react'
import { getNavConfig, type DashboardVariant } from './navConfig'
import type { SearchHit } from '@/app/api/search/route'

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
    window.addEventListener('schedulio:open-command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('schedulio:open-command', onOpen)
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
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:bg-zinc-900 dark:border-white/[0.08] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, all.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (all[active]) go(all[active].href) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      >
        <div className="flex items-center gap-3 px-4 border-b border-zinc-100 dark:border-white/[0.06]">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isBackstage ? 'Keresés oldalakra, helyekre (szalon/étterem)…' : 'Keresés oldalakra, foglalásokra, vendégekre…'}
            className="flex-1 h-12 bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-zinc-200 dark:border-white/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto overscroll-contain py-2" data-lenis-prevent>
          {all.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-white/30">
              {query.trim().length < 2 ? 'Kezdj el gépelni a kereséshez…' : 'Nincs találat.'}
            </p>
          ) : (
            <>
              {navCmds.length > 0 && <p className="px-4 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/25">Oldalak</p>}
              {navCmds.map((c) => <Row key={c.id} cmd={c} active={all[active]?.id === c.id} onClick={() => go(c.href)} />)}
              {resultCmds.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/25">{resultGroupLabel}</p>}
              {resultCmds.map((c) => <Row key={c.id} cmd={c} active={all[active]?.id === c.id} onClick={() => go(c.href)} />)}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Row({ cmd, active, onClick }: { cmd: Cmd; active: boolean; onClick: () => void }) {
  const { icon: Icon, label, sub } = cmd
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-zinc-100 dark:bg-white/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.04]'}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{label}</span>
        {sub && <span className="block truncate text-xs text-zinc-400 dark:text-white/30">{sub}</span>}
      </span>
      {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-white/20" />}
    </button>
  )
}
