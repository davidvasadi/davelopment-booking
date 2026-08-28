import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `sort_order` a `services` táblán — kategórián belüli, drag & drop-pal állítható megjelenítési
 * sorrend a Beállítások > Szolgáltatások oldalon (ugyanaz a minta, mint a `service_categories.
 * sort_order`-nél). Alapértelmezett 0 mindenkinél, a lekérdezés `sort: ['sort_order','name']` —
 * amíg egy cég nem rendez át semmit, a sorrend névsor szerinti marad, azaz a meglévő megjelenés
 * változatlan.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "services" ADD COLUMN "sort_order" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "services" DROP COLUMN "sort_order";`)
}
