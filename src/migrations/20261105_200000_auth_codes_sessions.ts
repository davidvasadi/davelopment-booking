import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Belépés kóddal + aktív eszközök (design 3.1–3.3, 16.x Saját profil):
 *  - `auth_login_codes`: a 6 jegyű e-mailes kódok (csak a hash-ük), lejárat, próbálkozások, és regisztrációnál a
 *    fiók adatai (a kód beírásakor jön létre a fiók — a kód egyben az e-mail megerősítése);
 *  - `auth_sessions`: a bejelentkezések (eszközönként egy), a token `sid`-je ide mutat — innen látszik az eszközök
 *    listája, és innen lehet egy eszközt kijelentkeztetni.
 * Nem Payload-kollekciók: az adminban nincs dolguk, csak a lib/authCodes.ts és lib/authSessions.ts éri el őket.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "auth_login_codes" (
      "id" serial PRIMARY KEY,
      "email" varchar NOT NULL,
      "code_hash" varchar NOT NULL,
      "purpose" varchar NOT NULL,
      "data" jsonb,
      "attempts" integer NOT NULL DEFAULT 0,
      "expires_at" timestamptz NOT NULL,
      "used_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "auth_login_codes_email_idx" ON "auth_login_codes" ("email");
    CREATE TABLE IF NOT EXISTS "auth_sessions" (
      "id" varchar PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "device" varchar,
      "ip" varchar,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "last_seen_at" timestamptz NOT NULL DEFAULT now(),
      "expires_at" timestamptz NOT NULL,
      "revoked_at" timestamptz
    );
    CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP TABLE IF EXISTS "auth_sessions";
    DROP TABLE IF EXISTS "auth_login_codes";
  `))
}
