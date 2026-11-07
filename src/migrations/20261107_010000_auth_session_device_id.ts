import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Aktív eszközök: böngészőnként egy sor. A böngésző az első belépéskor tartós, véletlen azonosítót kap egy sütiben
 * (`dav-device`); ugyanarról a böngészőről újra belépve a régi (még élő) munkamenete lezárul (lib/authSessions.ts).
 * A régi sorok `device_id` nélkül maradnak — azokat 7 nap után a lejárat, vagy a „Kijelentkezés mindenhol máshol” viszi.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "device_id" varchar;
    CREATE INDEX IF NOT EXISTS "auth_sessions_user_device_idx" ON "auth_sessions" ("user_id", "device_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP INDEX IF EXISTS "auth_sessions_user_device_idx";
    ALTER TABLE "auth_sessions" DROP COLUMN IF EXISTS "device_id";
  `))
}
