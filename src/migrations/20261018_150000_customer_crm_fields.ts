import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Bővebb vendég-CRM mezők: születésnap, szabad csoport/címke, és egy állandó számlázási profil
 * (cégként vásárló törzsvendégeknek) — ld. `src/payload/collections/Customers.ts`. A `collapsible`
 * payload-mezőtípus csak UI-csoportosítás, a mezők top-level oszlopok maradnak.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "birthday" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "group_tag" varchar,
      ADD COLUMN IF NOT EXISTS "billing_name" varchar,
      ADD COLUMN IF NOT EXISTS "billing_tax_number" varchar,
      ADD COLUMN IF NOT EXISTS "billing_email" varchar,
      ADD COLUMN IF NOT EXISTS "billing_postal_code" varchar,
      ADD COLUMN IF NOT EXISTS "billing_city" varchar,
      ADD COLUMN IF NOT EXISTS "billing_street" varchar;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers"
      DROP COLUMN IF EXISTS "birthday",
      DROP COLUMN IF EXISTS "group_tag",
      DROP COLUMN IF EXISTS "billing_name",
      DROP COLUMN IF EXISTS "billing_tax_number",
      DROP COLUMN IF EXISTS "billing_email",
      DROP COLUMN IF EXISTS "billing_postal_code",
      DROP COLUMN IF EXISTS "billing_city",
      DROP COLUMN IF EXISTS "billing_street";
  `))
}
