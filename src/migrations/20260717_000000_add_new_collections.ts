import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Új collection-ök: memberships, audit_log, customers, email_log,
 * push_subscriptions, reviews, roles, shifts, waitlist.
 * Idempotens (IF NOT EXISTS) — lokálon és szerveren egyaránt biztonságos.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

  -- ROLES
  CREATE TABLE IF NOT EXISTS "roles" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "salon_id" integer,
    "restaurant_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "roles_capabilities" (
    "id" serial PRIMARY KEY NOT NULL,
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "value" varchar
  );
  CREATE INDEX IF NOT EXISTS "roles_salon_idx" ON "roles" USING btree ("salon_id");
  CREATE INDEX IF NOT EXISTS "roles_restaurant_idx" ON "roles" USING btree ("restaurant_id");
  DO $$ BEGIN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "roles_capabilities" ADD CONSTRAINT "roles_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- MEMBERSHIPS
  CREATE TABLE IF NOT EXISTS "memberships" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "email" varchar,
    "name" varchar,
    "salon_id" integer,
    "restaurant_id" integer,
    "role" varchar,
    "custom_role_id" integer,
    "status" varchar DEFAULT 'invited',
    "invite_token" varchar,
    "position" varchar,
    "avatar_id" integer,
    "phone" varchar,
    "birthday" timestamp(3) with time zone,
    "address" varchar,
    "tax_id" varchar,
    "emergency_contact" varchar,
    "join_date" timestamp(3) with time zone,
    "weekly_hours" numeric,
    "pay_type" varchar,
    "pay_rate" numeric,
    "tip_eligible" boolean DEFAULT false,
    "salary" numeric,
    "bio" text,
    "suspended_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "memberships_position_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "position" varchar,
    "changed_at" timestamp(3) with time zone
  );
  CREATE TABLE IF NOT EXISTS "memberships_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "label" varchar,
    "file_id" integer
  );
  CREATE INDEX IF NOT EXISTS "memberships_user_idx" ON "memberships" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "memberships_salon_idx" ON "memberships" USING btree ("salon_id");
  CREATE INDEX IF NOT EXISTS "memberships_restaurant_idx" ON "memberships" USING btree ("restaurant_id");
  CREATE INDEX IF NOT EXISTS "memberships_status_idx" ON "memberships" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "memberships_invite_token_idx" ON "memberships" USING btree ("invite_token");
  DO $$ BEGIN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_custom_role_id_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "memberships_position_history" ADD CONSTRAINT "memberships_position_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "memberships_documents" ADD CONSTRAINT "memberships_documents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- AUDIT LOG
  CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" serial PRIMARY KEY NOT NULL,
    "actor_id" integer,
    "actor_label" varchar,
    "actor_email" varchar,
    "action" varchar,
    "collection_name" varchar,
    "doc_id" varchar,
    "summary" varchar,
    "changes" jsonb,
    "salon_id" integer,
    "restaurant_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX IF NOT EXISTS "audit_log_salon_idx" ON "audit_log" USING btree ("salon_id");
  CREATE INDEX IF NOT EXISTS "audit_log_restaurant_idx" ON "audit_log" USING btree ("restaurant_id");
  DO $$ BEGIN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- CUSTOMERS
  CREATE TABLE IF NOT EXISTS "customers" (
    "id" serial PRIMARY KEY NOT NULL,
    "restaurant_id" integer,
    "salon_id" integer,
    "customer_name" varchar,
    "customer_email" varchar,
    "customer_phone" varchar,
    "notes" text,
    "match_index" varchar,
    "blocked" boolean DEFAULT false,
    "block_reason" varchar,
    "blocked_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "customers_restaurant_idx" ON "customers" USING btree ("restaurant_id");
  CREATE INDEX IF NOT EXISTS "customers_salon_idx" ON "customers" USING btree ("salon_id");
  DO $$ BEGIN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- EMAIL LOG
  CREATE TABLE IF NOT EXISTS "email_log" (
    "id" serial PRIMARY KEY NOT NULL,
    "type" varchar,
    "to" varchar,
    "subject" varchar,
    "ok" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "email_log_ok_idx" ON "email_log" USING btree ("ok");

  -- PUSH SUBSCRIPTIONS
  CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "endpoint" varchar NOT NULL,
    "p256dh" varchar NOT NULL,
    "auth" varchar NOT NULL,
    "user_agent" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
  );
  CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
  DO $$ BEGIN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- REVIEWS
  CREATE TABLE IF NOT EXISTS "reviews" (
    "id" serial PRIMARY KEY NOT NULL,
    "restaurant_id" integer,
    "salon_id" integer,
    "reservation_id" integer,
    "booking_id" integer,
    "rating" numeric,
    "comment" text,
    "customer_name" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "reviews_restaurant_idx" ON "reviews" USING btree ("restaurant_id");
  CREATE INDEX IF NOT EXISTS "reviews_salon_idx" ON "reviews" USING btree ("salon_id");
  DO $$ BEGIN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- SHIFTS
  CREATE TABLE IF NOT EXISTS "shifts" (
    "id" serial PRIMARY KEY NOT NULL,
    "staff_id" integer,
    "salon_id" integer,
    "member_id" integer,
    "restaurant_id" integer,
    "date" timestamp(3) with time zone NOT NULL,
    "type" varchar DEFAULT 'shift' NOT NULL,
    "start_time" varchar,
    "end_time" varchar,
    "hours" numeric,
    "note" varchar,
    "left_early_at" varchar,
    "left_early_reason" varchar,
    "owner_shift" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "shifts_staff_idx" ON "shifts" USING btree ("staff_id");
  CREATE INDEX IF NOT EXISTS "shifts_salon_idx" ON "shifts" USING btree ("salon_id");
  CREATE INDEX IF NOT EXISTS "shifts_restaurant_idx" ON "shifts" USING btree ("restaurant_id");
  DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  -- WAITLIST
  CREATE TABLE IF NOT EXISTS "waitlist" (
    "id" serial PRIMARY KEY NOT NULL,
    "restaurant_id" integer,
    "salon_id" integer,
    "date" varchar NOT NULL,
    "time" varchar NOT NULL,
    "pax" numeric,
    "customer_name" varchar NOT NULL,
    "customer_email" varchar NOT NULL,
    "customer_phone" varchar,
    "status" varchar DEFAULT 'waiting',
    "token" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "waitlist_restaurant_idx" ON "waitlist" USING btree ("restaurant_id");
  CREATE INDEX IF NOT EXISTS "waitlist_salon_idx" ON "waitlist" USING btree ("salon_id");
  DO $$ BEGIN
    ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "waitlist";
    DROP TABLE IF EXISTS "shifts";
    DROP TABLE IF EXISTS "reviews";
    DROP TABLE IF EXISTS "push_subscriptions";
    DROP TABLE IF EXISTS "email_log";
    DROP TABLE IF EXISTS "customers";
    DROP TABLE IF EXISTS "audit_log";
    DROP TABLE IF EXISTS "memberships_documents";
    DROP TABLE IF EXISTS "memberships_position_history";
    DROP TABLE IF EXISTS "memberships";
    DROP TABLE IF EXISTS "roles_capabilities";
    DROP TABLE IF EXISTS "roles";
  `)
}
