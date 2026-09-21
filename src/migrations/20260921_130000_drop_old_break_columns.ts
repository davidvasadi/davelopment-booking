import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A `breaks`/`default_breaks` (jsonb tömb) mezők bevezetése óta (`20260921_120000_multi_breaks`)
 * a régi egyszeres `break_start`/`break_end`/`default_break_start`/`default_break_end` oszlopok
 * feleslegesek — az adatuk már át van másolva. Ez a "contract" lépés véglegesen törli őket
 * (nincs még élő előfizető, akinél ez kockázatos lenne — lásd docs/operations/SERVER.md
 * expand-contract mintája).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "shifts" DROP COLUMN IF EXISTS "break_start";
  ALTER TABLE "shifts" DROP COLUMN IF EXISTS "break_end";
  ALTER TABLE "staff" DROP COLUMN IF EXISTS "default_break_start";
  ALTER TABLE "staff" DROP COLUMN IF EXISTS "default_break_end";
  `)
}

// Nem visszafordítható (az oszlopok törlődnek) — ha mégis kellene, a `breaks`/`default_breaks`
// tömb első eleméből lehetne visszaállítani egy külön migrációval.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "break_start" varchar;
  ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "break_end" varchar;
  ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "default_break_start" varchar;
  ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "default_break_end" varchar;
  `)
}
