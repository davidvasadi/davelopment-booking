import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Marketing (design 13.4 „Kinek megy”): a kampány célközönségének szegmensei (`all`, `regular`, `lapsed`, `birthday`,
 * `company` — vesszővel), hogy a kiküldött kampány „Kinek ment ki” sora és a piszkozat visszatöltése is ezt mutassa.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "audience" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "audience";`))
}
