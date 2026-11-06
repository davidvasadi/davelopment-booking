import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Számla sztornózása (Beállítások › Számlák): a vendégnek kiállított számla a számlázóban (Számlázz.hu / Billingo)
 * ellenszámlával sztornózható — nálunk „Sztornózva” állapot és a sztornó számla száma. Foglalás, asztalfoglalás,
 * ajándékutalvány.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TYPE "enum_bookings_invoice_status" ADD VALUE IF NOT EXISTS 'storno';
    ALTER TYPE "enum_reservations_invoice_status" ADD VALUE IF NOT EXISTS 'storno';
    ALTER TYPE "enum_gift_vouchers_invoice_status" ADD VALUE IF NOT EXISTS 'storno';
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "invoice_storno_number" varchar;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "invoice_storno_number" varchar;
    ALTER TABLE "gift_vouchers" ADD COLUMN IF NOT EXISTS "invoice_storno_number" varchar;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // az enum-érték Postgresben nem vehető ki egyszerűen — a sztornózott tételek visszaállnak „Kiállítva”-ra
  await db.execute(sql.raw(`
    UPDATE "bookings" SET "invoice_status" = 'issued' WHERE "invoice_status" = 'storno';
    UPDATE "reservations" SET "invoice_status" = 'issued' WHERE "invoice_status" = 'storno';
    UPDATE "gift_vouchers" SET "invoice_status" = 'issued' WHERE "invoice_status" = 'storno';
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "invoice_storno_number";
    ALTER TABLE "reservations" DROP COLUMN IF EXISTS "invoice_storno_number";
    ALTER TABLE "gift_vouchers" DROP COLUMN IF EXISTS "invoice_storno_number";
  `))
}
