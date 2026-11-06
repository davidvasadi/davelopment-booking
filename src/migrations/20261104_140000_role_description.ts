import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Beállítások › Csapat & jogok › Szerepek (design 16.3): a szerep rövid leírása (pl. „Foglalások és vendégek kezelése”). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "description" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "description";`))
}
