import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Fizetési link a foglaláshoz (design 6.7.1): a Stripe Checkout link és munkamenet, és a lezárás adatai (tételek,
 *  számla, vevő), amivel a kifizetés után a webhook lezárja a foglalást. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pay_link_url" varchar;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pay_link_session" varchar;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pay_pending" jsonb;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pay_pending";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pay_link_session";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pay_link_url";
  `))
}
