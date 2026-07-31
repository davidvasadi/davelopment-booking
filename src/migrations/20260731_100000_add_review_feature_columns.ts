import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "feature_modules_google_review_url" varchar,
      ADD COLUMN IF NOT EXISTS "feature_modules_review_delay_hours" numeric;

    ALTER TABLE "salons"
      ADD COLUMN IF NOT EXISTS "feature_modules_google_review_url" varchar,
      ADD COLUMN IF NOT EXISTS "feature_modules_review_delay_hours" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "feature_modules_google_review_url",
      DROP COLUMN IF EXISTS "feature_modules_review_delay_hours";

    ALTER TABLE "salons"
      DROP COLUMN IF EXISTS "feature_modules_google_review_url",
      DROP COLUMN IF EXISTS "feature_modules_review_delay_hours";
  `)
}
