import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Értékelések (design 16.15): hova menjen az elégedett vendég (Google / TripAdvisor / Facebook), és a két új link. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "public"."enum_${t}_feature_modules_review_target" AS ENUM('google', 'tripadvisor', 'facebook');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "feature_modules_review_target" "enum_${t}_feature_modules_review_target" DEFAULT 'google';
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "feature_modules_tripadvisor_review_url" varchar;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "feature_modules_facebook_review_url" varchar;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "feature_modules_review_target";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "feature_modules_tripadvisor_review_url";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "feature_modules_facebook_review_url";
      DROP TYPE IF EXISTS "public"."enum_${t}_feature_modules_review_target";
    `))
  }
}
