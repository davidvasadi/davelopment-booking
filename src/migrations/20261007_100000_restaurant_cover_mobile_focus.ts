import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** `restaurants.cover_focal_mobile_x/y` — külön mobil fókuszpont a borítóképhez (NULL = a
 *  desktop fókusz), ugyanaz, mint a szalonnál (20261006_130000). A többi foglalóoldal-mező a
 *  közös `booking_rules` csoport miatt az étterem táblán már létezik. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "cover_focal_mobile_x" numeric,
  ADD COLUMN IF NOT EXISTS "cover_focal_mobile_y" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "restaurants"
  DROP COLUMN IF EXISTS "cover_focal_mobile_x",
  DROP COLUMN IF EXISTS "cover_focal_mobile_y";`)
}
