/**
 * Beosztás-automatizáló cron — minden aktív szalonra lefuttatja az `autofillSalonSchedule`-t
 * (ld. `src/lib/scheduleAutofill.ts`). Ez a napi "biztonsági háló" — a `booking_window_days`
 * mentésekor a szalon-beállítás PATCH route-ja is meghívja UGYANEZT a függvényt azonnal, hogy az
 * ablak kitolása ne várjon a következő éjszakai futásig.
 *
 * VPS cron hívja (naponta egyszer elég, pl. hajnalban), CRON_SECRET-tel védve:
 *   0 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://booking.davelopment.hu/api/cron/schedule-autofill
 *
 * Csak a SZALON oldalt érinti — az étteremnek nincs munkatárs-szintű `availability` mintája
 * (ott `OpeningHours`/`OpeningHoursExceptions` üzlet-szintű, nem személyre szabott), ezért ott
 * nincs mit "levezetni" munkanapnak.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { autofillSalonSchedule } from '@/lib/scheduleAutofill'
import { refreshAllGoogleReviews } from '@/lib/googleReviews'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  const summary = { salons: 0, staffChecked: 0, created: 0, updated: 0, removed: 0, errors: 0 }

  const salons = await payload.find({
    collection: 'salons',
    where: { is_active: { not_equals: false } },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })

  for (const salon of salons.docs) {
    try {
      const result = await autofillSalonSchedule(payload, String(salon.id), salon.booking_window_days ?? 60)
      summary.salons++
      summary.staffChecked += result.staffChecked
      summary.created += result.created
      summary.updated += result.updated
      summary.removed += result.removed
    } catch (err) {
      summary.errors++
      payload.logger.error(`[cron/schedule-autofill] salon ${salon.id} hiba: ${String(err)}`)
    }
  }

  // Google-értékelések napi frissítése (üzletenként 1 hívás/nap) — ide kötve, mert ez a cron
  // naponta egyszer fut, így nem kell külön VPS-időzítés. Kulcs nélkül no-op.
  let googleReviews = { refreshed: 0, errors: 0 }
  try {
    googleReviews = await refreshAllGoogleReviews(payload)
  } catch (err) {
    payload.logger.error(`[cron/schedule-autofill] google-reviews hiba: ${String(err)}`)
  }

  return NextResponse.json({ ok: true, ...summary, googleReviews })
}
