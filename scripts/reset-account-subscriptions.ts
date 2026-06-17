/**
 * Egyszeri reset: ÜZLET-szintű → FIÓK-szintű előfizetés átállás.
 *
 * A régi modellben minden szalon/étterem külön `subscriptions` rekordot kapott
 * (salon/restaurant relationnel). Az új modellben EGY user = EGY előfizetés (owner relation).
 * Ez a szkript:
 *   1. Törli az ÖSSZES meglévő (régi) subscription-t.
 *   2. Minden olyan userhez, akinek van legalább egy üzlete (szalon vagy étterem), létrehoz
 *      egy fiók-szintű előfizetést próbaidővel, a megfelelő count/díj/breakdown értékekkel.
 *
 * Csak teszt-adaton futtatandó (nincs éles fizető ügyfél). A db-push UTÁN kell futtatni
 * (a séma már a fiók-szintű mezőket tartalmazza).
 *
 * Futtatás (Node 22 + tsx):
 *   npx tsx scripts/reset-account-subscriptions.ts
 */
import { config as loadDotenv } from 'dotenv'
// Lokálisan a .env.local tartalmazza a DATABASE_URI-t (élesen a .env). Mindkettőt betöltjük;
// a .env.local felülírja a .env-et (Next-konvenció), így dev és prod is működik.
loadDotenv()
loadDotenv({ path: '.env.local', override: true })

const run = async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  const { syncAccountSubscription } = await import('../src/lib/accountSubscription')

  const payload = await getPayload({ config })
  console.log('[reset-sub] Payload init kész.')

  // 1. Régi subscription-ök törlése.
  const old = await payload.find({ collection: 'subscriptions', limit: 1000, depth: 0, overrideAccess: true })
  console.log(`[reset-sub] ${old.totalDocs} régi előfizetés törlése…`)
  for (const sub of old.docs) {
    await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
  }

  // 2. Fiók-subok létrehozása minden üzlet-tulajdonos userhez.
  const [salons, restaurants] = await Promise.all([
    payload.find({ collection: 'salons', limit: 1000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 1000, depth: 0, overrideAccess: true }),
  ])
  const ownerIds = new Set<string>()
  for (const s of salons.docs) {
    const oid = s.owner && typeof s.owner === 'object' ? (s.owner as { id: unknown }).id : s.owner
    if (oid != null) ownerIds.add(String(oid))
  }
  for (const r of restaurants.docs) {
    const oid = r.owner && typeof r.owner === 'object' ? (r.owner as { id: unknown }).id : r.owner
    if (oid != null) ownerIds.add(String(oid))
  }

  console.log(`[reset-sub] ${ownerIds.size} fiókhoz fiók-előfizetés létrehozása…`)
  for (const ownerId of ownerIds) {
    await syncAccountSubscription({ payload }, ownerId)
  }

  const total = await payload.count({ collection: 'subscriptions' })
  console.log(`[reset-sub] Kész. Fiók-előfizetések: ${total.totalDocs}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[reset-sub] HIBA:', err)
  process.exit(1)
})
