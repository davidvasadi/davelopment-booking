import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_digest" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_digest";
  `)
}
