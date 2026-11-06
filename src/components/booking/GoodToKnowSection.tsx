import { Info, type LucideIcon } from 'lucide-react'
import { iconByKey } from '@/components/settings/goodToKnowIcons'
import { t, type Locale } from '@/lib/i18n'

type Item = { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }

/**
 * Publikus „Jó tudni" szekció — a szalon ÉS az étterem foglaló-oldal is ezt használja.
 * Csak a host által megadott pontok; üresnél semmit nem renderel. A pontok címe/szövege a
 * Payload-localized mezőkből már a megfelelő nyelven érkezik — itt csak a fix keret i18n.
 */
export function GoodToKnowSection({ items, locale = 'hu' }: { items?: Item[] | null; locale?: Locale }) {
  const filled = (items ?? []).filter((p) => p?.title || p?.body)
  if (filled.length === 0) return null

  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
          <Info className="h-5 w-5 text-ui-text" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ui-muted">{t(locale, 'goodToKnow.eyebrow')}</p>
          <h2 className="text-[24px] font-light leading-tight tracking-[-0.01em] text-ui-text">{t(locale, 'goodToKnow.title')}</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filled.map((p, i) => (
          <GoodToKnowCard key={p?.id ?? i} icon={iconByKey(p?.icon)} title={p?.title ?? ''} body={p?.body ?? ''} />
        ))}
      </div>
    </section>
  )
}

/** Egységes „Jó tudni" csempe: kerek ikon-kör + cím + leírás. */
function GoodToKnowCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-[16px] bg-white/40 px-4 py-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ui-dark">
        <Icon className="h-4 w-4 text-white" />
      </div>
      {title && <p className="text-[14px] font-semibold leading-tight text-ui-text">{title}</p>}
      {body && <p className="mt-0.5 whitespace-pre-line text-[12px] text-ui-muted">{body}</p>}
    </div>
  )
}

/**
 * Kompakt, sötét „Jó tudni” blokk a foglalás Összegzés lépéséhez — KÖZÖS a szalon
 * (`ProfileCard`) és az étterem (`RestaurantBookingWizard`) foglalóján.
 */
export function GoodToKnowCompact({ items, locale = 'hu', className = '' }: { items?: Item[] | null; locale?: Locale; className?: string }) {
  const filled = (items ?? []).filter((p) => p?.title || p?.body)
  if (filled.length === 0) return null
  return (
    <div data-edit-id="gtk" className={`space-y-2.5 rounded-2xl p-4 ${className}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
      <div className="mb-1 flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-white/40" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{t(locale, 'goodToKnow.title')}</p>
      </div>
      {filled.map((p, i) => {
        const Icon = iconByKey(p?.icon)
        return (
          <div key={p?.id ?? i} className="flex gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.12]">
              <Icon className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0">
              {p?.title && <p className="text-[12px] font-semibold text-white">{p.title}</p>}
              {p?.body && <p className="text-[11px] text-white/55">{p.body}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
