import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A foglaló űrlap város-mezőjének saját helykitöltője, nyelvenként (a cím-mező másik fele). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}_locales" ADD COLUMN IF NOT EXISTS "public_page_ph_city" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}_locales" DROP COLUMN IF EXISTS "public_page_ph_city";`))
}
