import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A szalon `description` mezője richText (jsonb) volt, de a dashboardon SOHA nem volt hozzá
 * szerkesztő (nulla más richText-mező van az egész appban) — a mező mindig üres/null volt
 * élesben (ellenőrizve). Egyszerű sima szöveggé (varchar) alakítjuk, mint az étteremé, hogy egy
 * sima textarea-val szerkeszthető legyen a dashboardon, rich-text-szerkesztő építése nélkül.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons_locales" ALTER COLUMN "description" TYPE varchar USING (description::text);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons_locales" ALTER COLUMN "description" TYPE jsonb USING (NULL);`)
}
