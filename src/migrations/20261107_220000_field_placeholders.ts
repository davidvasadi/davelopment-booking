import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Helyben szerkesztés (design 21.6.3): a foglaló űrlap mezőinek saját helykitöltő szövege, nyelvenként (név, e-mail,
 *  cím, megjegyzés). Üresen az alap szöveg marad. */
const COLS = ['ph_name', 'ph_email', 'ph_address', 'ph_notes']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(COLS.map((f) => `ALTER TABLE "${t}_locales" ADD COLUMN IF NOT EXISTS "public_page_${f}" varchar;`).join('\n')))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(COLS.map((f) => `ALTER TABLE "${t}_locales" DROP COLUMN IF EXISTS "public_page_${f}";`).join('\n')))
  }
}
