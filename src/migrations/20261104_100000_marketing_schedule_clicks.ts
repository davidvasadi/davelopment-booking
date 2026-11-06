import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Marketing (design 13.x):
 * - ütemezett küldés: `marketing_campaigns.scheduled_at` + „scheduled” állapot, és a kész levél HTML-je (`body_html`),
 *   hogy a cron a böngésző nélkül is ki tudja küldeni;
 * - linkenkénti kattintás: `email_log.clicked_links` (JSON: [{ url, at }]) és `clicked_at` — a Resend „email.clicked”
 *   webhookjából (a link a Resend saját követéséből jön, nem a levélbe épített saját követőből);
 * - leiratkozás időpontja: `customers.marketing_unsubscribed_at` (a kampány „Leiratkozott” száma ebből).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TYPE "public"."enum_marketing_campaigns_status" ADD VALUE IF NOT EXISTS 'scheduled';
    ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp(3) with time zone;
    ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "body_html" varchar;
    ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "clicked_links" jsonb;
    ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "clicked_at" timestamp(3) with time zone;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "marketing_unsubscribed_at" timestamp(3) with time zone;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // az enum-érték ('scheduled') Postgresben nem vehető ki egyszerűen — az oszlopok igen
  await db.execute(sql.raw(`
    ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "scheduled_at";
    ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "body_html";
    ALTER TABLE "email_log" DROP COLUMN IF EXISTS "clicked_links";
    ALTER TABLE "email_log" DROP COLUMN IF EXISTS "clicked_at";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "marketing_unsubscribed_at";
  `))
}
