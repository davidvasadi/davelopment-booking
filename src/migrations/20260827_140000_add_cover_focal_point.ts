import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `cover_focal_x`/`cover_focal_y` (0-100%) a Salons/Restaurants táblákon — a borítókép
 * "áthelyezés" (Notion/Facebook-mintájú húzható fókuszpont) mentett pozíciója, `object-position`-
 * ként alkalmazva mindenhol, ahol a borítókép megjelenik. Alapértelmezett 50/50 = a korábbi,
 * mindig-középre-vágott viselkedés, tehát a meglévő szalonok/éttermek változatlanul jelennek meg.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "cover_focal_x" numeric DEFAULT 50;
ALTER TABLE "salons" ADD COLUMN "cover_focal_y" numeric DEFAULT 50;
ALTER TABLE "restaurants" ADD COLUMN "cover_focal_x" numeric DEFAULT 50;
ALTER TABLE "restaurants" ADD COLUMN "cover_focal_y" numeric DEFAULT 50;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "cover_focal_x";
ALTER TABLE "salons" DROP COLUMN "cover_focal_y";
ALTER TABLE "restaurants" DROP COLUMN "cover_focal_x";
ALTER TABLE "restaurants" DROP COLUMN "cover_focal_y";`)
}
