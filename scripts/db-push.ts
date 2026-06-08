/**
 * Standalone Payload init — séma-push / DB-szinkron prod-ban.
 *
 * A Payload `next start` prod-runtime NEM futtatja a postgres `push`-t, és a
 * `payload` CLI a tsx ESM/CJS interop miatt elakad. Ez a szkript a hivatalosan
 * támogatott `getPayload({ config })` úton tölti be a configot (ugyanúgy ahogy
 * az app), aminek az init-je lefuttatja a push-t (push:true a payload.config.ts-ben),
 * így létrehozza/szinkronizálja a sémát a DB-ben.
 *
 * Futtatás (Node 22 + tsx, a szerveren):
 *   node --import tsx/esm scripts/db-push.ts
 *
 * Újrahasználható később seed-eléshez és migráció-futtatáshoz is.
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  console.log('[db-push] Payload init indul — séma-szinkron (push)…')
  const payload = await getPayload({ config })
  console.log('[db-push] Payload init kész. A séma szinkronizálva.')
  // Egy egyszerű query, hogy biztosan inicializálódjon a DB-réteg.
  const { totalDocs } = await payload.count({ collection: 'users' })
  console.log(`[db-push] users tábla elérhető, dokumentumok: ${totalDocs}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[db-push] HIBA:', err)
  process.exit(1)
})
