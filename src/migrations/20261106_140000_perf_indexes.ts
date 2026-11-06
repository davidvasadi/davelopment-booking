import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sebesség (docs/audit/2026-11-05_1921-sebesseg-feltaras.md, 2.2): indexek a leggyakoribb szűrőkre — a foglalás / asztal-
 * foglalás dátuma és állapota, a műszak dátuma. A nevek a Payload elnevezését követik (a séma `index: true` mezői).
 * Csak gyorsít, adatot nem változtat.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS "bookings_date_idx" ON "bookings" USING btree ("date");
    CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "reservations_date_idx" ON "reservations" USING btree ("date");
    CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "shifts_date_idx" ON "shifts" USING btree ("date");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP INDEX IF EXISTS "shifts_date_idx";
    DROP INDEX IF EXISTS "reservations_status_idx";
    DROP INDEX IF EXISTS "reservations_date_idx";
    DROP INDEX IF EXISTS "bookings_status_idx";
    DROP INDEX IF EXISTS "bookings_date_idx";
  `))
}
