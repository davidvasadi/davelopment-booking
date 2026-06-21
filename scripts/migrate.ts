/**
 * Migrációk futtatása — a DEPLOY futtatja (a régi db-push.ts helyett).
 *
 * Miért így: a `payload migrate` CLI a tsx ESM/CJS interopon (undici) elakad, ezért
 * megkerüljük: env dotenv-vel, config dinamikus import, majd a Payload programozott
 * `payload.db.migrate()` API. Lefuttatja a payload_migrations-ben még NEM szereplő
 * commitolt migrációkat, sorrendben. Non-interaktív, idempotens (a már lefutottakat
 * kihagyja) → `git pull && build && npx tsx scripts/migrate.ts` nem tudja elrontani
 * a sémát.
 *
 * Futtatás (a szerveren, Node 22 + tsx):
 *   npx tsx scripts/migrate.ts
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv() // .env betöltése MIELŐTT a payload bármit importálna

const run = async () => {
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const { default: config } = await import('../payload.config')

  console.log('[migrate] Payload init…')
  const payload = await getPayload({ config })

  // A dev-push history sentinel (batch=-1) miatt a Payload migrate() interaktívan kérdezne
  // ("data loss will occur, proceed?"), ami a deploy-on végtelenül lógna. Prod-ban a push
  // ki van kapcsolva, így ez a sor csak a régi push-időkből maradt rekord — biztonságosan
  // törölhető. A valódi migrációk a saját nevükkel vannak nyilvántartva, azokhoz nem nyúlunk.
  const removed = await payload.db.drizzle.execute(
    sql`DELETE FROM payload_migrations WHERE batch = -1`,
  )
  if (removed?.rowCount) console.log(`[migrate] dev-push sentinel sor törölve (${removed.rowCount}).`)

  console.log('[migrate] Migrációk futtatása…')
  await payload.db.migrate()
  console.log('[migrate] Kész. A séma naprakész.')

  process.exit(0)
}

run().catch((err) => {
  console.error('[migrate] HIBA:', err)
  process.exit(1)
})
