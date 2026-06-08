/**
 * Standalone Payload init — séma-push / DB-szinkron prod-ban.
 *
 * Miért így: a Payload `next start` prod-runtime NEM futtatja a postgres `push`-t,
 * a `payload` CLI pedig a tsx ESM/CJS interopon (loadEnv / next loadEnvConfig) elakad.
 * Ez a szkript MEGKERÜLI a payload `loadEnv` wrapperét: az env-et közvetlenül dotenv-vel
 * töltjük, a configot dinamikusan importáljuk, és a `getPayload`-ot hívjuk (push:true a
 * configban → az init létrehozza/szinkronizálja a sémát).
 *
 * Futtatás (Node 22 + tsx, a szerveren):
 *   npx tsx scripts/db-push.ts
 *
 * Újrahasználható később seed-eléshez és migráció-futtatáshoz is.
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv() // .env betöltése MIELŐTT a payload bármit importálna

const run = async () => {
  // Dinamikus importok: a dotenv már lefutott, így a config a helyes env-et látja.
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  console.log('[db-push] Payload init indul — séma-szinkron (push)…')
  const payload = await getPayload({ config })
  console.log('[db-push] Payload init kész. A séma szinkronizálva.')

  const { totalDocs } = await payload.count({ collection: 'users' })
  console.log(`[db-push] users tábla elérhető, dokumentumok: ${totalDocs}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[db-push] HIBA:', err)
  process.exit(1)
})
