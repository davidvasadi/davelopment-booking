import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A `Services.category` mező mostantól opcionális a Payload-kollekcióban (lásd Services.ts) —
 * de az adott oszlopon még mindig a régi NOT NULL megszorítás fut az adatbázisban (a
 * `required: true` a séma első létrehozásakor SET NOT NULL-t generált), ezért egy kategória
 * nélküli szolgáltatás mentése (`category_id: null`) `23502`-es hibával elszállt volna.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "services" ALTER COLUMN "category_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "services" ALTER COLUMN "category_id" SET NOT NULL;
  `)
}
