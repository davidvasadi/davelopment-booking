import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A vendég irányítószáma a foglaláson / asztalfoglaláson (a számlához kell: irányítószám, település, utca, házszám). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "customer_postal_code" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "customer_postal_code";`))
}
