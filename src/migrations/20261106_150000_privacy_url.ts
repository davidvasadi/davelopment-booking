import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A vállalkozó saját adatkezelési tájékoztatójának linkje (a foglalóoldalon a vendégnek, a süti-beállításokban). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "privacy_url" varchar;
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "privacy_url" varchar;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "privacy_url";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "privacy_url";
  `))
}
