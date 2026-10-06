import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajándékutalvány fizetési módja (szűréshez). Visszamenőleg: a helyben kiállított (manual-…)
 * utalványoknál nem tudjuk, készpénz vagy kártya volt → üresen marad; a többi Stripe-on ment.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_gift_vouchers_payment_method" AS ENUM('online', 'payment_link', 'cash', 'pos_card', 'transfer', 'other');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    ALTER TABLE "gift_vouchers" ADD COLUMN IF NOT EXISTS "payment_method" "enum_gift_vouchers_payment_method";
    UPDATE "gift_vouchers" SET "payment_method" = 'online'
      WHERE "payment_method" IS NULL AND "payment_intent_id" NOT LIKE 'manual-%';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "gift_vouchers" DROP COLUMN IF EXISTS "payment_method";
    DROP TYPE IF EXISTS "public"."enum_gift_vouchers_payment_method";
  `)
}
