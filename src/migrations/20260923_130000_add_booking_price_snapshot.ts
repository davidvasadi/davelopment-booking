import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `price_snapshot`/`price_snapshot_currency` a `bookings` táblán — a szolgáltatás árának
 * pillanatfelvétele a foglalás létrehozásakor, hogy egy utólagos ár-változtatás NE írja át
 * visszamenőleg a korábbi foglalások bevételét (eddig minden statisztika a szolgáltatás
 * mindenkori aktuális árát olvasta élőben). A meglévő (mező bevezetése előtti) foglalásokat
 * egyszeri backfill-lel töltjük fel a szolgáltatás JELENLEGI árával — ez a legjobb elérhető
 * közelítés, hiszen a régi árat sosem tároltuk; innentől viszont a snapshot befagy.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "bookings" ADD COLUMN "price_snapshot" numeric;
ALTER TABLE "bookings" ADD COLUMN "price_snapshot_currency" varchar;

UPDATE "bookings" b
SET "price_snapshot" = s."price",
    "price_snapshot_currency" = COALESCE(s."currency", 'HUF')
FROM "services" s
WHERE b."service_id" = s."id"
  AND b."price_snapshot" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "bookings" DROP COLUMN "price_snapshot";
ALTER TABLE "bookings" DROP COLUMN "price_snapshot_currency";
  `)
}
