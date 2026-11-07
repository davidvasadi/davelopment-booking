import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Helyben szerkesztés (design 21.6.3–21.6.4): a foglalóoldal új megjelenési beállításai a `public_page` csoportban —
 * a gomb betűszíne (hex), a leírás színe / mérete / mobilon teljes, a köszönő cím (nyelvenként) és színe —, és a
 * munkatársnál, hogy a pozíciója látszik-e a foglalásnál. Az alapértékekkel az oldal ugyanúgy néz ki, mint eddig.
 */
const TEXT = ['button_text_color', 'desc_color', 'desc_size', 'success_title_color']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    const parts = TEXT.map((f) => `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_${f}" varchar;`)
    parts.push(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_desc_full_mobile" boolean DEFAULT false;`)
    parts.push(`ALTER TABLE "${t}_locales" ADD COLUMN IF NOT EXISTS "public_page_success_title" varchar;`)
    await db.execute(sql.raw(parts.join('\n')))
  }
  await db.execute(sql.raw(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "show_role_title" boolean DEFAULT true;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    const parts = TEXT.map((f) => `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_${f}";`)
    parts.push(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_desc_full_mobile";`)
    parts.push(`ALTER TABLE "${t}_locales" DROP COLUMN IF EXISTS "public_page_success_title";`)
    await db.execute(sql.raw(parts.join('\n')))
  }
  await db.execute(sql.raw(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "show_role_title";`))
}
