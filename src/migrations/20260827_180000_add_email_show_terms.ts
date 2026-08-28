import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `email_show_terms` — a foglalási feltételek linkjének be/ki kapcsolása a visszaigazoló
 * emailben, FÜGGETLENÜL attól, hogy van-e egyáltalán megadva feltétel-szöveg. Eddig a link
 * automatikusan megjelent, ha `terms_sections` ki volt töltve — most explicit kapcsoló.
 * Alapértelmezett true, tehát a meglévő szalonok/éttermek viselkedése változatlan marad.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" ADD COLUMN "email_show_terms" boolean DEFAULT true;
ALTER TABLE "restaurants" ADD COLUMN "email_show_terms" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons" DROP COLUMN "email_show_terms";
ALTER TABLE "restaurants" DROP COLUMN "email_show_terms";`)
}
