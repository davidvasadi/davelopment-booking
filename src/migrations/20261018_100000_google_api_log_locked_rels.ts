import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Hiányzó oszlop pótlása — az új `google_api_log` collection (20261014_100000) migrációja csak
 * magát a táblát hozta létre, a Payload saját belső `payload_locked_documents_rels` tábláját nem
 * bővítette ki a hozzá tartozó oszloppal. Enélkül MINDEN create/update a Payload admin
 * dokumentum-zárolás ellenőrzésénél "column google_api_log_id does not exist" 500-zal elszállt —
 * ez okozta, hogy a Google-profil kiválasztása nem működött élesben. Ugyanaz a buktató, mint a
 * 20260825_120000-es migrációnál (contact_messages/broadcast_log).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "google_api_log_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_google_api_log_fk" FOREIGN KEY ("google_api_log_id") REFERENCES "public"."google_api_log"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_google_api_log_id_idx" ON "payload_locked_documents_rels" USING btree ("google_api_log_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_google_api_log_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_google_api_log_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "google_api_log_id";
  `))
}
