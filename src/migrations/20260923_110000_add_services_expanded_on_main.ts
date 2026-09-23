import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `booking_rules.services_expanded_on_main` — csak a szalon publikus foglaló-widgetjén (ProfileCard
 * főnézete) van hatása: bekapcsolva a szolgáltatás-katalógus rögtön kibontva jelenik meg a
 * "Válassz szolgáltatást" gomb helyett. A közös `booking_rules` csoport miatt az étterem táblán
 * is létrejön az oszlop, de ott sosem olvasódik/íródik.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "booking_rules_services_expanded_on_main" boolean DEFAULT false;
ALTER TABLE "restaurants" ADD COLUMN "booking_rules_services_expanded_on_main" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "booking_rules_services_expanded_on_main";
ALTER TABLE "restaurants" DROP COLUMN "booking_rules_services_expanded_on_main";`)
}
