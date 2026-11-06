import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Naptár nap-szerkesztő és „+ Beosztás” (design 11.5 / 11.6):
 * - `sick_notes`: táppénzes papír — nem nyilvános feltöltés (uploads-private/sick-notes), SickNotes collection;
 * - `shift_templates`: mentett beosztás-sablonok;
 * - `shifts.paid` (fizetett beteg / szabadság) és `shifts.sick_note_id`;
 * - `staff.annual_leave_days`, `memberships.annual_leave_days` (éves szabadság-keret).
 * A két új collection a Payload `payload_locked_documents_rels` táblájába is kap oszlopot (különben minden mentés 500 —
 * ld. 20261018_100000_google_api_log_locked_rels).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "sick_notes" (
      "id" serial PRIMARY KEY NOT NULL,
      "salon_id" integer,
      "restaurant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );
    DO $$ BEGIN
      ALTER TABLE "sick_notes" ADD CONSTRAINT "sick_notes_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "sick_notes" ADD CONSTRAINT "sick_notes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "sick_notes_salon_idx" ON "sick_notes" USING btree ("salon_id");
    CREATE INDEX IF NOT EXISTS "sick_notes_restaurant_idx" ON "sick_notes" USING btree ("restaurant_id");
    CREATE INDEX IF NOT EXISTS "sick_notes_updated_at_idx" ON "sick_notes" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "sick_notes_created_at_idx" ON "sick_notes" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "sick_notes_filename_idx" ON "sick_notes" USING btree ("filename");

    CREATE TABLE IF NOT EXISTS "shift_templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "salon_id" integer,
      "restaurant_id" integer,
      "start_time" varchar,
      "end_time" varchar,
      "breaks" jsonb,
      "days" jsonb,
      "people" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "shift_templates_salon_idx" ON "shift_templates" USING btree ("salon_id");
    CREATE INDEX IF NOT EXISTS "shift_templates_restaurant_idx" ON "shift_templates" USING btree ("restaurant_id");
    CREATE INDEX IF NOT EXISTS "shift_templates_updated_at_idx" ON "shift_templates" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "shift_templates_created_at_idx" ON "shift_templates" USING btree ("created_at");

    ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "paid" boolean DEFAULT false;
    ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "sick_note_id" integer;
    DO $$ BEGIN
      ALTER TABLE "shifts" ADD CONSTRAINT "shifts_sick_note_id_sick_notes_id_fk" FOREIGN KEY ("sick_note_id") REFERENCES "public"."sick_notes"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "shifts_sick_note_idx" ON "shifts" USING btree ("sick_note_id");

    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "annual_leave_days" numeric;
    ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "annual_leave_days" numeric;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sick_notes_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "shift_templates_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sick_notes_fk" FOREIGN KEY ("sick_notes_id") REFERENCES "public"."sick_notes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shift_templates_fk" FOREIGN KEY ("shift_templates_id") REFERENCES "public"."shift_templates"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sick_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("sick_notes_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_shift_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("shift_templates_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "shift_templates_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sick_notes_id";
    ALTER TABLE "memberships" DROP COLUMN IF EXISTS "annual_leave_days";
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "annual_leave_days";
    ALTER TABLE "shifts" DROP COLUMN IF EXISTS "sick_note_id";
    ALTER TABLE "shifts" DROP COLUMN IF EXISTS "paid";
    DROP TABLE IF EXISTS "shift_templates";
    DROP TABLE IF EXISTS "sick_notes";
  `))
}
