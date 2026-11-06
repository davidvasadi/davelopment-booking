import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Étterem online korlátai (design 16.21 / 16.22): terem online foglalható-e, online kiadható férőhely %, legkisebb /
 *  legnagyobb online létszám. A meglévő termek online foglalhatók maradnak, a kapacitás 100% (mint eddig). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "online_bookable" boolean DEFAULT true;
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "online_capacity_pct" numeric DEFAULT 100;
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "min_online_pax" numeric DEFAULT 1;
    ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "max_online_pax" numeric;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "rooms" DROP COLUMN IF EXISTS "online_bookable";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "online_capacity_pct";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "min_online_pax";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "max_online_pax";
  `))
}
