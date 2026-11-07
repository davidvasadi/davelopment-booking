import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Helyben szerkesztés (design 21.6.3): a foglalás lépéseinek saját szövegei (címek, magyarázó sorok, gombok) nyelvenként —
 *  JSON: { szöveg-kulcs: saját szöveg }; ami nincs benne, az alap szöveg marad. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}_locales" ADD COLUMN IF NOT EXISTS "public_page_texts" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}_locales" DROP COLUMN IF EXISTS "public_page_texts";`))
}
