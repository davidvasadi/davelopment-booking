import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Számlázási mezők hozzáadása a salons és restaurants táblákhoz.
 * billing_email, billing_postal_code, billing_city, billing_street
 * Idempotens (DO $$ … EXCEPTION WHEN duplicate_column THEN null).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN ALTER TABLE "salons" ADD COLUMN "billing_email" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "salons" ADD COLUMN "billing_postal_code" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "salons" ADD COLUMN "billing_city" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "salons" ADD COLUMN "billing_street" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;

    DO $$ BEGIN ALTER TABLE "restaurants" ADD COLUMN "billing_email" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "restaurants" ADD COLUMN "billing_postal_code" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "restaurants" ADD COLUMN "billing_city" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "restaurants" ADD COLUMN "billing_street" varchar; EXCEPTION WHEN duplicate_column THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "billing_email";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "billing_postal_code";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "billing_city";
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "billing_street";

    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "billing_email";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "billing_postal_code";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "billing_city";
    ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "billing_street";
  `)
}
