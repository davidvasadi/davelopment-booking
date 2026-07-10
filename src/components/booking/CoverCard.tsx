import type { ReactNode } from 'react'

/**
 * Publikus foglaló borítókép-kártya — 1:1 az Áttekintés profil-kártyájával:
 * teljes kitöltésű kép (object-cover), alul lágyan elmosott frosted glass sáv,
 * amin a név + egy státusz-chip olvasható. A kép PROMINENS (nem háttér-fátyol).
 */
export function CoverCard({
  imageUrl,
  fallbackInitials,
  title,
  subtitle,
  badge,
}: {
  imageUrl: string | null
  fallbackInitials: string
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div
      className="relative h-full min-h-[340px] w-full overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]"
      style={{ transform: 'translateZ(0)' }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#3a2f12] via-[#9A7B1E] to-[#F1CE45] text-[56px] font-semibold text-white/90">
          {fallbackInitials}
        </div>
      )}

      {/* Lágy sötét áttűnés alul (Crextio profil-kártya: a kép aljából nő ki a szöveg) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: 'linear-gradient(to top, rgba(20,16,10,.72) 0%, rgba(20,16,10,.34) 34%, transparent 78%)' }}
      />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0" style={{ textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>
            <div className="truncate text-[28px] font-light leading-[1.05] tracking-[-0.015em] text-white sm:text-[32px]">{title}</div>
            {subtitle && <div className="mt-1.5 truncate text-[13px] font-medium text-white/80">{subtitle}</div>}
          </div>
          {badge}
        </div>
      </div>
    </div>
  )
}

/** Frosted glass chip a borítón (pl. „Nyitva" / kapcsolat) — színtelen üveg-hatás. */
export function CoverChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="shrink-0 rounded-[14px] px-3 py-1.5 text-[12px] font-semibold text-white"
      style={{
        background: 'transparent',
        backdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
        WebkitBackdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
        textShadow: '0 1px 3px rgba(0,0,0,.45)',
      }}
    >
      {children}
    </span>
  )
}
