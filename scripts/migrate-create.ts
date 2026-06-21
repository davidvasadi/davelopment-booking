/**
 * Migráció generálása — LOKÁLISAN futtatandó séma-változás után.
 *
 * Miért így: a `payload` CLI a tsx ESM/CJS interopon (loadEnv / undici) elakad
 * ("Illegal constructor"), ezért NEM használható. Ez a szkript megkerüli: az env-et
 * közvetlenül dotenv-vel töltjük, a configot dinamikusan importáljuk, és a Payload
 * programozott migration API-ját hívjuk (`payload.db.createMigration`).
 *
 * Mit csinál: a kódban definiált aktuális sémát diff-eli a legutóbbi snapshot-hoz
 * (src/migrations/*.json), és megírja az új verziózott up/down SQL-t + snapshotot.
 * Ezt a fájlt COMMITOLNI kell — a deploy ebből futtat (scripts/migrate.ts).
 *
 * Futtatás:
 *   npx tsx scripts/migrate-create.ts <nev>
 *   pl. npx tsx scripts/migrate-create.ts add_stripe_fields
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv({ path: '.env.local' })
loadDotenv() // .env is, ha az .env.local nem mindent fed

const run = async () => {
  const migrationName = process.argv[2]
  if (!migrationName) {
    console.error('[migrate-create] Hiányzik a migráció neve. Pl.: npx tsx scripts/migrate-create.ts add_stripe_fields')
    process.exit(1)
  }

  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  console.log(`[migrate-create] Payload init…`)
  const payload = await getPayload({ config })

  console.log(`[migrate-create] Migráció generálása: "${migrationName}"`)
  await payload.db.createMigration({
    migrationName,
    payload,
    forceAcceptWarning: true, // non-interaktív: üres diffnél is fut, nem kérdez
  })

  console.log('[migrate-create] Kész. Nézd át és commitold a src/migrations/ alatti új fájlokat.')
  process.exit(0)
}

run().catch((err) => {
  console.error('[migrate-create] HIBA:', err)
  process.exit(1)
})
