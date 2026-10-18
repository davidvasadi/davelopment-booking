import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Önbevallásos kapcsoló a Google Cégem „Foglalj most” gombhoz — ld.
 * `src/payload/settingsFields.ts` (`feature_modules.google_booking_confirmed`). A tényleges
 * beállítás a tulaj saját Google-fiókjában történik, API-n kívül, ezért valós állapot-ellenőrzés
 * nem lehetséges; ez a mező csak azt rögzíti, hogy a tulaj maga megerősítette.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "feature_modules_google_booking_confirmed" boolean DEFAULT false;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "feature_modules_google_booking_confirmed";
    `))
  }
}
