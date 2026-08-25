'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Loader2, Megaphone, Send, Search, Check } from 'lucide-react'

const TARGETS = [
  { value: 'all' as const, label: 'Mindenki', desc: 'Minden szalon és étterem tulajdonosa' },
  { value: 'paying' as const, label: 'Csak fizetők', desc: 'Aktív, fizető előfizetéssel rendelkezők' },
  { value: 'trial' as const, label: 'Csak próbaidősök', desc: 'Jelenleg próbaidőn lévők' },
  { value: 'custom' as const, label: 'Egyedi kiválasztás', desc: 'Konkrét fiókok kiválasztva' },
]

type AccountLite = { ownerId: string; name: string; email: string; breakdown: string | null }

export default function BroadcastForm() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<'all' | 'paying' | 'trial' | 'custom'>('all')
  const [armed, setArmed] = useState(false)
  const [sending, setSending] = useState(false)

  const [accounts, setAccounts] = useState<AccountLite[] | null>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (target !== 'custom' || accounts !== null || loadingAccounts) return
    setLoadingAccounts(true)
    fetch('/api/backstage/accounts-lite')
      .then(r => r.json())
      .then(d => setAccounts(d.accounts ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false))
  }, [target, accounts, loadingAccounts])

  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.breakdown?.toLowerCase().includes(q))
  }, [accounts, search])

  function toggle(ownerId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(ownerId)) next.delete(ownerId); else next.add(ownerId)
      return next
    })
    setArmed(false)
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (target !== 'custom' || selected.size > 0)

  async function send() {
    if (!canSend) return
    if (!armed) { setArmed(true); return }

    setSending(true)
    try {
      const res = await fetch('/api/backstage/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, target, ownerIds: target === 'custom' ? Array.from(selected) : undefined }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`Elküldve ${data.sent} helynek.`)
      setTitle('')
      setBody('')
      setSelected(new Set())
      setArmed(false)
    } catch {
      toast.error('A küldés nem sikerült.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-[26px] p-6 dav-card-glass max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Cím</label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setArmed(false) }}
            placeholder="Pl. Új funkció: ajándékutalványok"
            className="mt-1.5 h-11 w-full rounded-[14px] border border-line bg-white px-4 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:border-line-strong focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Üzenet</label>
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value); setArmed(false) }}
            rows={4}
            placeholder="Rövid, konkrét szöveg — ez jelenik meg a harangban."
            className="mt-1.5 w-full resize-none rounded-[16px] border border-line bg-white px-4 py-3 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:border-line-strong focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft mb-2 block">Kinek</label>
          <div className="flex flex-col gap-2">
            {TARGETS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setTarget(t.value); setArmed(false) }}
                className={`flex items-center justify-between rounded-[16px] border px-4 py-2.5 text-left transition-colors ${
                  target === t.value ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'
                }`}
              >
                <span>
                  <span className="block text-[13px] font-semibold">{t.label}</span>
                  <span className={`block text-[11.5px] ${target === t.value ? 'text-white/60' : 'text-ink-soft'}`}>{t.desc}</span>
                </span>
                {t.value === 'custom' && selected.size > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${target === t.value ? 'bg-white/15 text-white' : 'bg-paper text-ink-soft'}`}>
                    {selected.size} kiválasztva
                  </span>
                )}
              </button>
            ))}
          </div>

          {target === 'custom' && (
            <div className="mt-3 rounded-[16px] border border-line bg-white p-3">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Keresés név, email vagy üzlet szerint..."
                  className="h-9 w-full rounded-[12px] border border-line bg-paper pl-9 pr-3 text-[12.5px] text-ink placeholder:text-ink-soft2 focus:border-line-strong focus:outline-none"
                />
              </div>
              <div className="max-h-64 overflow-y-auto" data-lenis-prevent>
                {loadingAccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-ink-soft">Nincs találat.</p>
                ) : (
                  filteredAccounts.map(a => {
                    const isSelected = selected.has(a.ownerId)
                    return (
                      <button
                        key={a.ownerId}
                        type="button"
                        onClick={() => toggle(a.ownerId)}
                        className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-2.5 py-2 text-left transition-colors ${isSelected ? 'bg-paper' : 'hover:bg-paper/60'}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-ink">{a.name}</span>
                          <span className="block truncate text-[11px] text-ink-soft">{a.breakdown || a.email}</span>
                        </span>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={!canSend || sending}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-[22px] px-5 py-3 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 ${
          armed ? 'bg-[#C0564A]' : 'bg-ink-dark'
        }`}
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : armed ? (
          <><Megaphone className="h-4 w-4" /> Biztos? Kattints még egyszer</>
        ) : (
          <><Send className="h-4 w-4" /> Üzenet küldése</>
        )}
      </button>
    </div>
  )
}
