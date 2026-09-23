import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `booking_rules.show_catalog_counts_on_public` — a szalon publikus foglaló-oldalának fejlécén
 * középen megjelenő "N Szolgáltatás | M Munkatárs" számláló ki-/bekapcsolása. Alapértelmezett
 * TRUE (a jelenlegi, mindig-látható viselkedés marad az alap). Az étterem táblán is létrejön az
 * oszlop a közös `booking_rules` csoport miatt, de ott sosem olvasódik/íródik.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "booking_rules_show_catalog_counts_on_public" boolean DEFAULT true;
ALTER TABLE "restaurants" ADD COLUMN "booking_rules_show_catalog_counts_on_public" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "booking_rules_show_catalog_counts_on_public";
ALTER TABLE "restaurants" DROP COLUMN "booking_rules_show_catalog_counts_on_public";`)
}
