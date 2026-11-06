import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Beállítások › Csapat & jogok (design 16.2) „Utolsó belépés” oszlopa: a felhasználó legutóbbi sikeres bejelentkezése
 * (a /api/auth/finalize tölti ki).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp(3) with time zone;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at";`))
}
