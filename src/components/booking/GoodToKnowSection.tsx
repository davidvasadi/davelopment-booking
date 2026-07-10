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
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gold/15">
          <Info className="h-5 w-5 text-ink" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t(locale, 'goodToKnow.eyebrow')}</p>
          <h2 className="text-[24px] font-light leading-tight tracking-[-0.01em] text-ink">{t(locale, 'goodToKnow.title')}</h2>
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
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-dark">
        <Icon className="h-4 w-4 text-white" />
      </div>
      {title && <p className="text-[14px] font-semibold leading-tight text-ink">{title}</p>}
      {body && <p className="mt-0.5 whitespace-pre-line text-[12px] text-ink-soft">{body}</p>}
    </div>
  )
}
