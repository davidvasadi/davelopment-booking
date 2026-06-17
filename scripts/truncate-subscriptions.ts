/**
 * A `subscriptions` tábla kiürítése a fiók-szintű séma-push ELŐTT.
 *
 * Miért kell: a db-push az `owner_id` NOT NULL oszlopot adja a táblához; ha vannak régi
 * (üzlet-szintű) sorok owner nélkül, a push elakad a not-null constraint-en. Üres táblára
 * a push tiszta. A reset-account-subscriptions.ts utána létrehozza a fiók-subokat.
 *
 * A `.env`-ből (élesen) ill. `.env.local`-ból (lokál) tölti a DATABASE_URI-t, közvetlen
 * `pg` kapcsolaton fut (nem Payload init), így a séma-eltérés még nem zavar.
 *
 * Futtatás: npx tsx scripts/truncate-subscriptions.ts
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv()
loadDotenv({ path: '.env.local', override: true })

const run = async () => {
  const uri = process.env.DATABASE_URI
  if (!uri) {
    console.error('[truncate-sub] HIBA: nincs DATABASE_URI az env-ben.')
    process.exit(1)
  }
  const { Client } = await import('pg')
  const client = new Client({ connectionString: uri })
  await client.connect()
  try {
    await client.query('TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE')
    console.log('[truncate-sub] subscriptions tábla kiürítve.')
  } finally {
    await client.end()
  }
  process.exit(0)
}

run().catch((err) => {
  console.error('[truncate-sub] HIBA:', err)
  process.exit(1)
})
