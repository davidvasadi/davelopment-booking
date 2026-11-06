import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** „Ami figyelmet kér” (design 6.8.1) — a felhasználó saját beállítása: új függő foglalásnál popup (különben sáv), és a
 *  „Fizetésre vár” sáv (különben csak a jel). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_pending_popup" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_notif_prefs_payment_bar" boolean DEFAULT false;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_payment_bar";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "personal_notif_prefs_pending_popup";
  `))
}
