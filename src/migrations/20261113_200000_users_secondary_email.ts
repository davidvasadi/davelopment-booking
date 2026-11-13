import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Másodlagos belépési e-mail (Saját profil › Belépés): kóddal megerősítve ezzel is be lehet lépni, és ha az elsődleges cím
 *  megszűnik, egy gombbal elsődlegessé tehető. Egy cím legfeljebb egy fióké lehet (egyedi index). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "secondary_email" varchar;`))
  await db.execute(sql.raw(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "secondary_email_verified_at" timestamp(3) with time zone;`))
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "users_secondary_email_idx" ON "users" (lower("secondary_email")) WHERE "secondary_email" IS NOT NULL;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`DROP INDEX IF EXISTS "users_secondary_email_idx";`))
  await db.execute(sql.raw(`ALTER TABLE "users" DROP COLUMN IF EXISTS "secondary_email_verified_at";`))
  await db.execute(sql.raw(`ALTER TABLE "users" DROP COLUMN IF EXISTS "secondary_email";`))
}
