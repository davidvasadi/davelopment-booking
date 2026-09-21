import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A napi szünet eddig 1 db (kezdet, vég) pár volt `shifts.break_start/break_end` és
 * `staff.default_break_start/default_break_end` oszlopokon — mostantól TÖBB szünet is
 * megadható naponta (pl. ebéd + délutáni pihenő), ezért egy `jsonb` tömb (`breaks` /
 * `default_breaks`, `{start_time,end_time}[]`) váltja fel őket. A régi oszlopok szándékosan
 * MEGMARADNAK (expand-contract minta, ld. docs/operations/SERVER.md) — a meglévő adatot
 * egy 1-elemű tömbbé csomagoljuk, a tényleges DROP egy KÉSŐBBI migrációba kerül majd.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "breaks" jsonb;
  UPDATE "shifts" SET "breaks" = jsonb_build_array(jsonb_build_object('start_time', "break_start", 'end_time', "break_end"))
    WHERE "break_start" IS NOT NULL AND "break_end" IS NOT NULL AND "breaks" IS NULL;

  ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "default_breaks" jsonb;
  UPDATE "staff" SET "default_breaks" = jsonb_build_array(jsonb_build_object('start_time', "default_break_start", 'end_time', "default_break_end"))
    WHERE "default_break_start" IS NOT NULL AND "default_break_end" IS NOT NULL AND "default_breaks" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "shifts" DROP COLUMN IF EXISTS "breaks";
  ALTER TABLE "staff" DROP COLUMN IF EXISTS "default_breaks";
  `)
}
