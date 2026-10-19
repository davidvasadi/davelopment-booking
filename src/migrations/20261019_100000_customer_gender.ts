import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Vendég neme (demográfiai mező, pl. nő/férfi-szétválasztott árazáshoz) — ld. Customers.ts. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gender" varchar;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "gender";
  `))
}
