import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `services_uncategorized_sort_order` a Salons táblán — UI-only rendezési hint, ami a dashboard
 * Szolgáltatások oldalán a "kategória nélküli" szolgáltatás-blokk pozícióját tárolja a valódi
 * kategória-kártyák között (drag & drop). NULL = mindig a lista végén (alapértelmezett).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "salons" ADD COLUMN "services_uncategorized_sort_order" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "salons" DROP COLUMN "services_uncategorized_sort_order";
  `)
}
