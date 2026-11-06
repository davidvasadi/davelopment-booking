import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Helyszíni fizetés (design 6.7.1 / 16.7): a szalon beállítása (be/ki, bizonylat: pénztárgép / számlázó, fizetési
 * módok, számla alapból / kérésre), és a foglaláson a rögzített fizetés (összeg, mód, tételek, bizonylat, időpont).
 * Előleges foglalásnál a végszámlát első körben a szalon kézzel állítja ki („manual”).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    DO $$ BEGIN CREATE TYPE "public"."enum_salons_onsite_payment_mode" AS ENUM('register', 'invoice'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_salons_onsite_payment_invoice_default" AS ENUM('ask', 'always'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_bookings_pay_method" AS ENUM('cash', 'card', 'transfer', 'link'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_bookings_pay_receipt" AS ENUM('invoice', 'register', 'none', 'manual'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "onsite_payment_enabled" boolean DEFAULT false;
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "onsite_payment_mode" "enum_salons_onsite_payment_mode" DEFAULT 'register';
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "onsite_payment_methods" varchar DEFAULT 'cash,card,transfer';
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "onsite_payment_invoice_default" "enum_salons_onsite_payment_invoice_default" DEFAULT 'ask';
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paid_amount_huf" numeric;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pay_method" "enum_bookings_pay_method";
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pay_receipt" "enum_bookings_pay_receipt";
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paid_lines" jsonb;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paid_at" timestamp(3) with time zone;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "paid_at";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "paid_lines";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pay_receipt";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "pay_method";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "paid_amount_huf";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "onsite_payment_invoice_default";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "onsite_payment_methods";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "onsite_payment_mode";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "onsite_payment_enabled";
    DROP TYPE IF EXISTS "public"."enum_bookings_pay_receipt";
    DROP TYPE IF EXISTS "public"."enum_bookings_pay_method";
    DROP TYPE IF EXISTS "public"."enum_salons_onsite_payment_invoice_default";
    DROP TYPE IF EXISTS "public"."enum_salons_onsite_payment_mode";
  `))
}
