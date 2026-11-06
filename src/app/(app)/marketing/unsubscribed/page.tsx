import { GuestResult, GuestShell } from '@/components/blocks/guest-pages'

/** Hírlevél-leiratkozás eredménye (a levél alján a linkről) — design 21.12. */
export default async function MarketingUnsubscribedPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <GuestShell biz={null}>
      {error
        ? <GuestResult tone="bad" title="Érvénytelen link" text="Ez a leiratkozó link már nem érvényes, vagy hiba történt. Próbáld újra a legutóbbi hírlevélben kapott linkkel." />
        : <GuestResult tone="ok" title="Sikeresen leiratkoztál" text="Nem küldünk több hírlevelet erre a címre. A foglalásaid e-mailjeit (visszaigazolás, emlékeztető) ez nem érinti." />}
    </GuestShell>
  )
}
