import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `booking_rules.require_address` + `require_address_note` — a cím-mező kötelezővé tétele
 * FÜGGETLENÜL az előlegtől (eddig a cím csak akkor volt kötelező/látható, ha vendég-előleg be
 * volt kapcsolva). Alapértelmezett false, tehát a meglévő szalonok/éttermek viselkedése
 * változatlan marad.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "booking_rules_require_address" boolean DEFAULT false;
ALTER TABLE "salons" ADD COLUMN "booking_rules_require_address_note" varchar;
ALTER TABLE "restaurants" ADD COLUMN "booking_rules_require_address" boolean DEFAULT false;
ALTER TABLE "restaurants" ADD COLUMN "booking_rules_require_address_note" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "booking_rules_require_address";
ALTER TABLE "salons" DROP COLUMN "booking_rules_require_address_note";
ALTER TABLE "restaurants" DROP COLUMN "booking_rules_require_address";
ALTER TABLE "restaurants" DROP COLUMN "booking_rules_require_address_note";`)
}
