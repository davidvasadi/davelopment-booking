'use client'

import { useState } from 'react'
import { type Guest, flagEmoji, monogram } from '@/lib/guests'
import { TierBadge } from './GuestList'

/** Vendég-táblázat (Crextio People/Salary stílus). Kiválasztott sor gold highlight.
 *  variant: 'restaurant' mutatja az Ország + Pax oszlopot, 'salon' nem. */
export function GuestTable({ guests, variant }: { guests: Guest[]; variant: 'restaurant' | 'salon' }) {
  const [selected, setSelected] = useState<string | null>(null)
  const showCountry = variant === 'restaurant'

  function fmtDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (guests.length === 0) {
    return <div className="py-12 text-center text-sm text-ink-soft">Még nincs vendég</div>
  }

  return (
    <div className="overflow-hidden">
      {/* Desktop / tablet: valódi táblázat */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
              <th className="px-4 py-3 font-semibold">Név</th>
              <th className="px-4 py-3 font-semibold">Kapcsolat</th>
              <th className="px-4 py-3 font-semibold text-center">Látogatások</th>
              {showCountry && <th className="px-4 py-3 font-semibold text-center">Fő</th>}
              <th className="px-4 py-3 font-semibold">Utolsó</th>
              {showCountry && <th className="px-4 py-3 font-semibold">Ország</th>}
              <th className="px-4 py-3 font-semibold">Szint</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => {
              const isSel = selected === g.key
              return (
                <tr
                  key={g.key}
                  onClick={() => setSelected(isSel ? null : g.key)}
                  className={`cursor-pointer rounded-[16px] transition-colors ${
                    isSel ? 'bg-gold/25' : 'hover:bg-[#F6F2E4]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFE9D6] text-[12px] font-semibold text-ink">
                        {monogram(g.name)}
                      </span>
                      <span className="text-sm font-semibold text-ink">{g.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-ink-soft2">{g.email ?? '—'}</div>
                    {g.phone && <div className="text-xs text-ink-soft">{g.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-ink">{g.visits}</td>
                  {showCountry && <td className="px-4 py-3 text-center text-sm text-ink-soft2">{g.totalPax || '—'}</td>}
                  <td className="px-4 py-3 text-[13px] text-ink-soft2">{fmtDate(g.lastVisit)}</td>
                  {showCountry && (
                    <td className="px-4 py-3 text-[13px] text-ink-soft2">
                      {g.country ? `${flagEmoji(g.country)} ${g.country}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3"><TierBadge tier={g.tier} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobil: kártyák (stack) */}
      <div className="space-y-2.5 md:hidden">
        {guests.map((g) => {
          const isSel = selected === g.key
          return (
            <button
              key={g.key}
              onClick={() => setSelected(isSel ? null : g.key)}
              className={`flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-colors ${
                isSel ? 'border-gold bg-gold/20' : 'border-line bg-white hover:bg-[#F6F2E4]'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFE9D6] text-[13px] font-semibold text-ink">
                {monogram(g.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{g.name}</p>
                <p className="truncate text-xs text-ink-soft">
                  {g.visits} látogatás
                  {showCountry && g.country ? ` · ${flagEmoji(g.country)} ${g.country}` : ''}
                </p>
              </div>
              <TierBadge tier={g.tier} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
