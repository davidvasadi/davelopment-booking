import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Import-összesítő mezők (pl. Salonic guest-export) — ld. Customers.ts "Import-összesítő"
 *  collapsible szekció. Guest-szintű élettartam-aggregátumok, amiket a per-vendég látogatás-
 *  naplót NEM tartalmazó exportokból lehet megőrizni (csak az első+utolsó látogatás kerül
 *  valódi `bookings` sorként be, a köztes szám csak itt él). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "visit_count" numeric;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cancellation_count" numeric;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "no_show_count" numeric;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_cancellation_reason" varchar;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "total_revenue_huf" numeric;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "visit_count";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "cancellation_count";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "no_show_count";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "last_cancellation_reason";
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "total_revenue_huf";
  `))
}
