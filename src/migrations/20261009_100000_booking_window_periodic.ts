import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Időszakos foglalási megnyitás (szalon + étterem): `booking_window_periodic` (be = N napos
 * időszakok, ki = a mai gördülő ablak), `booking_window_end` (a jelenlegi időszak utolsó napja),
 * `booking_window_auto_renew` (lejáratkor újabb N nap), `booking_window_notice_for` (melyik
 * időszak-végről ment már ki a „hamarosan lejár” értesítés). Új értesítés- és e-mail-napló típus:
 * `booking_window`.
 * DOWN: az oszlopokat eldobja; az enum-értékeket Postgres nem tudja eltávolítani (no-op).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons"
  ADD COLUMN IF NOT EXISTS "booking_window_periodic" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "booking_window_end" varchar,
  ADD COLUMN IF NOT EXISTS "booking_window_auto_renew" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_window_notice_for" varchar;
ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "booking_window_periodic" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "booking_window_end" varchar,
  ADD COLUMN IF NOT EXISTS "booking_window_auto_renew" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "booking_window_notice_for" varchar;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'booking_window';
ALTER TYPE "public"."enum_email_log_type" ADD VALUE IF NOT EXISTS 'booking_window';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons"
  DROP COLUMN IF EXISTS "booking_window_periodic",
  DROP COLUMN IF EXISTS "booking_window_end",
  DROP COLUMN IF EXISTS "booking_window_auto_renew",
  DROP COLUMN IF EXISTS "booking_window_notice_for";
ALTER TABLE "restaurants"
  DROP COLUMN IF EXISTS "booking_window_periodic",
  DROP COLUMN IF EXISTS "booking_window_end",
  DROP COLUMN IF EXISTS "booking_window_auto_renew",
  DROP COLUMN IF EXISTS "booking_window_notice_for";`)
}
