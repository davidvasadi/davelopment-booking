import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A cím-mező részletessége a foglaló űrlapon — nem csak be/ki, hanem "csak várost kérek" fokozat
 * is (`off`|`city`|`full`). Lásd `src/payload/settingsFields.ts` (`booking_rules.address_detail_level`).
 * Előleg aktív üzleteknél a meglévő adat `full`-ra áll (ott a számlázáshoz a teljes cím kellett
 * eddig is, a `require_address`-en keresztül) — a többinél az alapérték (`full`) jelenti a mai,
 * változatlan viselkedést (a cím mező mindig látszott, csak opcionális volt).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "booking_rules_address_detail_level" varchar DEFAULT 'full';
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "booking_rules_address_detail_level";
    `))
  }
}
