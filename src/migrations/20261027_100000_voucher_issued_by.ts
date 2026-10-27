import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Utalvány: ki állította ki (dashboard-felhasználó; üres = vendég online vásárlása), és új
 *  számla-státusz: 'skipped' — a kiállító szándékosan nem kért számlát (pl. pénztárgépből
 *  számláz, duplikáció elkerülése). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "gift_vouchers" ADD COLUMN IF NOT EXISTS "issued_by_id" integer;
    DO $$ BEGIN
      ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_issued_by_id_users_id_fk"
        FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "gift_vouchers_issued_by_idx" ON "gift_vouchers" USING btree ("issued_by_id");
    ALTER TYPE "public"."enum_gift_vouchers_invoice_status" ADD VALUE IF NOT EXISTS 'skipped';
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // az enum-érték (Postgres) nem vehető ki egyszerűen — az oszlop igen
  await db.execute(sql.raw(`
    ALTER TABLE "gift_vouchers" DROP CONSTRAINT IF EXISTS "gift_vouchers_issued_by_id_users_id_fk";
    DROP INDEX IF EXISTS "gift_vouchers_issued_by_idx";
    ALTER TABLE "gift_vouchers" DROP COLUMN IF EXISTS "issued_by_id";
  `))
}
