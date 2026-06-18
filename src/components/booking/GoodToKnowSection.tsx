import type { LucideIcon } from 'lucide-react'
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
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">{t(locale, 'goodToKnow.eyebrow')}</p>
      <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">{t(locale, 'goodToKnow.title')}</h2>
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
    <div className="rounded-2xl px-4 py-4 bg-white/70 backdrop-blur-md ring-1 ring-zinc-900/5 shadow-sm">
      <div className="h-9 w-9 rounded-full bg-zinc-950 flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-white" />
      </div>
      {title && <p className="font-black text-zinc-900 text-sm leading-tight">{title}</p>}
      {body && <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line">{body}</p>}
    </div>
  )
}
