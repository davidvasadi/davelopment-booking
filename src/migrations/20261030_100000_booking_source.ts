import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Szalon-foglalás forrása (Online / Beeső / Telefon) — ugyanaz, mint az éttermi foglalásnál.
 *  A meglévő foglalások 'online'-t kapnak (nincs róluk adat). Egyúttal a hiányzó 'no_show'
 *  státusz-érték pótlása: a gyűjtemény és a szerkesztő panel kínálta, de az enumból hiányzott,
 *  így a „Nem jött meg” mentése adatbázis-hibára futott. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_bookings_source" AS ENUM('online', 'walk_in', 'phone');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "source" "enum_bookings_source" DEFAULT 'online' NOT NULL;
    ALTER TYPE "public"."enum_bookings_status" ADD VALUE IF NOT EXISTS 'no_show';
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // az enum-érték ('no_show') Postgresben nem vehető ki egyszerűen — a forrás-oszlop igen
  await db.execute(sql.raw(`
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "source";
    DROP TYPE IF EXISTS "public"."enum_bookings_source";
  `))
}
