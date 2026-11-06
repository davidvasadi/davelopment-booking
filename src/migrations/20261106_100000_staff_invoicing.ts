import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Szakemberenkénti számlázás (design 16.7 „Ki számláz?”): az üzletnél a kiállító (az üzlet / szakemberenként), a
 * munkatársnál a saját számlázó (szolgáltató + titkosított kulcs) és a saját Stripe Connect fiók. Az adószám a
 * munkatársnál már megvan (`staff.tax_number`) — ebből az ÁFA.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    DO $$ BEGIN CREATE TYPE "public"."enum_salons_invoice_settings_issuer" AS ENUM('business', 'staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_restaurants_invoice_settings_issuer" AS ENUM('business', 'staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_staff_invoice_provider" AS ENUM('szamlazz', 'billingo', 'none'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "invoice_settings_issuer" "enum_salons_invoice_settings_issuer" DEFAULT 'business';
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "invoice_settings_issuer" "enum_restaurants_invoice_settings_issuer" DEFAULT 'business';
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "invoice_provider" "enum_staff_invoice_provider" DEFAULT 'none';
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "szamlazz_agent_key_enc" varchar;
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "billingo_api_key_enc" varchar;
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" varchar;
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "stripe_connect_onboarded" boolean DEFAULT false;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "stripe_connect_onboarded";
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "stripe_connect_account_id";
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "billingo_api_key_enc";
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "szamlazz_agent_key_enc";
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "invoice_provider";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "invoice_settings_issuer";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "invoice_settings_issuer";
    DROP TYPE IF EXISTS "public"."enum_staff_invoice_provider";
    DROP TYPE IF EXISTS "public"."enum_restaurants_invoice_settings_issuer";
    DROP TYPE IF EXISTS "public"."enum_salons_invoice_settings_issuer";
  `))
}
