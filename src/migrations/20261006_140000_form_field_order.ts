import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** `booking_rules.form_field_order` — a foglalási űrlap mezőinek sorrendje (NULL = alapsorrend).
 *  A `booking_rules` csoport közös, ezért az étterem táblán is létrejön az oszlop. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "booking_rules_form_field_order" jsonb;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "booking_rules_form_field_order" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN IF EXISTS "booking_rules_form_field_order";
ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "booking_rules_form_field_order";`)
}
