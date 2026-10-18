import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Google API hívás-napló (biztonsági havi keret-számláláshoz) — lásd `src/lib/googleReviews.ts`
 * és `src/payload/collections/GoogleApiLog.ts`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "google_api_log" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "google_api_log_kind_idx" ON "google_api_log" USING btree ("kind");
    CREATE INDEX IF NOT EXISTS "google_api_log_created_at_idx" ON "google_api_log" USING btree ("created_at");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "google_api_log";`))
}
