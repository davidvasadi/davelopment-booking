import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Foglalási űrlap mező-láthatóság: a tulaj teljesen elrejtheti a telefon/cím/megjegyzés mezőt
 * (nem csak kötelezővé/opcionálissá teszi), plusz külön kapcsoló a marketing-elfogadó checkbox
 * megjelenítésére. Lásd `src/payload/settingsFields.ts` (`booking_rules` csoport).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "booking_rules_hidden_booking_fields" jsonb,
        ADD COLUMN IF NOT EXISTS "booking_rules_show_marketing_consent_field" boolean DEFAULT true;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
        DROP COLUMN IF EXISTS "booking_rules_hidden_booking_fields",
        DROP COLUMN IF EXISTS "booking_rules_show_marketing_consent_field";
    `))
  }
}
