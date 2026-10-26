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
 *
 * Automatikus mentés: ha van még le nem futott migráció, ELŐTTE pg_dump készül a
 * ~/backups/booking_premigrate_*.dump fájlba (az utolsó 15 marad meg). Ha a mentés nem
 * sikerül, a migráció NEM fut le (a deploy hibával leáll és visszaáll) — így éles
 * séma-változás soha nem történik mentés nélkül, és nem kell kézzel dumpolni.
 * Kikapcsolás (pl. lokálisan): SKIP_PREMIGRATE_BACKUP=1
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

  // ── Mentés, ha lesz séma-változás ──
  const { migrations } = await import('../src/migrations')
  const doneRes = await payload.db.drizzle.execute(sql`SELECT name FROM payload_migrations`)
  const done = new Set((doneRes.rows as { name: string }[]).map((r) => r.name))
  const pending = migrations.map((m) => m.name).filter((n) => !done.has(n))
  if (pending.length > 0 && process.env.SKIP_PREMIGRATE_BACKUP !== '1') {
    const { execFileSync } = await import('node:child_process')
    const { mkdirSync, readdirSync, unlinkSync } = await import('node:fs')
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = join(homedir(), 'backups')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
    const file = join(dir, `booking_premigrate_${stamp}.dump`)
    console.log(`[migrate] ${pending.length} új migráció (${pending.join(', ')}) — mentés: ${file}`)
    // hibánál kivételt dob → a migráció nem fut le, a deploy visszaáll
    execFileSync('pg_dump', [process.env.DATABASE_URI as string, '-Fc', '-f', file], { stdio: 'inherit' })
    // csak a legutóbbi 15 automatikus mentés marad
    const old = readdirSync(dir).filter((f) => f.startsWith('booking_premigrate_')).sort().slice(0, -15)
    for (const f of old) unlinkSync(join(dir, f))
    console.log('[migrate] Mentés kész.')
  }

  console.log('[migrate] Migrációk futtatása…')
  await payload.db.migrate()
  console.log('[migrate] Kész. A séma naprakész.')

  process.exit(0)
}

run().catch((err) => {
  console.error('[migrate] HIBA:', err)
  process.exit(1)
})
