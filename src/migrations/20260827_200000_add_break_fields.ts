import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Napi szünet funkció: a `staff.default_break_start`/`default_break_end` a munkatárs saját alap-
 * beállítása ("mindig 12:00–13:00"), amit a beosztás-automatizáló (`scheduleAutofill.ts`) minden
 * napra automatikusan ráír a `shifts.break_start`/`break_end`-re — ez utóbbi a NAPI, ténylegesen
 * érvényes szünet, amit a Naptár/Munkatársak nap-szerkesztőjében felül lehet írni egy adott napra
 * (ugyanaz az auto→kézi minta, mint a Műszak start/end idejénél).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "staff" ADD COLUMN "default_break_start" varchar;
ALTER TABLE "staff" ADD COLUMN "default_break_end" varchar;
ALTER TABLE "shifts" ADD COLUMN "break_start" varchar;
ALTER TABLE "shifts" ADD COLUMN "break_end" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "staff" DROP COLUMN "default_break_start";
ALTER TABLE "staff" DROP COLUMN "default_break_end";
ALTER TABLE "shifts" DROP COLUMN "break_start";
ALTER TABLE "shifts" DROP COLUMN "break_end";`)
}
