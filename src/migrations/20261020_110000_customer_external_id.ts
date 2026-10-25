import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Külső rendszer saját azonosítója (pl. Salonic "ID" oszlopa) — megbízhatóbb dedup-kulcs
 *  ismételt importnál, mint az email (ami hiányozhat/ismétlődhet), ld. Customers.ts. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_id" varchar;
    CREATE INDEX IF NOT EXISTS "customers_external_id_idx" ON "customers" ("external_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP INDEX IF EXISTS "customers_external_id_idx";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "external_id";
  `))
}
