import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_bookings" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_system"   boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_staff"    boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_schedule" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_bookings";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_system";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_staff";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_schedule";
  `)
}
