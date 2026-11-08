import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A vendég számlázási országa (ISO kód, lib/countries) a foglaláson / asztalfoglaláson — üres = Magyarország. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "customer_country" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "customer_country";`))
}
