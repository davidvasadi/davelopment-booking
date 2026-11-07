import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A foglalóoldal borítójának alap színe (hex), ha nincs borítókép — üresen a davelopment sötét alapja. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_cover_color" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_cover_color";`))
}
