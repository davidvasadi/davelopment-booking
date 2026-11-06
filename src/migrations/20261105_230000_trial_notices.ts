import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A próbaidő levelei (design 18.4): melyik előfizetésnek melyik levél ment már ki (7 nap / 3 nap / 1 nap / kész /
 * lejárt) — hogy a napi cron egyiket se küldje kétszer. Nem Payload-kollekció: csak a lib/trialNotices.ts éri el.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "trial_notices" (
      "subscription_id" integer NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
      "kind" varchar NOT NULL,
      "sent_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("subscription_id", "kind")
    );
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "trial_notices";`))
}
