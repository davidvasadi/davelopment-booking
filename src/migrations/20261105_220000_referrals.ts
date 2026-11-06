import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ajánló program (roadmap 54, design 16.16 + 3.x): a fiók tulajdonosának ajánló kódja (`/r/<kód>` link, a megnyitások
 * száma), és az ajánlások (ki, kit, mikor, hol tart: regisztrált → előfizetett, a jutalom-hónapok jóváírása).
 * Nem Payload-kollekciók: csak a lib/referrals.ts éri el őket.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "referral_codes" (
      "user_id" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
      "code" varchar NOT NULL UNIQUE,
      "clicks" integer NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "referrals" (
      "id" serial PRIMARY KEY,
      "referrer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "referred_user_id" integer UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
      "referred_name" varchar,
      "code" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'registered',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "subscribed_at" timestamptz,
      "referred_credited_at" timestamptz,
      "referrer_credited_at" timestamptz
    );
    CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_user_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP TABLE IF EXISTS "referrals";
    DROP TABLE IF EXISTS "referral_codes";
  `))
}
