import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Helyben szerkesztés (design 21.6.3): a foglalóoldal főoldali elemeinek sorrendje (galéria, név, cím, értékelés,
 *  közösségi, leírás, jó tudni) — vesszővel elválasztva; üresen az alap sorrend. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_hero_order" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_hero_order";`))
}
