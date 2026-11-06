import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Marketing: a kampány többnyelvű változatai (`{ en: { subject, blocks }, de: … }`) — a magyar a fő mezőkben
 * (`subject`, `blocks_json`) marad; a vendég a foglaláskor választott nyelvén kapja, fordítás nélkül magyarul.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "translations" jsonb;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "translations";`))
}
