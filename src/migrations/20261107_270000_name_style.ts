import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** A foglalóoldalon az üzlet nevének stílusa: félkövér / dőlt ('bold', 'italic' vesszővel) — a név maga jelölés nélkül
 *  marad (Google, e-mail, számla is ezt használja). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_name_style" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_name_style";`))
}
