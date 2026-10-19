import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Önbevallásos kapcsoló a Facebook/Instagram „Foglalj” gombhoz — ugyanaz a buktató, mint a
 * `google_booking_confirmed`-nél (ld. 20261018_120000): a beállítás a tulaj saját Meta
 * Business fiókjában történik, API-n kívül, valós ellenőrzés nem lehetséges.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "feature_modules_facebook_booking_confirmed" boolean DEFAULT false;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "feature_modules_facebook_booking_confirmed";
    `))
  }
}
