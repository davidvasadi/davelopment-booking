import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Emlékeztető-bővítés: 48 órás és egyedi (órában megadott) időzítés az üzleteknél, és a
 * foglalásokon a legutóbb kiküldött emlékeztető időzítése (több emlékeztető idempotens küldéséhez).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "salons"
      ADD COLUMN IF NOT EXISTS "feature_modules_reminder_t_48h" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "feature_modules_reminder_custom_hours" numeric;

    ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "feature_modules_reminder_t_48h" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "feature_modules_reminder_custom_hours" numeric;

    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminder_last_offset" numeric;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "reminder_last_offset" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "salons"
      DROP COLUMN IF EXISTS "feature_modules_reminder_t_48h",
      DROP COLUMN IF EXISTS "feature_modules_reminder_custom_hours";

    ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "feature_modules_reminder_t_48h",
      DROP COLUMN IF EXISTS "feature_modules_reminder_custom_hours";

    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "reminder_last_offset";
    ALTER TABLE "reservations" DROP COLUMN IF EXISTS "reminder_last_offset";
  `)
}
