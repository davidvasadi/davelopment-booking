import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Az utalvány-típus sablonja: a jegy formája (`card_layout`) és a színe (`card_color`). Ha van kép, az a háttér. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" ADD COLUMN IF NOT EXISTS "card_layout" varchar; ALTER TABLE "gift_voucher_types" ADD COLUMN IF NOT EXISTS "card_color" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" DROP COLUMN IF EXISTS "card_layout"; ALTER TABLE "gift_voucher_types" DROP COLUMN IF EXISTS "card_color";`))
}
