import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Google-értékelések: kiválasztott Google-profil + a napi frissítés gyorsítótára. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "google_place_id" varchar,
        ADD COLUMN IF NOT EXISTS "google_place_name" varchar,
        ADD COLUMN IF NOT EXISTS "google_maps_url" varchar,
        ADD COLUMN IF NOT EXISTS "google_rating" numeric,
        ADD COLUMN IF NOT EXISTS "google_rating_count" numeric,
        ADD COLUMN IF NOT EXISTS "google_reviews" jsonb,
        ADD COLUMN IF NOT EXISTS "google_reviews_updated_at" timestamp(3) with time zone;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
        DROP COLUMN IF EXISTS "google_place_id",
        DROP COLUMN IF EXISTS "google_place_name",
        DROP COLUMN IF EXISTS "google_maps_url",
        DROP COLUMN IF EXISTS "google_rating",
        DROP COLUMN IF EXISTS "google_rating_count",
        DROP COLUMN IF EXISTS "google_reviews",
        DROP COLUMN IF EXISTS "google_reviews_updated_at";
    `))
  }
}
