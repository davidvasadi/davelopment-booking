import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Helyben szerkesztés (design 21.6.3): az üzlet nevének és címének színe a foglalóoldalon (kulcsszó vagy hex). */
const COLS = ['name_color', 'address_color']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(COLS.map((f) => `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_${f}" varchar;`).join('\n')))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(COLS.map((f) => `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_${f}";`).join('\n')))
  }
}
