import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "notification_prefs_bookings" boolean DEFAULT true;
  ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "notification_prefs_system"   boolean DEFAULT false;
  ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "notification_prefs_staff"    boolean DEFAULT false;
  ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "notification_prefs_schedule" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "roles" DROP COLUMN IF EXISTS "notification_prefs_bookings";
  ALTER TABLE "roles" DROP COLUMN IF EXISTS "notification_prefs_system";
  ALTER TABLE "roles" DROP COLUMN IF EXISTS "notification_prefs_staff";
  ALTER TABLE "roles" DROP COLUMN IF EXISTS "notification_prefs_schedule";
  `)
}
