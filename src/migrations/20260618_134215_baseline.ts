import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
  CREATE TYPE "public"."enum_users_role" AS ENUM('salon_owner', 'restaurant_owner', 'admin');
  CREATE TYPE "public"."enum_users_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_salons_supported_locales" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
  CREATE TYPE "public"."enum_services_currency" AS ENUM('HUF', 'EUR');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');
  CREATE TYPE "public"."enum_bookings_locale" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
  CREATE TYPE "public"."enum_availability_day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum_subscriptions_plan" AS ENUM('trial', 'paid');
  CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused');
  CREATE TYPE "public"."enum_restaurants_supported_locales" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
  CREATE TYPE "public"."enum_opening_hours_day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum_reservations_status" AS ENUM('pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled');
  CREATE TYPE "public"."enum_reservations_source" AS ENUM('online', 'walk_in', 'phone');
  CREATE TYPE "public"."enum_reservations_locale" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
  CREATE TYPE "public"."enum_notifications_audience" AS ENUM('owner', 'admin');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('new_booking', 'cancellation', 'new_signup', 'new_subscriber');
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"avatar_url" varchar,
  	"role" "enum_users_role" DEFAULT 'salon_owner' NOT NULL,
  	"salon_id" integer,
  	"restaurant_id" integer,
  	"last_active_business" varchar,
  	"status" "enum_users_status" DEFAULT 'active',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "salons_terms_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "salons_terms_sections_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "salons_good_to_know" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" varchar DEFAULT 'info'
  );
  
  CREATE TABLE "salons_good_to_know_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "salons_supported_locales" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_salons_supported_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "salons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"logo_id" integer,
  	"cover_image_id" integer,
  	"address" varchar,
  	"city" varchar,
  	"postal_code" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"website" varchar,
  	"booking_buffer_minutes" numeric DEFAULT 15,
  	"booking_window_days" numeric DEFAULT 60,
  	"require_phone" boolean DEFAULT true,
  	"notify_new_bookings" boolean DEFAULT true,
  	"email_show_phone" boolean DEFAULT true,
  	"email_contact_phone" varchar,
  	"email_show_email" boolean DEFAULT false,
  	"email_show_address" boolean DEFAULT false,
  	"email_show_directions" boolean DEFAULT false,
  	"email_directions_address" varchar,
  	"legal_name" varchar,
  	"tax_number" varchar,
  	"company_reg_number" varchar,
  	"registered_seat" varchar,
  	"is_active" boolean DEFAULT true,
  	"admin_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "salons_locales" (
  	"description" jsonb,
  	"booking_email_subject" varchar,
  	"booking_email_intro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "staff" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"salon_id" integer NOT NULL,
  	"avatar_id" integer,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "staff_locales" (
  	"bio" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_id" integer NOT NULL,
  	"subcategory_id" integer,
  	"image_id" integer,
  	"salon_id" integer NOT NULL,
  	"duration_minutes" numeric DEFAULT 60 NOT NULL,
  	"price" numeric NOT NULL,
  	"currency" "enum_services_currency" DEFAULT 'HUF',
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "services_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "services_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"staff_id" integer
  );
  
  CREATE TABLE "service_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"salon_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "service_categories_locales" (
  	"name" varchar NOT NULL,
  	"duration_label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"salon_id" integer NOT NULL,
  	"service_id" integer NOT NULL,
  	"staff_id" integer NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"customer_phone" varchar,
  	"date" varchar NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'pending' NOT NULL,
  	"notes" varchar,
  	"cancellation_token" varchar,
  	"locale" "enum_bookings_locale" DEFAULT 'hu',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "availability" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"salon_id" integer NOT NULL,
  	"staff_id" integer,
  	"day_of_week" "enum_availability_day_of_week" NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"is_available" boolean DEFAULT true,
  	"recurring" boolean DEFAULT true,
  	"exception_date" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
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
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_small_url" varchar,
  	"sizes_small_width" numeric,
  	"sizes_small_height" numeric,
  	"sizes_small_mime_type" varchar,
  	"sizes_small_filesize" numeric,
  	"sizes_small_filename" varchar,
  	"sizes_medium_url" varchar,
  	"sizes_medium_width" numeric,
  	"sizes_medium_height" numeric,
  	"sizes_medium_mime_type" varchar,
  	"sizes_medium_filesize" numeric,
  	"sizes_medium_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar
  );
  
  CREATE TABLE "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"plan" "enum_subscriptions_plan" DEFAULT 'trial' NOT NULL,
  	"status" "enum_subscriptions_status" DEFAULT 'trialing' NOT NULL,
  	"salon_count" numeric DEFAULT 0,
  	"restaurant_count" numeric DEFAULT 0,
  	"breakdown" varchar,
  	"trial_ends_at" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"cancel_at_period_end" boolean DEFAULT false,
  	"amount_huf" numeric DEFAULT 0,
  	"stripe_customer_id" varchar,
  	"stripe_subscription_id" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "restaurants_terms_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "restaurants_terms_sections_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "restaurants_good_to_know" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" varchar DEFAULT 'info'
  );
  
  CREATE TABLE "restaurants_good_to_know_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "restaurants_supported_locales" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_restaurants_supported_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "restaurants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"city" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"website" varchar,
  	"cover_image_id" integer,
  	"logo_id" integer,
  	"turn_duration_minutes" numeric DEFAULT 120,
  	"slot_step_minutes" numeric DEFAULT 30,
  	"last_seating_buffer_minutes" numeric DEFAULT 0,
  	"lead_time_hours" numeric DEFAULT 2,
  	"booking_window_days" numeric DEFAULT 60,
  	"require_phone" boolean DEFAULT true,
  	"notify_new_bookings" boolean DEFAULT true,
  	"email_show_phone" boolean DEFAULT true,
  	"email_contact_phone" varchar,
  	"email_show_email" boolean DEFAULT false,
  	"email_show_address" boolean DEFAULT false,
  	"email_show_directions" boolean DEFAULT false,
  	"email_directions_address" varchar,
  	"legal_name" varchar,
  	"tax_number" varchar,
  	"company_reg_number" varchar,
  	"registered_seat" varchar,
  	"is_active" boolean DEFAULT true,
  	"admin_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "restaurants_locales" (
  	"description" varchar,
  	"booking_email_subject" varchar,
  	"booking_email_intro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "rooms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"is_outdoor" boolean DEFAULT false,
  	"is_active" boolean DEFAULT true,
  	"seasonal" boolean DEFAULT false,
  	"season_start" varchar,
  	"season_end" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tables" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"capacity" numeric DEFAULT 4 NOT NULL,
  	"room_id" integer,
  	"is_active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tables_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tables_id" integer
  );
  
  CREATE TABLE "opening_hours" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer NOT NULL,
  	"day_of_week" "enum_opening_hours_day_of_week" NOT NULL,
  	"is_open" boolean DEFAULT true,
  	"open_time" varchar,
  	"close_time" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_hours_exceptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer NOT NULL,
  	"label" varchar,
  	"start_date" varchar NOT NULL,
  	"end_date" varchar NOT NULL,
  	"is_closed" boolean DEFAULT true,
  	"open_time" varchar,
  	"close_time" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reservations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer NOT NULL,
  	"date" varchar NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"pax" numeric DEFAULT 2 NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_email" varchar,
  	"customer_phone" varchar,
  	"country" varchar,
  	"notes" varchar,
  	"internal_notes" varchar,
  	"is_birthday" boolean DEFAULT false,
  	"status" "enum_reservations_status" DEFAULT 'confirmed' NOT NULL,
  	"source" "enum_reservations_source" DEFAULT 'online' NOT NULL,
  	"cancel_token" varchar,
  	"locale" "enum_reservations_locale" DEFAULT 'hu',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reservations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tables_id" integer
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"restaurant_id" integer,
  	"salon_id" integer,
  	"audience" "enum_notifications_audience" DEFAULT 'owner' NOT NULL,
  	"type" "enum_notifications_type" NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"read" boolean DEFAULT false,
  	"reservation_id" integer,
  	"booking_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"salons_id" integer,
  	"staff_id" integer,
  	"services_id" integer,
  	"service_categories_id" integer,
  	"bookings_id" integer,
  	"availability_id" integer,
  	"media_id" integer,
  	"subscriptions_id" integer,
  	"restaurants_id" integer,
  	"rooms_id" integer,
  	"tables_id" integer,
  	"opening_hours_id" integer,
  	"opening_hours_exceptions_id" integer,
  	"reservations_id" integer,
  	"notifications_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pricing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"salon_pro_huf" numeric DEFAULT 2900 NOT NULL,
  	"restaurant_pro_huf" numeric DEFAULT 9900 NOT NULL,
  	"trial_days" numeric DEFAULT 14 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD CONSTRAINT "users_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salons_terms_sections" ADD CONSTRAINT "salons_terms_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salons_terms_sections_locales" ADD CONSTRAINT "salons_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salons_good_to_know" ADD CONSTRAINT "salons_good_to_know_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salons_good_to_know_locales" ADD CONSTRAINT "salons_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salons_supported_locales" ADD CONSTRAINT "salons_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salons" ADD CONSTRAINT "salons_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salons" ADD CONSTRAINT "salons_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salons" ADD CONSTRAINT "salons_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salons_locales" ADD CONSTRAINT "salons_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "staff" ADD CONSTRAINT "staff_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "staff" ADD CONSTRAINT "staff_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "staff_locales" ADD CONSTRAINT "staff_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_subcategory_id_service_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_locales" ADD CONSTRAINT "services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_categories_locales" ADD CONSTRAINT "service_categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "availability" ADD CONSTRAINT "availability_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "availability" ADD CONSTRAINT "availability_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants_terms_sections" ADD CONSTRAINT "restaurants_terms_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants_terms_sections_locales" ADD CONSTRAINT "restaurants_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants_good_to_know" ADD CONSTRAINT "restaurants_good_to_know_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants_good_to_know_locales" ADD CONSTRAINT "restaurants_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants_supported_locales" ADD CONSTRAINT "restaurants_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants_locales" ADD CONSTRAINT "restaurants_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rooms" ADD CONSTRAINT "rooms_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tables" ADD CONSTRAINT "tables_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tables_rels" ADD CONSTRAINT "tables_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tables_rels" ADD CONSTRAINT "tables_rels_tables_fk" FOREIGN KEY ("tables_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_hours_exceptions" ADD CONSTRAINT "opening_hours_exceptions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations_rels" ADD CONSTRAINT "reservations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reservations_rels" ADD CONSTRAINT "reservations_rels_tables_fk" FOREIGN KEY ("tables_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_salons_fk" FOREIGN KEY ("salons_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_categories_fk" FOREIGN KEY ("service_categories_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_availability_fk" FOREIGN KEY ("availability_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_restaurants_fk" FOREIGN KEY ("restaurants_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rooms_fk" FOREIGN KEY ("rooms_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tables_fk" FOREIGN KEY ("tables_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_hours_fk" FOREIGN KEY ("opening_hours_id") REFERENCES "public"."opening_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_hours_exceptions_fk" FOREIGN KEY ("opening_hours_exceptions_id") REFERENCES "public"."opening_hours_exceptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reservations_fk" FOREIGN KEY ("reservations_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_salon_idx" ON "users" USING btree ("salon_id");
  CREATE INDEX "users_restaurant_idx" ON "users" USING btree ("restaurant_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "salons_terms_sections_order_idx" ON "salons_terms_sections" USING btree ("_order");
  CREATE INDEX "salons_terms_sections_parent_id_idx" ON "salons_terms_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "salons_terms_sections_locales_locale_parent_id_unique" ON "salons_terms_sections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "salons_good_to_know_order_idx" ON "salons_good_to_know" USING btree ("_order");
  CREATE INDEX "salons_good_to_know_parent_id_idx" ON "salons_good_to_know" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "salons_good_to_know_locales_locale_parent_id_unique" ON "salons_good_to_know_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "salons_supported_locales_order_idx" ON "salons_supported_locales" USING btree ("order");
  CREATE INDEX "salons_supported_locales_parent_idx" ON "salons_supported_locales" USING btree ("parent_id");
  CREATE UNIQUE INDEX "salons_slug_idx" ON "salons" USING btree ("slug");
  CREATE INDEX "salons_owner_idx" ON "salons" USING btree ("owner_id");
  CREATE INDEX "salons_logo_idx" ON "salons" USING btree ("logo_id");
  CREATE INDEX "salons_cover_image_idx" ON "salons" USING btree ("cover_image_id");
  CREATE INDEX "salons_updated_at_idx" ON "salons" USING btree ("updated_at");
  CREATE INDEX "salons_created_at_idx" ON "salons" USING btree ("created_at");
  CREATE UNIQUE INDEX "salons_locales_locale_parent_id_unique" ON "salons_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "staff_salon_idx" ON "staff" USING btree ("salon_id");
  CREATE INDEX "staff_avatar_idx" ON "staff" USING btree ("avatar_id");
  CREATE INDEX "staff_updated_at_idx" ON "staff" USING btree ("updated_at");
  CREATE INDEX "staff_created_at_idx" ON "staff" USING btree ("created_at");
  CREATE UNIQUE INDEX "staff_locales_locale_parent_id_unique" ON "staff_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id");
  CREATE INDEX "services_subcategory_idx" ON "services" USING btree ("subcategory_id");
  CREATE INDEX "services_image_idx" ON "services" USING btree ("image_id");
  CREATE INDEX "services_salon_idx" ON "services" USING btree ("salon_id");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE UNIQUE INDEX "services_locales_locale_parent_id_unique" ON "services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "services_rels_order_idx" ON "services_rels" USING btree ("order");
  CREATE INDEX "services_rels_parent_idx" ON "services_rels" USING btree ("parent_id");
  CREATE INDEX "services_rels_path_idx" ON "services_rels" USING btree ("path");
  CREATE INDEX "services_rels_staff_id_idx" ON "services_rels" USING btree ("staff_id");
  CREATE INDEX "service_categories_image_idx" ON "service_categories" USING btree ("image_id");
  CREATE INDEX "service_categories_salon_idx" ON "service_categories" USING btree ("salon_id");
  CREATE INDEX "service_categories_updated_at_idx" ON "service_categories" USING btree ("updated_at");
  CREATE INDEX "service_categories_created_at_idx" ON "service_categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "service_categories_locales_locale_parent_id_unique" ON "service_categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "bookings_salon_idx" ON "bookings" USING btree ("salon_id");
  CREATE INDEX "bookings_service_idx" ON "bookings" USING btree ("service_id");
  CREATE INDEX "bookings_staff_idx" ON "bookings" USING btree ("staff_id");
  CREATE INDEX "bookings_cancellation_token_idx" ON "bookings" USING btree ("cancellation_token");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "availability_salon_idx" ON "availability" USING btree ("salon_id");
  CREATE INDEX "availability_staff_idx" ON "availability" USING btree ("staff_id");
  CREATE INDEX "availability_updated_at_idx" ON "availability" USING btree ("updated_at");
  CREATE INDEX "availability_created_at_idx" ON "availability" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_small_sizes_small_filename_idx" ON "media" USING btree ("sizes_small_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE UNIQUE INDEX "subscriptions_owner_idx" ON "subscriptions" USING btree ("owner_id");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX "restaurants_terms_sections_order_idx" ON "restaurants_terms_sections" USING btree ("_order");
  CREATE INDEX "restaurants_terms_sections_parent_id_idx" ON "restaurants_terms_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "restaurants_terms_sections_locales_locale_parent_id_unique" ON "restaurants_terms_sections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "restaurants_good_to_know_order_idx" ON "restaurants_good_to_know" USING btree ("_order");
  CREATE INDEX "restaurants_good_to_know_parent_id_idx" ON "restaurants_good_to_know" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "restaurants_good_to_know_locales_locale_parent_id_unique" ON "restaurants_good_to_know_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "restaurants_supported_locales_order_idx" ON "restaurants_supported_locales" USING btree ("order");
  CREATE INDEX "restaurants_supported_locales_parent_idx" ON "restaurants_supported_locales" USING btree ("parent_id");
  CREATE UNIQUE INDEX "restaurants_slug_idx" ON "restaurants" USING btree ("slug");
  CREATE INDEX "restaurants_owner_idx" ON "restaurants" USING btree ("owner_id");
  CREATE INDEX "restaurants_cover_image_idx" ON "restaurants" USING btree ("cover_image_id");
  CREATE INDEX "restaurants_logo_idx" ON "restaurants" USING btree ("logo_id");
  CREATE INDEX "restaurants_updated_at_idx" ON "restaurants" USING btree ("updated_at");
  CREATE INDEX "restaurants_created_at_idx" ON "restaurants" USING btree ("created_at");
  CREATE UNIQUE INDEX "restaurants_locales_locale_parent_id_unique" ON "restaurants_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "rooms_restaurant_idx" ON "rooms" USING btree ("restaurant_id");
  CREATE INDEX "rooms_updated_at_idx" ON "rooms" USING btree ("updated_at");
  CREATE INDEX "rooms_created_at_idx" ON "rooms" USING btree ("created_at");
  CREATE INDEX "tables_restaurant_idx" ON "tables" USING btree ("restaurant_id");
  CREATE INDEX "tables_room_idx" ON "tables" USING btree ("room_id");
  CREATE INDEX "tables_updated_at_idx" ON "tables" USING btree ("updated_at");
  CREATE INDEX "tables_created_at_idx" ON "tables" USING btree ("created_at");
  CREATE INDEX "tables_rels_order_idx" ON "tables_rels" USING btree ("order");
  CREATE INDEX "tables_rels_parent_idx" ON "tables_rels" USING btree ("parent_id");
  CREATE INDEX "tables_rels_path_idx" ON "tables_rels" USING btree ("path");
  CREATE INDEX "tables_rels_tables_id_idx" ON "tables_rels" USING btree ("tables_id");
  CREATE INDEX "opening_hours_restaurant_idx" ON "opening_hours" USING btree ("restaurant_id");
  CREATE INDEX "opening_hours_updated_at_idx" ON "opening_hours" USING btree ("updated_at");
  CREATE INDEX "opening_hours_created_at_idx" ON "opening_hours" USING btree ("created_at");
  CREATE INDEX "opening_hours_exceptions_restaurant_idx" ON "opening_hours_exceptions" USING btree ("restaurant_id");
  CREATE INDEX "opening_hours_exceptions_updated_at_idx" ON "opening_hours_exceptions" USING btree ("updated_at");
  CREATE INDEX "opening_hours_exceptions_created_at_idx" ON "opening_hours_exceptions" USING btree ("created_at");
  CREATE INDEX "reservations_restaurant_idx" ON "reservations" USING btree ("restaurant_id");
  CREATE INDEX "reservations_updated_at_idx" ON "reservations" USING btree ("updated_at");
  CREATE INDEX "reservations_created_at_idx" ON "reservations" USING btree ("created_at");
  CREATE INDEX "reservations_rels_order_idx" ON "reservations_rels" USING btree ("order");
  CREATE INDEX "reservations_rels_parent_idx" ON "reservations_rels" USING btree ("parent_id");
  CREATE INDEX "reservations_rels_path_idx" ON "reservations_rels" USING btree ("path");
  CREATE INDEX "reservations_rels_tables_id_idx" ON "reservations_rels" USING btree ("tables_id");
  CREATE INDEX "notifications_restaurant_idx" ON "notifications" USING btree ("restaurant_id");
  CREATE INDEX "notifications_salon_idx" ON "notifications" USING btree ("salon_id");
  CREATE INDEX "notifications_audience_idx" ON "notifications" USING btree ("audience");
  CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");
  CREATE INDEX "notifications_reservation_idx" ON "notifications" USING btree ("reservation_id");
  CREATE INDEX "notifications_booking_idx" ON "notifications" USING btree ("booking_id");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_salons_id_idx" ON "payload_locked_documents_rels" USING btree ("salons_id");
  CREATE INDEX "payload_locked_documents_rels_staff_id_idx" ON "payload_locked_documents_rels" USING btree ("staff_id");
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_service_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("service_categories_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_availability_id_idx" ON "payload_locked_documents_rels" USING btree ("availability_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_restaurants_id_idx" ON "payload_locked_documents_rels" USING btree ("restaurants_id");
  CREATE INDEX "payload_locked_documents_rels_rooms_id_idx" ON "payload_locked_documents_rels" USING btree ("rooms_id");
  CREATE INDEX "payload_locked_documents_rels_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("tables_id");
  CREATE INDEX "payload_locked_documents_rels_opening_hours_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_hours_id");
  CREATE INDEX "payload_locked_documents_rels_opening_hours_exceptions_i_idx" ON "payload_locked_documents_rels" USING btree ("opening_hours_exceptions_id");
  CREATE INDEX "payload_locked_documents_rels_reservations_id_idx" ON "payload_locked_documents_rels" USING btree ("reservations_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users" CASCADE;
  DROP TABLE "salons_terms_sections" CASCADE;
  DROP TABLE "salons_terms_sections_locales" CASCADE;
  DROP TABLE "salons_good_to_know" CASCADE;
  DROP TABLE "salons_good_to_know_locales" CASCADE;
  DROP TABLE "salons_supported_locales" CASCADE;
  DROP TABLE "salons" CASCADE;
  DROP TABLE "salons_locales" CASCADE;
  DROP TABLE "staff" CASCADE;
  DROP TABLE "staff_locales" CASCADE;
  DROP TABLE "services" CASCADE;
  DROP TABLE "services_locales" CASCADE;
  DROP TABLE "services_rels" CASCADE;
  DROP TABLE "service_categories" CASCADE;
  DROP TABLE "service_categories_locales" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "availability" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "restaurants_terms_sections" CASCADE;
  DROP TABLE "restaurants_terms_sections_locales" CASCADE;
  DROP TABLE "restaurants_good_to_know" CASCADE;
  DROP TABLE "restaurants_good_to_know_locales" CASCADE;
  DROP TABLE "restaurants_supported_locales" CASCADE;
  DROP TABLE "restaurants" CASCADE;
  DROP TABLE "restaurants_locales" CASCADE;
  DROP TABLE "rooms" CASCADE;
  DROP TABLE "tables" CASCADE;
  DROP TABLE "tables_rels" CASCADE;
  DROP TABLE "opening_hours" CASCADE;
  DROP TABLE "opening_hours_exceptions" CASCADE;
  DROP TABLE "reservations" CASCADE;
  DROP TABLE "reservations_rels" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "pricing_settings" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_salons_supported_locales";
  DROP TYPE "public"."enum_services_currency";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_bookings_locale";
  DROP TYPE "public"."enum_availability_day_of_week";
  DROP TYPE "public"."enum_subscriptions_plan";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_restaurants_supported_locales";
  DROP TYPE "public"."enum_opening_hours_day_of_week";
  DROP TYPE "public"."enum_reservations_status";
  DROP TYPE "public"."enum_reservations_source";
  DROP TYPE "public"."enum_reservations_locale";
  DROP TYPE "public"."enum_notifications_audience";
  DROP TYPE "public"."enum_notifications_type";`)
}
