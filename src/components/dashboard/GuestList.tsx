import { type Guest, TIER_LABEL, flagEmoji, monogram } from '@/lib/guests'

/** Törzsvendég-szint badge (1 Új / 2 Visszatérő / 3 Törzsvendég). */
export function TierBadge({ tier }: { tier: Guest['tier'] }) {
  const styles: Record<number, string> = {
    1: 'bg-[#F4F0E2] text-ink-soft2',
    2: 'border border-line-strong text-ink-soft2',
    3: 'bg-gold text-ink-dark',
  }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tier]}`}>
      {TIER_LABEL[tier]}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Avatar-monogram gold-halvány háttérrel. */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFE9D6] text-[13px] font-semibold text-ink">
      {monogram(name)}
    </span>
  )
}

/** „Legutóbbi vendégek" lista (bento jobb oldal). showCountry: étterem. */
export function GuestList({ guests, showCountry }: { guests: Guest[]; showCountry: boolean }) {
  if (guests.length === 0) {
    return <div className="flex flex-1 items-center justify-center py-10 text-sm text-ink-soft">Még nincs vendég</div>
  }
  return (
    <div className="flex-1 divide-y divide-line">
      {guests.map((g) => (
        <div key={g.key} className="flex items-center gap-3 py-3">
          <Avatar name={g.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{g.name}</p>
            <p className="truncate text-xs text-ink-soft">
              {fmtDate(g.lastVisit)}
              {showCountry && g.country ? ` · ${flagEmoji(g.country)} ${g.country}` : ''}
            </p>
          </div>
          <TierBadge tier={g.tier} />
        </div>
      ))}
    </div>
  )
}
