import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `cover_zoom` a Salons/Restaurants táblákon — az Instagram-féle "húzd és nagyítsd" crop-minta
 * harmadik paramétere a fókuszpont (cover_focal_x/y) mellé. Alapértelmezett 1 = nincs extra
 * nagyítás (a mai, eddigi cover-viselkedés).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "cover_zoom" numeric DEFAULT 1;
ALTER TABLE "restaurants" ADD COLUMN "cover_zoom" numeric DEFAULT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "cover_zoom";
ALTER TABLE "restaurants" DROP COLUMN "cover_zoom";`)
}
