import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `tasks` collection (napi teendők) — a hely áttekintő-kártyájához. Idempotens (IF NOT EXISTS),
 * mert fejlesztésben a Payload `push` már létrehozhatta a táblát; így lokálon és a szerveren
 * is biztonságosan lefut. A generált differ a nem-rögzített baseline miatt a teljes sémát
 * kiírta volna — csak a Tasks-hoz tartozó rész maradt meg, kézzel tisztítva.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "tasks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer,
  	"salon_id" integer,
  	"title" varchar NOT NULL,
  	"done" boolean DEFAULT false,
  	"due_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DO $$ BEGIN
   ALTER TABLE "tasks" ADD CONSTRAINT "tasks_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
   ALTER TABLE "tasks" ADD CONSTRAINT "tasks_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "tasks_restaurant_idx" ON "tasks" USING btree ("restaurant_id");
  CREATE INDEX IF NOT EXISTS "tasks_salon_idx" ON "tasks" USING btree ("salon_id");
  CREATE INDEX IF NOT EXISTS "tasks_done_idx" ON "tasks" USING btree ("done");
  CREATE INDEX IF NOT EXISTS "tasks_updated_at_idx" ON "tasks" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "tasks_created_at_idx" ON "tasks" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tasks_id" integer;

  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tasks_fk" FOREIGN KEY ("tasks_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tasks_id_idx" ON "payload_locked_documents_rels" USING btree ("tasks_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tasks_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_tasks_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "tasks_id";
  DROP TABLE IF EXISTS "tasks";
  `)
}
