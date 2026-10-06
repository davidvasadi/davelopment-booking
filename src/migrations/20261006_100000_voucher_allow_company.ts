import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Ajándékutalvány: a „Cégként vásárolok” opció ki/bekapcsolható (alapból bekapcsolva). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "voucher_settings_allow_company" boolean DEFAULT true;
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "voucher_settings_allow_company" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "voucher_settings_allow_company";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "voucher_settings_allow_company";
  `)
}
