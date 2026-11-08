import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Az utalvány-típus sablonjának szövegszíne (`card_text`: 'light' | 'dark'; üres = a háttérhez igazodik). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" ADD COLUMN IF NOT EXISTS "card_text" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" DROP COLUMN IF EXISTS "card_text";`))
}
