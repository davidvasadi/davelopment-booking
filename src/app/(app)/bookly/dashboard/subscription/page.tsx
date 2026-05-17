import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Subscription } from '@/payload/payload-types'
import Link from 'next/link'
import { CreditCard, CheckCircle2, Sparkles, Lock, Settings, ArrowRight } from 'lucide-react'

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Próbaidőszak',
  active: 'Aktív',
  past_due: 'Fizetési hiba',
  canceled: 'Megszűnt',
  paused: 'Szüneteltetett',
}

const STATUS_DOT: Record<string, string> = {
  trialing: 'bg-blue-400',
  active: 'bg-emerald-400',
  past_due: 'bg-red-400',
  canceled: 'bg-red-400',
  paused: 'bg-amber-400',
}

const FEATURES = [
  'Korlátlan foglalás',
  'Munkatársak és elérhetőség kezelése',
  'Részletes statisztikák és CSV export',
  'Email értesítések (foglalás, lemondás)',
  'Nyilvános foglalási oldal egyedi linken',
  'Szolgáltatás kategóriák és sablonok',
  'Light / Dark mód',
  'Mobile-first dashboard',
]

function Kpi({ sub, value, label }: { sub: string; value: string; label?: string }) {
  return (
    <div className="rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{sub}</p>
      <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
      {label && <p className="text-xs text-zinc-500 dark:text-white/40">{label}</p>}
    </div>
  )
}

export default async function SubscriptionPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon | undefined
  if (!salon) return null

  const subResult = await payload.find({
    collection: 'subscriptions',
    where: { salon: { equals: salon.id } },
    limit: 1,
    overrideAccess: true,
  })
  const sub = (subResult.docs[0] as Subscription) ?? null
  const days = sub?.status === 'trialing' ? daysLeft(sub.trial_ends_at) : null

  const planLabel = sub?.plan === 'pro' ? 'Pro' : 'Próbaidőszak'
  const priceLabel = sub?.plan === 'pro' ? '2 900 Ft' : 'Ingyenes'
  const periodEnd = sub?.status === 'trialing' ? sub.trial_ends_at : sub?.current_period_end

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Számlázás</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Előfizetés</h1>
      </div>

      {/* Lock notice — past_due / canceled esetén */}
      {(sub?.status === 'past_due' || sub?.status === 'canceled') && (
        <div className="rounded-2xl p-5 lg:p-6 bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900/40">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-11 w-11 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 dark:text-red-300 mb-0.5">
                {sub?.status === 'past_due' ? 'Lejárt a próbaidőszakod' : 'Az előfizetésed megszűnt'}
              </p>
              <p className="text-sm text-red-700/80 dark:text-red-300/80">
                A dashboard funkciók le vannak tiltva amíg nincs aktív előfizetés. A vendégek továbbra is tudnak foglalni a nyilvános oldaladon.
              </p>
            </div>
          </div>
          <Link
            href="/bookly/dashboard/settings"
            className="flex items-center justify-center gap-2 h-11 w-full sm:w-auto sm:inline-flex sm:px-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Settings className="h-4 w-4" />
            Tovább a beállításokhoz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <Kpi sub="Csomag" value={planLabel} label={STATUS_LABELS[sub?.status ?? ''] ?? '—'} />
        <Kpi sub="Havi díj" value={priceLabel} label={sub?.plan === 'pro' ? 'forintban' : 'a próba alatt'} />
        {days !== null
          ? <Kpi sub="Hátralévő idő" value={days === 0 ? 'Ma' : `${days} nap`} label="a próbából" />
          : <Kpi sub="Időszak vége" value={formatDate(periodEnd)} label="megújulás" />
        }
        <Kpi sub="Indulás" value={formatDate(salon?.createdAt as unknown as string)} label="regisztráció" />
      </div>

      {/* Status row */}
      <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-5 py-4 flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[sub?.status ?? ''] ?? 'bg-zinc-300'}`} />
        <p className="text-sm text-zinc-500 dark:text-white/50 flex-1">
          {sub?.status === 'trialing' && <>Próbaidőszakban vagy. <span className="text-zinc-900 dark:text-white font-bold">{days ?? 0} nap</span> múlva lejár — utána Pro csomagra kell váltani.</>}
          {sub?.status === 'active' && <>Aktív <span className="text-zinc-900 dark:text-white font-bold">Pro</span> előfizetésed van. Köszönjük!</>}
          {sub?.status === 'past_due' && <><span className="text-red-600 dark:text-red-400 font-bold">Fizetési hiba</span> — frissítsd a számlázási adataidat.</>}
          {sub?.status === 'canceled' && <>Az előfizetésed <span className="text-red-600 dark:text-red-400 font-bold">megszűnt</span>.</>}
          {sub?.status === 'paused' && <>Az előfizetésed <span className="text-amber-600 dark:text-amber-400 font-bold">szünetel</span>.</>}
        </p>
      </div>

      {/* Két oszlop: features + payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3">

        {/* Features */}
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
          <div className="px-5 lg:px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0099ff]" />
            <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Pro funkciók</h2>
          </div>
          <ul className="p-5 lg:p-6 space-y-3">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-white/70">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Fizetés */}
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
          <div className="px-5 lg:px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-zinc-400 dark:text-white/40" />
            <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Fizetés</h2>
          </div>
          <div className="p-5 lg:p-6">
            {sub?.status === 'active' ? (
              <>
                <p className="text-sm text-zinc-500 dark:text-white/40 mb-3">Következő számlázás</p>
                <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-1">{priceLabel}</p>
                <p className="text-sm text-zinc-500 dark:text-white/40">{formatDate(periodEnd)}-én</p>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm font-semibold text-zinc-700 dark:text-white/70 mb-1">Online fizetés hamarosan</p>
                <p className="text-xs text-zinc-400 dark:text-white/30">
                  Stripe integráció fejlesztés alatt. Addig írj nekünk:{' '}
                  <a href="mailto:hello@bookly.hu" className="underline hover:opacity-70">hello@bookly.hu</a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
