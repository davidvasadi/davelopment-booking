import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Éles-egyeztetett séma-migráció (2026-08-23) — a src/migrations/ utolsó valódi snapshotja
 * 2026-07 közepéről való volt, miközben az élesen futó DB azóta (részben egy korábbi, akkor még
 * megbízhatónak hitt db:push-sal) néhány táblát MÁR megkapott, a kód viszont azóta jóval többet
 * fejlődött (RBAC, ajándékutalvány, vendég-előleg, natív értékelés, egyedi kérdések, hírlevél,
 * beleegyező nyilatkozat, stb.) migráció nélkül. Ez a fájl NEM a snapshothoz, hanem az ÉLES DB
 * tényleges, séma-only pg_dump-ból visszaállított másolatához (`schedulio_prod_mirror` lokálisan)
 * viszonyítva lett kiszámolva a Payload/drizzle `pushSchema` motorjával (`hasDataLoss:false`,
 * 0 figyelmeztetés) — így NEM próbál újra létrehozni már élő táblát/oszlopot.
 *
 * DOWN: mechanikus, legjobb-erőfeszítés visszafordítás (tábla/oszlop DROP, ahol az UP CREATE-elt).
 * Ahol az UP oszlopot/táblát TÖRÖLT, ott a DOWN nem állítja vissza automatikusan (lásd a
 * megjegyzéseket) — ez nincs bekötve az automata deploy/rollback folyamatba (az kizárólag a
 * `.next` buildet állítja vissza, DB-t nem), csak manuális, átgondolt visszaállításhoz kell.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
CREATE TYPE "public"."enum_salons_custom_questions_type" AS ENUM('text', 'yesno', 'select');
;
CREATE TYPE "public"."enum_salons_tier" AS ENUM('starter', 'pro', 'egyedi');
;
CREATE TYPE "public"."enum_salons_deposit_settings_type" AS ENUM('fixed', 'percent', 'per_pax');
;
CREATE TYPE "public"."enum_salons_deposit_settings_payment_gateway" AS ENUM('stripe', 'simplepay', 'none');
;
CREATE TYPE "public"."enum_salons_newsletter_settings_package" AS ENUM('none', 'ingyenes', 'alap', 'premium');
;
CREATE TYPE "public"."enum_salons_invoice_settings_invoice_provider" AS ENUM('szamlazz', 'billingo', 'none');
;
CREATE TYPE "public"."enum_shifts_type" AS ENUM('shift', 'leave', 'sick', 'vacation');
;
CREATE TYPE "public"."enum_shifts_left_early_reason" AS ENUM('sick', 'personal');
;
CREATE TYPE "public"."enum_bookings_payment_gateway" AS ENUM('stripe', 'simplepay', 'none');
;
CREATE TYPE "public"."enum_bookings_payment_status" AS ENUM('none', 'pending', 'paid', 'refunded', 'failed');
;
CREATE TYPE "public"."enum_bookings_invoice_status" AS ENUM('none', 'issued', 'failed');
;
CREATE TYPE "public"."enum_bookings_consent_accepted_via" AS ENUM('online', 'onsite');
;
CREATE TYPE "public"."enum_subscriptions_billing_cycle" AS ENUM('monthly', 'annual');
;
CREATE TYPE "public"."enum_restaurants_positions_level" AS ENUM('lead', 'staff');
;
CREATE TYPE "public"."enum_restaurants_custom_questions_type" AS ENUM('text', 'yesno', 'select');
;
CREATE TYPE "public"."enum_restaurants_tier" AS ENUM('starter', 'pro', 'egyedi');
;
CREATE TYPE "public"."enum_restaurants_deposit_settings_type" AS ENUM('fixed', 'percent', 'per_pax');
;
CREATE TYPE "public"."enum_restaurants_deposit_settings_payment_gateway" AS ENUM('stripe', 'simplepay', 'none');
;
CREATE TYPE "public"."enum_restaurants_newsletter_settings_package" AS ENUM('none', 'ingyenes', 'alap', 'premium');
;
CREATE TYPE "public"."enum_restaurants_invoice_settings_invoice_provider" AS ENUM('szamlazz', 'billingo', 'none');
;
CREATE TYPE "public"."enum_reservations_payment_gateway" AS ENUM('stripe', 'simplepay', 'none');
;
CREATE TYPE "public"."enum_reservations_payment_status" AS ENUM('none', 'pending', 'paid', 'refunded', 'failed');
;
CREATE TYPE "public"."enum_reservations_invoice_status" AS ENUM('none', 'issued', 'failed');
;
CREATE TYPE "public"."enum_reservations_consent_accepted_via" AS ENUM('online', 'onsite');
;
CREATE TYPE "public"."enum_waitlist_status" AS ENUM('waiting', 'notified', 'promoted', 'expired');
;
CREATE TYPE "public"."enum_waitlist_locale" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
;
CREATE TYPE "public"."enum_gift_vouchers_status" AS ENUM('active', 'redeemed', 'expired', 'refunded');
;
CREATE TYPE "public"."enum_gift_vouchers_invoice_status" AS ENUM('none', 'issued', 'failed');
;
CREATE TYPE "public"."enum_gift_vouchers_locale" AS ENUM('hu', 'en', 'de', 'es', 'it', 'fr');
;
CREATE TYPE "public"."enum_marketing_campaigns_status" AS ENUM('sent', 'draft');
;
CREATE TYPE "public"."enum_memberships_role" AS ENUM('owner', 'manager', 'staff');
;
CREATE TYPE "public"."enum_memberships_status" AS ENUM('active', 'invited', 'suspended');
;
CREATE TYPE "public"."enum_memberships_pay_type" AS ENUM('daily', 'hourly');
;
CREATE TYPE "public"."enum_roles_capabilities" AS ENUM('overview.view', 'bookings.view', 'bookings.manage', 'schedule.view.own', 'schedule.manage.own', 'schedule.manage', 'guests.view', 'guests.manage', 'catalog.view', 'catalog.manage', 'tables.view', 'tables.manage', 'availability.view', 'availability.manage', 'vouchers.view', 'vouchers.manage', 'marketing.view', 'marketing.manage', 'staff.view', 'staff.manage', 'staff.salary', 'analytics.view', 'analytics.view.own', 'tips.view', 'tips.manage', 'settings.own_profile', 'settings.profile', 'roles.view', 'team.view', 'team.manage', 'billing.manage', 'payments.manage', 'audit.view', 'danger');
;
CREATE TYPE "public"."enum_roles_booking_notify_level" AS ENUM('off', 'own', 'all');
;
CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'update', 'delete');
;
CREATE TYPE "public"."enum_email_log_type" AS ENUM('booking_confirmation', 'new_booking', 'cancellation', 'reminder', 'feedback', 'waitlist_signup', 'waitlist_opening', 'voucher_purchase', 'marketing_broadcast', 'modification', 'digest_morning', 'digest_evening', 'team_invite', 'password_reset', 'schedule_change', 'other');
;
CREATE TYPE "public"."enum_email_log_status" AS ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed');
;
ALTER TYPE "public"."enum_notifications_audience" ADD VALUE 'member' BEFORE 'admin';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'modification' BEFORE 'new_signup';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'digest_morning';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'digest_evening';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'schedule_change';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'email_not_opened';
;
ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'voucher_purchase';
;
CREATE TABLE "salons_custom_questions_options" (
	"_order" integer NOT NULL,
	"_parent_id" varchar NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL
);

;
CREATE TABLE "salons_custom_questions_options_locales" (
	"value" varchar,
	"id" serial PRIMARY KEY NOT NULL,
	"_locale" "_locales" NOT NULL,
	"_parent_id" varchar NOT NULL
);

;
CREATE TABLE "salons_custom_questions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"type" "enum_salons_custom_questions_type" DEFAULT 'text',
	"required" boolean DEFAULT false
);

;
CREATE TABLE "salons_custom_questions_locales" (
	"label" varchar NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"_locale" "_locales" NOT NULL,
	"_parent_id" varchar NOT NULL
);

;
CREATE TABLE "restaurants_custom_questions_options" (
	"_order" integer NOT NULL,
	"_parent_id" varchar NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL
);

;
CREATE TABLE "restaurants_custom_questions_options_locales" (
	"value" varchar,
	"id" serial PRIMARY KEY NOT NULL,
	"_locale" "_locales" NOT NULL,
	"_parent_id" varchar NOT NULL
);

;
CREATE TABLE "restaurants_custom_questions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"type" "enum_restaurants_custom_questions_type" DEFAULT 'text',
	"required" boolean DEFAULT false
);

;
CREATE TABLE "restaurants_custom_questions_locales" (
	"label" varchar NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"_locale" "_locales" NOT NULL,
	"_parent_id" varchar NOT NULL
);

;
CREATE TABLE "gift_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer,
	"salon_id" integer,
	"voucher_type_id" integer,
	"type_name" varchar,
	"code" varchar NOT NULL,
	"amount_huf" numeric NOT NULL,
	"image_id" integer,
	"qr_code_url" varchar,
	"purchaser_name" varchar NOT NULL,
	"purchaser_email" varchar NOT NULL,
	"recipient_name" varchar,
	"recipient_email" varchar,
	"message" varchar,
	"status" "enum_gift_vouchers_status" DEFAULT 'active' NOT NULL,
	"payment_intent_id" varchar NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"redeemed_at" timestamp(3) with time zone,
	"redeemed_booking_id" integer,
	"redeemed_reservation_id" integer,
	"invoice_number" varchar,
	"invoice_pdf_url" varchar,
	"invoice_status" "enum_gift_vouchers_invoice_status" DEFAULT 'none',
	"locale" "enum_gift_vouchers_locale" DEFAULT 'hu',
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

;
CREATE TABLE "gift_voucher_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer,
	"salon_id" integer,
	"amount_huf" numeric NOT NULL,
	"image_id" integer,
	"active" boolean DEFAULT true,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

;
CREATE TABLE "gift_voucher_types_locales" (
	"name" varchar NOT NULL,
	"description" varchar,
	"id" serial PRIMARY KEY NOT NULL,
	"_locale" "_locales" NOT NULL,
	"_parent_id" integer NOT NULL
);

;
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer,
	"salon_id" integer,
	"subject" varchar NOT NULL,
	"body_text" varchar,
	"recipient_count" numeric DEFAULT 0,
	"package" varchar,
	"status" "enum_marketing_campaigns_status" DEFAULT 'sent' NOT NULL,
	"blocks_json" jsonb,
	"target_customer_ids" jsonb,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

;
CREATE TABLE "trial_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"first_seen_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

;
ALTER TABLE "invoice_pdfs" DISABLE ROW LEVEL SECURITY;
;
DROP TABLE "invoice_pdfs" CASCADE;
;
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_endpoint_unique";
;
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_user_fk";

;
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_user_id_users_id_fk";

;
ALTER TABLE "memberships_documents" DROP CONSTRAINT "memberships_documents_parent_fk";

;
ALTER TABLE "opening_hours" DROP CONSTRAINT "opening_hours_restaurant_fk";

;
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_restaurant_fk";

;
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_salon_fk";

;
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

;
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_fkey";

;
ALTER TABLE "customers" DROP CONSTRAINT "customers_restaurant_fk";

;
ALTER TABLE "customers" DROP CONSTRAINT "customers_salon_fk";

;
ALTER TABLE "availability" DROP CONSTRAINT "availability_salon_fk";

;
ALTER TABLE "availability" DROP CONSTRAINT "availability_staff_fk";

;
ALTER TABLE "memberships_position_history" DROP CONSTRAINT "memberships_position_history_parent_fk";

;
ALTER TABLE "restaurants_good_to_know_locales" DROP CONSTRAINT "restaurants_good_to_know_locales__parent_id_fkey";

;
ALTER TABLE "restaurants_good_to_know_locales" DROP CONSTRAINT "restaurants_good_to_know_locales_parent_fk";

;
ALTER TABLE "restaurants_good_to_know" DROP CONSTRAINT "restaurants_good_to_know_parent_fk";

;
ALTER TABLE "opening_hours_exceptions" DROP CONSTRAINT "opening_hours_exceptions_restaurant_fk";

;
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_fk";

;
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_restaurant_fk";

;
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_salon_fk";

;
ALTER TABLE "restaurants_daily_tips" DROP CONSTRAINT "restaurants_daily_tips_parent_fk";

;
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_custom_role_fk";

;
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_restaurant_fk";

;
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_salon_fk";

;
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_fk";

;
ALTER TABLE "restaurants_event_types" DROP CONSTRAINT "restaurants_event_types_parent_fk";

;
ALTER TABLE "roles" DROP CONSTRAINT "roles_restaurant_fk";

;
ALTER TABLE "roles" DROP CONSTRAINT "roles_salon_fk";

;
ALTER TABLE "salons_good_to_know" DROP CONSTRAINT "salons_good_to_know_parent_fk";

;
ALTER TABLE "service_categories" DROP CONSTRAINT "service_categories_salon_fk";

;
ALTER TABLE "restaurants_terms_sections" DROP CONSTRAINT "restaurants_terms_sections_parent_fk";

;
ALTER TABLE "salons_terms_sections" DROP CONSTRAINT "salons_terms_sections_parent_fk";

;
ALTER TABLE "salons_terms_sections_locales" DROP CONSTRAINT "salons_terms_sections_locales__parent_id_fkey";

;
ALTER TABLE "salons_terms_sections_locales" DROP CONSTRAINT "salons_terms_sections_locales_parent_fk";

;
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_restaurant_fk";

;
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_salon_fk";

;
ALTER TABLE "restaurants_locales" DROP CONSTRAINT "restaurants_locales__parent_id_fkey";

;
ALTER TABLE "restaurants_locales" DROP CONSTRAINT "restaurants_locales_parent_fk";

;
ALTER TABLE "salons_supported_locales" DROP CONSTRAINT "salons_supported_locales_parent_id_fkey";

;
ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoices_id_fkey";

;
ALTER TABLE "services_locales" DROP CONSTRAINT "services_locales__parent_id_fkey";

;
ALTER TABLE "services_locales" DROP CONSTRAINT "services_locales_parent_fk";

;
ALTER TABLE "service_categories_locales" DROP CONSTRAINT "service_categories_locales__parent_id_fkey";

;
ALTER TABLE "service_categories_locales" DROP CONSTRAINT "service_categories_locales_parent_fk";

;
ALTER TABLE "roles_capabilities" DROP CONSTRAINT "roles_capabilities_parent_id_fk";

;
ALTER TABLE "roles_capabilities" DROP CONSTRAINT "roles_capabilities_parent_id_roles_id_fk";

;
ALTER TABLE "staff_documents" DROP CONSTRAINT "staff_documents_parent_fk";

;
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_member_fk";

;
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_restaurant_fk";

;
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_salon_fk";

;
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_staff_fk";

;
ALTER TABLE "staff_locales" DROP CONSTRAINT "staff_locales__parent_id_fkey";

;
ALTER TABLE "staff_locales" DROP CONSTRAINT "staff_locales_parent_fk";

;
ALTER TABLE "salons_locales" DROP CONSTRAINT "salons_locales__parent_id_fkey";

;
ALTER TABLE "salons_locales" DROP CONSTRAINT "salons_locales_parent_fk";

;
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_restaurant_fk";

;
ALTER TABLE "salons_good_to_know_locales" DROP CONSTRAINT "salons_good_to_know_locales__parent_id_fkey";

;
ALTER TABLE "salons_good_to_know_locales" DROP CONSTRAINT "salons_good_to_know_locales_parent_fk";

;
ALTER TABLE "restaurants_positions" DROP CONSTRAINT "restaurants_positions_parent_fk";

;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_restaurant_fk";

;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_salon_fk";

;
ALTER TABLE "restaurants_supported_locales" DROP CONSTRAINT "restaurants_supported_locales_parent_id_fkey";

;
ALTER TABLE "tables" DROP CONSTRAINT "tables_restaurant_fk";

;
ALTER TABLE "tables" DROP CONSTRAINT "tables_room_fk";

;
ALTER TABLE "restaurants_event_types_locales" DROP CONSTRAINT "restaurants_event_types_locales_parent_fk";

;
ALTER TABLE "waitlist" DROP CONSTRAINT "waitlist_restaurant_fk";

;
ALTER TABLE "waitlist" DROP CONSTRAINT "waitlist_salon_fk";

;
ALTER TABLE "restaurants_terms_sections_locales" DROP CONSTRAINT "restaurants_terms_sections_locales__parent_id_fkey";

;
ALTER TABLE "restaurants_terms_sections_locales" DROP CONSTRAINT "restaurants_terms_sections_locales_parent_fk";

;
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_owner_fk";

;
DROP INDEX "invoices_stripe_invoice_id_idx";
;
DROP INDEX "restaurants_daily_tips_parent_idx";
;
DROP INDEX "memberships_status_idx";
;
DROP INDEX "restaurants_event_types_parent_idx";
;
DROP INDEX "staff_documents_parent_idx";
;
DROP INDEX "restaurants_positions_parent_idx";
;
DROP INDEX "memberships_invite_token_idx";
;
ALTER TABLE "memberships_documents" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "invoices" ALTER COLUMN "subscription_id" SET NOT NULL;
;
ALTER TABLE "invoices" ALTER COLUMN "amount_huf" SET DATA TYPE numeric;
;
ALTER TABLE "invoices" ALTER COLUMN "issued_at" SET DATA TYPE timestamp(3) with time zone;
;
ALTER TABLE "invoices" ALTER COLUMN "created_at" SET DATA TYPE timestamp(3) with time zone;
;
ALTER TABLE "invoices" ALTER COLUMN "created_at" SET DEFAULT now();
;
ALTER TABLE "invoices" ALTER COLUMN "created_at" SET NOT NULL;
;
ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3) with time zone;
;
ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET DEFAULT now();
;
ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET NOT NULL;
;
ALTER TABLE "customers" ALTER COLUMN "notes" SET DATA TYPE varchar;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "salon_pro_huf" SET DEFAULT 6800;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "restaurant_pro_huf" SET DEFAULT 23800;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "trial_days" SET DEFAULT 14;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "salon_extra_staff_huf" SET DATA TYPE numeric;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "salon_extra_staff_huf" SET DEFAULT 1900;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "annual_discount_pct" SET DATA TYPE numeric;
;
ALTER TABLE "pricing_settings" ALTER COLUMN "annual_discount_pct" SET DEFAULT 20;
;
ALTER TABLE "memberships_position_history" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "email_log" ALTER COLUMN "type" SET DATA TYPE "public"."enum_email_log_type" USING "type"::"public"."enum_email_log_type";
;
ALTER TABLE "email_log" ALTER COLUMN "type" SET NOT NULL;
;
ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
;
ALTER TABLE "audit_log" ALTER COLUMN "action" SET NOT NULL;
;
ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "date" SET NOT NULL;
;
ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "amount" SET NOT NULL;
;
ALTER TABLE "memberships" ALTER COLUMN "email" SET NOT NULL;
;
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'staff'::"public"."enum_memberships_role";
;
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE "public"."enum_memberships_role" USING "role"::"public"."enum_memberships_role";
;
ALTER TABLE "memberships" ALTER COLUMN "role" SET NOT NULL;
;
ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'invited'::"public"."enum_memberships_status";
;
ALTER TABLE "memberships" ALTER COLUMN "status" SET DATA TYPE "public"."enum_memberships_status" USING "status"::"public"."enum_memberships_status";
;
ALTER TABLE "memberships" ALTER COLUMN "status" SET NOT NULL;
;
ALTER TABLE "memberships" ALTER COLUMN "pay_type" SET DEFAULT 'daily'::"public"."enum_memberships_pay_type";
;
ALTER TABLE "memberships" ALTER COLUMN "pay_type" SET DATA TYPE "public"."enum_memberships_pay_type" USING "pay_type"::"public"."enum_memberships_pay_type";
;
ALTER TABLE "memberships" ALTER COLUMN "bio" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_event_types" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_event_types" ALTER COLUMN "icon" SET DEFAULT 'party';
;
ALTER TABLE "bookings" ALTER COLUMN "staff_id" DROP NOT NULL;
;
ALTER TABLE "bookings" ALTER COLUMN "locale" SET DEFAULT 'hu';
;
ALTER TABLE "bookings" ALTER COLUMN "reminder_sent" SET DEFAULT false;
;
ALTER TABLE "bookings" ALTER COLUMN "feedback_sent" SET DEFAULT false;
;
ALTER TABLE "service_categories" ALTER COLUMN "sort_order" SET DEFAULT 0;
;
ALTER TABLE "reviews" ALTER COLUMN "rating" SET NOT NULL;
;
ALTER TABLE "reviews" ALTER COLUMN "comment" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_locales" ALTER COLUMN "cancel_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_locales" ALTER COLUMN "reminder_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_locales" ALTER COLUMN "feedback_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "reservations" ALTER COLUMN "pax" SET DEFAULT 2;
;
ALTER TABLE "reservations" ALTER COLUMN "locale" SET DEFAULT 'hu';
;
ALTER TABLE "reservations" ALTER COLUMN "reminder_sent" SET DEFAULT false;
;
ALTER TABLE "reservations" ALTER COLUMN "feedback_sent" SET DEFAULT false;
;
ALTER TABLE "roles_capabilities" ALTER COLUMN "value" SET DATA TYPE "public"."enum_roles_capabilities" USING "value"::"public"."enum_roles_capabilities";
;
ALTER TABLE "roles_capabilities" ALTER COLUMN "parent_id" SET NOT NULL;
;
ALTER TABLE "roles_capabilities" ALTER COLUMN "order" SET NOT NULL;
;
ALTER TABLE "staff_documents" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "shifts" ALTER COLUMN "type" SET DEFAULT 'shift'::"public"."enum_shifts_type";
;
ALTER TABLE "shifts" ALTER COLUMN "type" SET DATA TYPE "public"."enum_shifts_type" USING "type"::"public"."enum_shifts_type";
;
ALTER TABLE "shifts" ALTER COLUMN "left_early_reason" SET DATA TYPE "public"."enum_shifts_left_early_reason" USING "left_early_reason"::"public"."enum_shifts_left_early_reason";
;
ALTER TABLE "salons_locales" ALTER COLUMN "cancel_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "salons_locales" ALTER COLUMN "reminder_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "salons_locales" ALTER COLUMN "feedback_email_intro" SET DATA TYPE varchar;
;
ALTER TABLE "services" ALTER COLUMN "duration_minutes" SET DEFAULT 60;
;
ALTER TABLE "services" ALTER COLUMN "category_id" SET NOT NULL;
;
ALTER TABLE "rooms" ALTER COLUMN "sort_order" SET DEFAULT 0;
;
ALTER TABLE "restaurants_positions" ALTER COLUMN "id" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_positions" ALTER COLUMN "level" SET DEFAULT 'staff'::"public"."enum_restaurants_positions_level";
;
ALTER TABLE "restaurants_positions" ALTER COLUMN "level" SET DATA TYPE "public"."enum_restaurants_positions_level" USING "level"::"public"."enum_restaurants_positions_level";
;
ALTER TABLE "restaurants_positions" ALTER COLUMN "label" SET NOT NULL;
;
ALTER TABLE "tables" ALTER COLUMN "capacity" SET DEFAULT 4;
;
ALTER TABLE "tables" ALTER COLUMN "sort_order" SET DEFAULT 0;
;
ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
;
ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "_parent_id" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "label" SET NOT NULL;
;
ALTER TABLE "waitlist" ALTER COLUMN "status" SET DEFAULT 'waiting'::"public"."enum_waitlist_status";
;
ALTER TABLE "waitlist" ALTER COLUMN "status" SET DATA TYPE "public"."enum_waitlist_status" USING "status"::"public"."enum_waitlist_status";
;
ALTER TABLE "waitlist" ALTER COLUMN "status" SET NOT NULL;
;
ALTER TABLE "waitlist" ALTER COLUMN "token" SET NOT NULL;
;
ALTER TABLE "waitlist" ALTER COLUMN "locale" SET DEFAULT 'hu'::"public"."enum_waitlist_locale";
;
ALTER TABLE "waitlist" ALTER COLUMN "locale" SET DATA TYPE "public"."enum_waitlist_locale" USING "locale"::"public"."enum_waitlist_locale";
;
ALTER TABLE "subscriptions" ALTER COLUMN "amount_huf" SET DEFAULT 0;
;
ALTER TABLE "subscriptions" ALTER COLUMN "salon_count" SET DEFAULT 0;
;
ALTER TABLE "subscriptions" ALTER COLUMN "restaurant_count" SET DEFAULT 0;
;
ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET DEFAULT 'monthly'::"public"."enum_subscriptions_billing_cycle";
;
ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET DATA TYPE "public"."enum_subscriptions_billing_cycle" USING "billing_cycle"::"public"."enum_subscriptions_billing_cycle";
;
ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET NOT NULL;
;
ALTER TABLE "restaurants" ALTER COLUMN "turn_duration_minutes" SET DEFAULT 120;
;
ALTER TABLE "restaurants" ALTER COLUMN "slot_step_minutes" SET DEFAULT 30;
;
ALTER TABLE "restaurants" ALTER COLUMN "last_seating_buffer_minutes" SET DEFAULT 0;
;
ALTER TABLE "restaurants" ALTER COLUMN "lead_time_hours" SET DEFAULT 2;
;
ALTER TABLE "restaurants" ALTER COLUMN "booking_window_days" SET DEFAULT 60;
;
ALTER TABLE "restaurants" ALTER COLUMN "tier" SET DEFAULT 'pro'::"public"."enum_restaurants_tier";
;
ALTER TABLE "restaurants" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_restaurants_tier" USING "tier"::"public"."enum_restaurants_tier";
;
ALTER TABLE "restaurants" ALTER COLUMN "tier" SET NOT NULL;
;
ALTER TABLE "restaurants" ALTER COLUMN "feature_modules_reminder_t_24h" SET DEFAULT false;
;
ALTER TABLE "restaurants" ALTER COLUMN "webhook_url" SET DATA TYPE varchar;
;
ALTER TABLE "restaurants" ALTER COLUMN "feature_modules_review_delay_hours" SET DEFAULT 1;
;
ALTER TABLE "users" ALTER COLUMN "login_attempts" SET DEFAULT 0;
;
ALTER TABLE "users" ALTER COLUMN "bio" SET DATA TYPE varchar;
;
ALTER TABLE "salons" ALTER COLUMN "booking_buffer_minutes" SET DEFAULT 15;
;
ALTER TABLE "salons" ALTER COLUMN "booking_window_days" SET DEFAULT 60;
;
ALTER TABLE "salons" ALTER COLUMN "tier" SET DEFAULT 'pro'::"public"."enum_salons_tier";
;
ALTER TABLE "salons" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_salons_tier" USING "tier"::"public"."enum_salons_tier";
;
ALTER TABLE "salons" ALTER COLUMN "tier" SET NOT NULL;
;
ALTER TABLE "salons" ALTER COLUMN "feature_modules_reminder_t_24h" SET DEFAULT false;
;
ALTER TABLE "salons" ALTER COLUMN "webhook_url" SET DATA TYPE varchar;
;
ALTER TABLE "salons" ALTER COLUMN "feature_modules_review_delay_hours" SET DEFAULT 1;
;
ALTER TABLE "notifications" ADD COLUMN "voucher_id" integer;
;
ALTER TABLE "customers" ADD COLUMN "customer_city" varchar;
;
ALTER TABLE "customers" ADD COLUMN "customer_country" varchar;
;
ALTER TABLE "customers" ADD COLUMN "marketing_consent" boolean DEFAULT false;
;
ALTER TABLE "customers" ADD COLUMN "marketing_consent_at" timestamp(3) with time zone;
;
ALTER TABLE "pricing_settings" ADD COLUMN "salon_starter_huf" numeric DEFAULT 1900 NOT NULL;
;
ALTER TABLE "pricing_settings" ADD COLUMN "restaurant_starter_huf" numeric DEFAULT 12900 NOT NULL;
;
ALTER TABLE "pricing_settings" ADD COLUMN "starter_email_cap" numeric DEFAULT 500 NOT NULL;
;
ALTER TABLE "pricing_settings" ADD COLUMN "pro_email_cap" numeric DEFAULT 5000 NOT NULL;
;
ALTER TABLE "pricing_settings" ADD COLUMN "egyedi_email_cap" numeric DEFAULT 50000 NOT NULL;
;
ALTER TABLE "email_log" ADD COLUMN "resend_id" varchar;
;
ALTER TABLE "email_log" ADD COLUMN "status" "enum_email_log_status" DEFAULT 'sent';
;
ALTER TABLE "email_log" ADD COLUMN "delivered_at" timestamp(3) with time zone;
;
ALTER TABLE "email_log" ADD COLUMN "opened_at" timestamp(3) with time zone;
;
ALTER TABLE "email_log" ADD COLUMN "booking_id" integer;
;
ALTER TABLE "email_log" ADD COLUMN "reservation_id" integer;
;
ALTER TABLE "email_log" ADD COLUMN "salon_id" integer;
;
ALTER TABLE "email_log" ADD COLUMN "restaurant_id" integer;
;
ALTER TABLE "email_log" ADD COLUMN "campaign_id" integer;
;
ALTER TABLE "memberships" ADD COLUMN "tax_number" varchar;
;
ALTER TABLE "roles" ADD COLUMN "booking_notify_level" "enum_roles_booking_notify_level" DEFAULT 'off';
;
ALTER TABLE "bookings" ADD COLUMN "customer_address" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "email_open_check_24h" boolean DEFAULT false;
;
ALTER TABLE "bookings" ADD COLUMN "email_open_check_12h" boolean DEFAULT false;
;
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp(3) with time zone;
;
ALTER TABLE "bookings" ADD COLUMN "payment_gateway" "enum_bookings_payment_gateway" DEFAULT 'none';
;
ALTER TABLE "bookings" ADD COLUMN "payment_status" "enum_bookings_payment_status" DEFAULT 'none';
;
ALTER TABLE "bookings" ADD COLUMN "deposit_amount_huf" numeric;
;
ALTER TABLE "bookings" ADD COLUMN "deposit_paid" boolean DEFAULT false;
;
ALTER TABLE "bookings" ADD COLUMN "deposit_refunded" boolean DEFAULT false;
;
ALTER TABLE "bookings" ADD COLUMN "payment_intent_id" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "invoice_number" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "invoice_pdf_url" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "invoice_status" "enum_bookings_invoice_status" DEFAULT 'none';
;
ALTER TABLE "bookings" ADD COLUMN "voucher_code" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "voucher_discount_huf" numeric;
;
ALTER TABLE "bookings" ADD COLUMN "consent_accepted" boolean DEFAULT false;
;
ALTER TABLE "bookings" ADD COLUMN "consent_accepted_at" timestamp(3) with time zone;
;
ALTER TABLE "bookings" ADD COLUMN "consent_accepted_via" "enum_bookings_consent_accepted_via";
;
ALTER TABLE "bookings" ADD COLUMN "consent_text_snapshot" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "consent_accepted_ip" varchar;
;
ALTER TABLE "bookings" ADD COLUMN "custom_answers" jsonb;
;
ALTER TABLE "restaurants_locales" ADD COLUMN "consent_settings_title" varchar;
;
ALTER TABLE "restaurants_locales" ADD COLUMN "consent_settings_template_text" varchar;
;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gift_vouchers_id" integer;
;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gift_voucher_types_id" integer;
;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "marketing_campaigns_id" integer;
;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trial_ledger_id" integer;
;
ALTER TABLE "reservations" ADD COLUMN "customer_address" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "email_open_check_24h" boolean DEFAULT false;
;
ALTER TABLE "reservations" ADD COLUMN "email_open_check_12h" boolean DEFAULT false;
;
ALTER TABLE "reservations" ADD COLUMN "cancelled_at" timestamp(3) with time zone;
;
ALTER TABLE "reservations" ADD COLUMN "payment_gateway" "enum_reservations_payment_gateway" DEFAULT 'none';
;
ALTER TABLE "reservations" ADD COLUMN "payment_status" "enum_reservations_payment_status" DEFAULT 'none';
;
ALTER TABLE "reservations" ADD COLUMN "deposit_amount_huf" numeric;
;
ALTER TABLE "reservations" ADD COLUMN "deposit_paid" boolean DEFAULT false;
;
ALTER TABLE "reservations" ADD COLUMN "deposit_refunded" boolean DEFAULT false;
;
ALTER TABLE "reservations" ADD COLUMN "payment_intent_id" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "invoice_number" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "invoice_pdf_url" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "invoice_status" "enum_reservations_invoice_status" DEFAULT 'none';
;
ALTER TABLE "reservations" ADD COLUMN "voucher_code" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "voucher_discount_huf" numeric;
;
ALTER TABLE "reservations" ADD COLUMN "consent_accepted" boolean DEFAULT false;
;
ALTER TABLE "reservations" ADD COLUMN "consent_accepted_at" timestamp(3) with time zone;
;
ALTER TABLE "reservations" ADD COLUMN "consent_accepted_via" "enum_reservations_consent_accepted_via";
;
ALTER TABLE "reservations" ADD COLUMN "consent_text_snapshot" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "consent_accepted_ip" varchar;
;
ALTER TABLE "reservations" ADD COLUMN "custom_answers" jsonb;
;
ALTER TABLE "salons_locales" ADD COLUMN "consent_settings_title" varchar;
;
ALTER TABLE "salons_locales" ADD COLUMN "consent_settings_template_text" varchar;
;
ALTER TABLE "staff" ADD COLUMN "user_id" integer;
;
ALTER TABLE "staff" ADD COLUMN "tax_number" varchar;
;
ALTER TABLE "restaurants" ADD COLUMN "custom_monthly_fee_huf" numeric;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_type" "enum_restaurants_deposit_settings_type" DEFAULT 'fixed';
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_fixed_amount_huf" numeric;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_percent_value" numeric;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_per_pax_amount_huf" numeric;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_refund_hours_before" numeric DEFAULT 24;
;
ALTER TABLE "restaurants" ADD COLUMN "deposit_settings_payment_gateway" "enum_restaurants_deposit_settings_payment_gateway" DEFAULT 'none';
;
ALTER TABLE "restaurants" ADD COLUMN "voucher_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "restaurants" ADD COLUMN "voucher_settings_min_amount_huf" numeric DEFAULT 2000;
;
ALTER TABLE "restaurants" ADD COLUMN "voucher_settings_max_amount_huf" numeric DEFAULT 100000;
;
ALTER TABLE "restaurants" ADD COLUMN "voucher_settings_validity_months" numeric DEFAULT 12;
;
ALTER TABLE "restaurants" ADD COLUMN "newsletter_settings_package" "enum_restaurants_newsletter_settings_package" DEFAULT 'ingyenes';
;
ALTER TABLE "restaurants" ADD COLUMN "newsletter_settings_sending" boolean DEFAULT false;
;
ALTER TABLE "restaurants" ADD COLUMN "consent_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "restaurants" ADD COLUMN "marketing_tracking_ga4_measurement_id" varchar;
;
ALTER TABLE "restaurants" ADD COLUMN "marketing_tracking_facebook_pixel_id" varchar;
;
ALTER TABLE "restaurants" ADD COLUMN "stripe_connect_account_id" varchar;
;
ALTER TABLE "restaurants" ADD COLUMN "stripe_connect_onboarded" boolean DEFAULT false;
;
ALTER TABLE "restaurants" ADD COLUMN "invoice_settings_invoice_provider" "enum_restaurants_invoice_settings_invoice_provider" DEFAULT 'none';
;
ALTER TABLE "restaurants" ADD COLUMN "invoice_settings_szamlazz_agent_key_enc" varchar;
;
ALTER TABLE "restaurants" ADD COLUMN "invoice_settings_billingo_api_key_enc" varchar;
;
ALTER TABLE "users" ADD COLUMN "tax_number" varchar;
;
ALTER TABLE "users" ADD COLUMN "role_title" varchar;
;
ALTER TABLE "users" ADD COLUMN "personal_notif_prefs_email_not_opened" boolean DEFAULT true;
;
ALTER TABLE "users" ADD COLUMN "personal_notif_prefs_bookings_email" boolean DEFAULT false;
;
ALTER TABLE "users" ADD COLUMN "personal_notif_prefs_schedule_email" boolean DEFAULT false;
;
ALTER TABLE "users" ADD COLUMN "_verified" boolean;
;
ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
;
ALTER TABLE "salons" ADD COLUMN "custom_monthly_fee_huf" numeric;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_type" "enum_salons_deposit_settings_type" DEFAULT 'fixed';
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_fixed_amount_huf" numeric;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_percent_value" numeric;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_per_pax_amount_huf" numeric;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_refund_hours_before" numeric DEFAULT 24;
;
ALTER TABLE "salons" ADD COLUMN "deposit_settings_payment_gateway" "enum_salons_deposit_settings_payment_gateway" DEFAULT 'none';
;
ALTER TABLE "salons" ADD COLUMN "voucher_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "salons" ADD COLUMN "voucher_settings_min_amount_huf" numeric DEFAULT 2000;
;
ALTER TABLE "salons" ADD COLUMN "voucher_settings_max_amount_huf" numeric DEFAULT 100000;
;
ALTER TABLE "salons" ADD COLUMN "voucher_settings_validity_months" numeric DEFAULT 12;
;
ALTER TABLE "salons" ADD COLUMN "newsletter_settings_package" "enum_salons_newsletter_settings_package" DEFAULT 'ingyenes';
;
ALTER TABLE "salons" ADD COLUMN "newsletter_settings_sending" boolean DEFAULT false;
;
ALTER TABLE "salons" ADD COLUMN "consent_settings_enabled" boolean DEFAULT false;
;
ALTER TABLE "salons" ADD COLUMN "marketing_tracking_ga4_measurement_id" varchar;
;
ALTER TABLE "salons" ADD COLUMN "marketing_tracking_facebook_pixel_id" varchar;
;
ALTER TABLE "salons" ADD COLUMN "stripe_connect_account_id" varchar;
;
ALTER TABLE "salons" ADD COLUMN "stripe_connect_onboarded" boolean DEFAULT false;
;
ALTER TABLE "salons" ADD COLUMN "invoice_settings_invoice_provider" "enum_salons_invoice_settings_invoice_provider" DEFAULT 'none';
;
ALTER TABLE "salons" ADD COLUMN "invoice_settings_szamlazz_agent_key_enc" varchar;
;
ALTER TABLE "salons" ADD COLUMN "invoice_settings_billingo_api_key_enc" varchar;
;
ALTER TABLE "salons_custom_questions_options" ADD CONSTRAINT "salons_custom_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_custom_questions_options_locales" ADD CONSTRAINT "salons_custom_questions_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions_options"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_custom_questions" ADD CONSTRAINT "salons_custom_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_custom_questions_locales" ADD CONSTRAINT "salons_custom_questions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_custom_questions_options" ADD CONSTRAINT "restaurants_custom_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_custom_questions_options_locales" ADD CONSTRAINT "restaurants_custom_questions_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions_options"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_custom_questions" ADD CONSTRAINT "restaurants_custom_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_custom_questions_locales" ADD CONSTRAINT "restaurants_custom_questions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_voucher_type_id_gift_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_redeemed_booking_id_bookings_id_fk" FOREIGN KEY ("redeemed_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_redeemed_reservation_id_reservations_id_fk" FOREIGN KEY ("redeemed_reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "gift_voucher_types_locales" ADD CONSTRAINT "gift_voucher_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
;
CREATE INDEX "salons_custom_questions_options_order_idx" ON "salons_custom_questions_options" USING btree ("_order");
;
CREATE INDEX "salons_custom_questions_options_parent_id_idx" ON "salons_custom_questions_options" USING btree ("_parent_id");
;
CREATE UNIQUE INDEX "salons_custom_questions_options_locales_locale_parent_id_uni" ON "salons_custom_questions_options_locales" USING btree ("_locale","_parent_id");
;
CREATE INDEX "salons_custom_questions_order_idx" ON "salons_custom_questions" USING btree ("_order");
;
CREATE INDEX "salons_custom_questions_parent_id_idx" ON "salons_custom_questions" USING btree ("_parent_id");
;
CREATE UNIQUE INDEX "salons_custom_questions_locales_locale_parent_id_unique" ON "salons_custom_questions_locales" USING btree ("_locale","_parent_id");
;
CREATE INDEX "restaurants_custom_questions_options_order_idx" ON "restaurants_custom_questions_options" USING btree ("_order");
;
CREATE INDEX "restaurants_custom_questions_options_parent_id_idx" ON "restaurants_custom_questions_options" USING btree ("_parent_id");
;
CREATE UNIQUE INDEX "restaurants_custom_questions_options_locales_locale_parent_i" ON "restaurants_custom_questions_options_locales" USING btree ("_locale","_parent_id");
;
CREATE INDEX "restaurants_custom_questions_order_idx" ON "restaurants_custom_questions" USING btree ("_order");
;
CREATE INDEX "restaurants_custom_questions_parent_id_idx" ON "restaurants_custom_questions" USING btree ("_parent_id");
;
CREATE UNIQUE INDEX "restaurants_custom_questions_locales_locale_parent_id_unique" ON "restaurants_custom_questions_locales" USING btree ("_locale","_parent_id");
;
CREATE INDEX "gift_vouchers_restaurant_idx" ON "gift_vouchers" USING btree ("restaurant_id");
;
CREATE INDEX "gift_vouchers_salon_idx" ON "gift_vouchers" USING btree ("salon_id");
;
CREATE INDEX "gift_vouchers_voucher_type_idx" ON "gift_vouchers" USING btree ("voucher_type_id");
;
CREATE UNIQUE INDEX "gift_vouchers_code_idx" ON "gift_vouchers" USING btree ("code");
;
CREATE INDEX "gift_vouchers_image_idx" ON "gift_vouchers" USING btree ("image_id");
;
CREATE UNIQUE INDEX "gift_vouchers_payment_intent_id_idx" ON "gift_vouchers" USING btree ("payment_intent_id");
;
CREATE INDEX "gift_vouchers_redeemed_booking_idx" ON "gift_vouchers" USING btree ("redeemed_booking_id");
;
CREATE INDEX "gift_vouchers_redeemed_reservation_idx" ON "gift_vouchers" USING btree ("redeemed_reservation_id");
;
CREATE INDEX "gift_vouchers_updated_at_idx" ON "gift_vouchers" USING btree ("updated_at");
;
CREATE INDEX "gift_vouchers_created_at_idx" ON "gift_vouchers" USING btree ("created_at");
;
CREATE INDEX "gift_voucher_types_restaurant_idx" ON "gift_voucher_types" USING btree ("restaurant_id");
;
CREATE INDEX "gift_voucher_types_salon_idx" ON "gift_voucher_types" USING btree ("salon_id");
;
CREATE INDEX "gift_voucher_types_image_idx" ON "gift_voucher_types" USING btree ("image_id");
;
CREATE INDEX "gift_voucher_types_updated_at_idx" ON "gift_voucher_types" USING btree ("updated_at");
;
CREATE INDEX "gift_voucher_types_created_at_idx" ON "gift_voucher_types" USING btree ("created_at");
;
CREATE UNIQUE INDEX "gift_voucher_types_locales_locale_parent_id_unique" ON "gift_voucher_types_locales" USING btree ("_locale","_parent_id");
;
CREATE INDEX "marketing_campaigns_restaurant_idx" ON "marketing_campaigns" USING btree ("restaurant_id");
;
CREATE INDEX "marketing_campaigns_salon_idx" ON "marketing_campaigns" USING btree ("salon_id");
;
CREATE INDEX "marketing_campaigns_updated_at_idx" ON "marketing_campaigns" USING btree ("updated_at");
;
CREATE INDEX "marketing_campaigns_created_at_idx" ON "marketing_campaigns" USING btree ("created_at");
;
CREATE UNIQUE INDEX "trial_ledger_email_idx" ON "trial_ledger" USING btree ("email");
;
CREATE INDEX "trial_ledger_updated_at_idx" ON "trial_ledger" USING btree ("updated_at");
;
CREATE INDEX "trial_ledger_created_at_idx" ON "trial_ledger" USING btree ("created_at");
;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "memberships_documents" ADD CONSTRAINT "memberships_documents_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_voucher_id_gift_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."gift_vouchers"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "restaurants_good_to_know_locales" ADD CONSTRAINT "restaurants_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "restaurants_daily_tips" ADD CONSTRAINT "restaurants_daily_tips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "restaurants_event_types" ADD CONSTRAINT "restaurants_event_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_terms_sections_locales" ADD CONSTRAINT "salons_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "restaurants_locales" ADD CONSTRAINT "restaurants_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_supported_locales" ADD CONSTRAINT "salons_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shifts_fk" FOREIGN KEY ("shifts_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waitlist_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_vouchers_fk" FOREIGN KEY ("gift_vouchers_id") REFERENCES "public"."gift_vouchers"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_voucher_types_fk" FOREIGN KEY ("gift_voucher_types_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_campaigns_fk" FOREIGN KEY ("marketing_campaigns_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_log_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_log"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_ledger_fk" FOREIGN KEY ("trial_ledger_id") REFERENCES "public"."trial_ledger"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "services_locales" ADD CONSTRAINT "services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "service_categories_locales" ADD CONSTRAINT "service_categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "roles_capabilities" ADD CONSTRAINT "roles_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_member_id_memberships_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "staff_locales" ADD CONSTRAINT "staff_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "salons_locales" ADD CONSTRAINT "salons_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "services" ADD CONSTRAINT "services_subcategory_id_service_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "salons_good_to_know_locales" ADD CONSTRAINT "salons_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_positions" ADD CONSTRAINT "restaurants_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_supported_locales" ADD CONSTRAINT "restaurants_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "restaurants_event_types_locales" ADD CONSTRAINT "restaurants_event_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_event_types"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
;
ALTER TABLE "restaurants_terms_sections_locales" ADD CONSTRAINT "restaurants_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
;
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
;
CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
;
CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
;
CREATE INDEX "memberships_documents_order_idx" ON "memberships_documents" USING btree ("_order");
;
CREATE INDEX "memberships_documents_parent_id_idx" ON "memberships_documents" USING btree ("_parent_id");
;
CREATE INDEX "memberships_documents_file_idx" ON "memberships_documents" USING btree ("file_id");
;
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
;
CREATE INDEX "notifications_voucher_idx" ON "notifications" USING btree ("voucher_id");
;
CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
;
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
;
CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
;
CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
;
CREATE INDEX "memberships_position_history_order_idx" ON "memberships_position_history" USING btree ("_order");
;
CREATE INDEX "memberships_position_history_parent_id_idx" ON "memberships_position_history" USING btree ("_parent_id");
;
CREATE INDEX "email_log_type_idx" ON "email_log" USING btree ("type");
;
CREATE INDEX "email_log_resend_id_idx" ON "email_log" USING btree ("resend_id");
;
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");
;
CREATE INDEX "email_log_booking_idx" ON "email_log" USING btree ("booking_id");
;
CREATE INDEX "email_log_reservation_idx" ON "email_log" USING btree ("reservation_id");
;
CREATE INDEX "email_log_salon_idx" ON "email_log" USING btree ("salon_id");
;
CREATE INDEX "email_log_restaurant_idx" ON "email_log" USING btree ("restaurant_id");
;
CREATE INDEX "email_log_campaign_idx" ON "email_log" USING btree ("campaign_id");
;
CREATE INDEX "email_log_updated_at_idx" ON "email_log" USING btree ("updated_at");
;
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");
;
CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
;
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
;
CREATE INDEX "restaurants_daily_tips_order_idx" ON "restaurants_daily_tips" USING btree ("_order");
;
CREATE INDEX "restaurants_daily_tips_parent_id_idx" ON "restaurants_daily_tips" USING btree ("_parent_id");
;
CREATE INDEX "memberships_custom_role_idx" ON "memberships" USING btree ("custom_role_id");
;
CREATE INDEX "memberships_avatar_idx" ON "memberships" USING btree ("avatar_id");
;
CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
;
CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
;
CREATE INDEX "restaurants_event_types_order_idx" ON "restaurants_event_types" USING btree ("_order");
;
CREATE INDEX "restaurants_event_types_parent_id_idx" ON "restaurants_event_types" USING btree ("_parent_id");
;
CREATE INDEX "roles_updated_at_idx" ON "roles" USING btree ("updated_at");
;
CREATE INDEX "roles_created_at_idx" ON "roles" USING btree ("created_at");
;
CREATE INDEX "bookings_series_id_idx" ON "bookings" USING btree ("series_id");
;
CREATE INDEX "bookings_payment_intent_id_idx" ON "bookings" USING btree ("payment_intent_id");
;
CREATE INDEX "reviews_reservation_idx" ON "reviews" USING btree ("reservation_id");
;
CREATE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");
;
CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
;
CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
;
CREATE INDEX "payload_locked_documents_rels_shifts_id_idx" ON "payload_locked_documents_rels" USING btree ("shifts_id");
;
CREATE INDEX "payload_locked_documents_rels_waitlist_id_idx" ON "payload_locked_documents_rels" USING btree ("waitlist_id");
;
CREATE INDEX "payload_locked_documents_rels_gift_vouchers_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_vouchers_id");
;
CREATE INDEX "payload_locked_documents_rels_gift_voucher_types_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_voucher_types_id");
;
CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
;
CREATE INDEX "payload_locked_documents_rels_marketing_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_campaigns_id");
;
CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
;
CREATE INDEX "payload_locked_documents_rels_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("memberships_id");
;
CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");
;
CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
;
CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
;
CREATE INDEX "payload_locked_documents_rels_email_log_id_idx" ON "payload_locked_documents_rels" USING btree ("email_log_id");
;
CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
;
CREATE INDEX "payload_locked_documents_rels_trial_ledger_id_idx" ON "payload_locked_documents_rels" USING btree ("trial_ledger_id");
;
CREATE INDEX "reservations_series_id_idx" ON "reservations" USING btree ("series_id");
;
CREATE INDEX "reservations_payment_intent_id_idx" ON "reservations" USING btree ("payment_intent_id");
;
CREATE INDEX "roles_capabilities_order_idx" ON "roles_capabilities" USING btree ("order");
;
CREATE INDEX "roles_capabilities_parent_idx" ON "roles_capabilities" USING btree ("parent_id");
;
CREATE INDEX "staff_documents_parent_id_idx" ON "staff_documents" USING btree ("_parent_id");
;
CREATE INDEX "staff_documents_file_idx" ON "staff_documents" USING btree ("file_id");
;
CREATE INDEX "shifts_member_idx" ON "shifts" USING btree ("member_id");
;
CREATE INDEX "shifts_updated_at_idx" ON "shifts" USING btree ("updated_at");
;
CREATE INDEX "shifts_created_at_idx" ON "shifts" USING btree ("created_at");
;
CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id");
;
CREATE INDEX "services_subcategory_idx" ON "services" USING btree ("subcategory_id");
;
CREATE INDEX "restaurants_positions_parent_id_idx" ON "restaurants_positions" USING btree ("_parent_id");
;
CREATE UNIQUE INDEX "restaurants_event_types_locales_locale_parent_id_unique" ON "restaurants_event_types_locales" USING btree ("_locale","_parent_id");
;
CREATE UNIQUE INDEX "waitlist_token_idx" ON "waitlist" USING btree ("token");
;
CREATE INDEX "waitlist_updated_at_idx" ON "waitlist" USING btree ("updated_at");
;
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");
;
CREATE INDEX "staff_user_idx" ON "staff" USING btree ("user_id");
;
CREATE UNIQUE INDEX "memberships_invite_token_idx" ON "memberships" USING btree ("invite_token");
;
ALTER TABLE "invoices" DROP COLUMN "invoice_pdf_base64";
;
ALTER TABLE "restaurants_good_to_know" DROP COLUMN "title";
;
ALTER TABLE "restaurants_good_to_know" DROP COLUMN "body";
;
ALTER TABLE "memberships" DROP COLUMN "emergency_contact";
;
ALTER TABLE "salons_good_to_know" DROP COLUMN "title";
;
ALTER TABLE "salons_good_to_know" DROP COLUMN "body";
;
ALTER TABLE "service_categories" DROP COLUMN "name";
;
ALTER TABLE "service_categories" DROP COLUMN "duration_label";
;
ALTER TABLE "service_categories" DROP COLUMN "description";
;
ALTER TABLE "restaurants_terms_sections" DROP COLUMN "title";
;
ALTER TABLE "restaurants_terms_sections" DROP COLUMN "body";
;
ALTER TABLE "salons_terms_sections" DROP COLUMN "title";
;
ALTER TABLE "salons_terms_sections" DROP COLUMN "body";
;
ALTER TABLE "salons_terms_sections" DROP COLUMN "_locale";
;
ALTER TABLE "reservations" DROP COLUMN "is_birthday";
;
ALTER TABLE "roles_capabilities" DROP COLUMN "_order";
;
ALTER TABLE "roles_capabilities" DROP COLUMN "_parent_id";
;
ALTER TABLE "salons_locales" DROP COLUMN "cancel_email_body";
;
ALTER TABLE "salons_locales" DROP COLUMN "reminder_email_body";
;
ALTER TABLE "salons_locales" DROP COLUMN "confirm_email_subject";
;
ALTER TABLE "salons_locales" DROP COLUMN "confirm_email_body";
;
ALTER TABLE "services" DROP COLUMN "name";
;
ALTER TABLE "services" DROP COLUMN "description";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "shifts_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "memberships_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "roles_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "reviews_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "waitlist_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "audit_log_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "email_log_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "push_subscriptions_id";
;
ALTER TABLE "payload_preferences_rels" DROP COLUMN "tasks_id";
;
ALTER TABLE "staff" DROP COLUMN "bio";
;
ALTER TABLE "staff" DROP COLUMN "emergency_contact";
;
ALTER TABLE "restaurants" DROP COLUMN "description";
;
ALTER TABLE "restaurants" DROP COLUMN "booking_email_subject";
;
ALTER TABLE "restaurants" DROP COLUMN "booking_email_intro";
;
ALTER TABLE "restaurants" DROP COLUMN "supported_locales";
;
ALTER TABLE "salons" DROP COLUMN "description";
;
ALTER TABLE "salons" DROP COLUMN "booking_email_subject";
;
ALTER TABLE "salons" DROP COLUMN "booking_email_intro";
;
ALTER TABLE "salons" DROP COLUMN "supported_locales";
;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons" DROP COLUMN "supported_locales";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons" DROP COLUMN "booking_email_intro";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons" DROP COLUMN "booking_email_subject";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons" DROP COLUMN "description";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants" DROP COLUMN "supported_locales";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants" DROP COLUMN "booking_email_intro";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants" DROP COLUMN "booking_email_subject";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants" DROP COLUMN "description";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "staff" DROP COLUMN "emergency_contact";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "staff" DROP COLUMN "bio";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "tasks_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "push_subscriptions_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "email_log_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "audit_log_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "waitlist_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "reviews_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "roles_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "memberships_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "payload_preferences_rels" DROP COLUMN "shifts_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "services" DROP COLUMN "description";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "services" DROP COLUMN "name";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_locales" DROP COLUMN "confirm_email_body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_locales" DROP COLUMN "confirm_email_subject";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_locales" DROP COLUMN "reminder_email_body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_locales" DROP COLUMN "cancel_email_body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "roles_capabilities" DROP COLUMN "_parent_id";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "roles_capabilities" DROP COLUMN "_order";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "reservations" DROP COLUMN "is_birthday";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_terms_sections" DROP COLUMN "_locale";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_terms_sections" DROP COLUMN "body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_terms_sections" DROP COLUMN "title";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants_terms_sections" DROP COLUMN "body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants_terms_sections" DROP COLUMN "title";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "service_categories" DROP COLUMN "description";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "service_categories" DROP COLUMN "duration_label";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "service_categories" DROP COLUMN "name";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_good_to_know" DROP COLUMN "body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "salons_good_to_know" DROP COLUMN "title";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "memberships" DROP COLUMN "emergency_contact";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants_good_to_know" DROP COLUMN "body";
-- (oszlop visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) ALTER TABLE "restaurants_good_to_know" DROP COLUMN "title";
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" DROP COLUMN "invoice_pdf_base64";
DROP INDEX "memberships_invite_token_idx";
DROP INDEX "staff_user_idx";
DROP INDEX "waitlist_created_at_idx";
DROP INDEX "waitlist_updated_at_idx";
DROP INDEX "waitlist_token_idx";
DROP INDEX "restaurants_event_types_locales_locale_parent_id_unique";
DROP INDEX "restaurants_positions_parent_id_idx";
DROP INDEX "services_subcategory_idx";
DROP INDEX "services_category_idx";
DROP INDEX "shifts_created_at_idx";
DROP INDEX "shifts_updated_at_idx";
DROP INDEX "shifts_member_idx";
DROP INDEX "staff_documents_file_idx";
DROP INDEX "staff_documents_parent_id_idx";
DROP INDEX "roles_capabilities_parent_idx";
DROP INDEX "roles_capabilities_order_idx";
DROP INDEX "reservations_payment_intent_id_idx";
DROP INDEX "reservations_series_id_idx";
DROP INDEX "payload_locked_documents_rels_trial_ledger_id_idx";
DROP INDEX "payload_locked_documents_rels_invoices_id_idx";
DROP INDEX "payload_locked_documents_rels_email_log_id_idx";
DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
DROP INDEX "payload_locked_documents_rels_push_subscriptions_id_idx";
DROP INDEX "payload_locked_documents_rels_roles_id_idx";
DROP INDEX "payload_locked_documents_rels_memberships_id_idx";
DROP INDEX "payload_locked_documents_rels_reviews_id_idx";
DROP INDEX "payload_locked_documents_rels_marketing_campaigns_id_idx";
DROP INDEX "payload_locked_documents_rels_customers_id_idx";
DROP INDEX "payload_locked_documents_rels_gift_voucher_types_id_idx";
DROP INDEX "payload_locked_documents_rels_gift_vouchers_id_idx";
DROP INDEX "payload_locked_documents_rels_waitlist_id_idx";
DROP INDEX "payload_locked_documents_rels_shifts_id_idx";
DROP INDEX "reviews_created_at_idx";
DROP INDEX "reviews_updated_at_idx";
DROP INDEX "reviews_booking_idx";
DROP INDEX "reviews_reservation_idx";
DROP INDEX "bookings_payment_intent_id_idx";
DROP INDEX "bookings_series_id_idx";
DROP INDEX "roles_created_at_idx";
DROP INDEX "roles_updated_at_idx";
DROP INDEX "restaurants_event_types_parent_id_idx";
DROP INDEX "restaurants_event_types_order_idx";
DROP INDEX "memberships_created_at_idx";
DROP INDEX "memberships_updated_at_idx";
DROP INDEX "memberships_avatar_idx";
DROP INDEX "memberships_custom_role_idx";
DROP INDEX "restaurants_daily_tips_parent_id_idx";
DROP INDEX "restaurants_daily_tips_order_idx";
DROP INDEX "audit_log_created_at_idx";
DROP INDEX "audit_log_updated_at_idx";
DROP INDEX "email_log_created_at_idx";
DROP INDEX "email_log_updated_at_idx";
DROP INDEX "email_log_campaign_idx";
DROP INDEX "email_log_restaurant_idx";
DROP INDEX "email_log_salon_idx";
DROP INDEX "email_log_reservation_idx";
DROP INDEX "email_log_booking_idx";
DROP INDEX "email_log_status_idx";
DROP INDEX "email_log_resend_id_idx";
DROP INDEX "email_log_type_idx";
DROP INDEX "memberships_position_history_parent_id_idx";
DROP INDEX "memberships_position_history_order_idx";
DROP INDEX "customers_created_at_idx";
DROP INDEX "customers_updated_at_idx";
DROP INDEX "invoices_created_at_idx";
DROP INDEX "invoices_updated_at_idx";
DROP INDEX "notifications_voucher_idx";
DROP INDEX "notifications_user_idx";
DROP INDEX "memberships_documents_file_idx";
DROP INDEX "memberships_documents_parent_id_idx";
DROP INDEX "memberships_documents_order_idx";
DROP INDEX "push_subscriptions_created_at_idx";
DROP INDEX "push_subscriptions_updated_at_idx";
DROP INDEX "push_subscriptions_endpoint_idx";
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_terms_sections_locales" ADD CONSTRAINT "restaurants_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types_locales" ADD CONSTRAINT "restaurants_event_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_event_types"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_supported_locales" ADD CONSTRAINT "restaurants_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" ADD CONSTRAINT "restaurants_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_good_to_know_locales" ADD CONSTRAINT "salons_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "services" ADD CONSTRAINT "services_subcategory_id_service_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" ADD CONSTRAINT "salons_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "staff_locales" ADD CONSTRAINT "staff_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" ADD CONSTRAINT "shifts_member_id_memberships_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" ADD CONSTRAINT "roles_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "service_categories_locales" ADD CONSTRAINT "service_categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "services_locales" ADD CONSTRAINT "services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_ledger_fk" FOREIGN KEY ("trial_ledger_id") REFERENCES "public"."trial_ledger"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_log_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_log"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_campaigns_fk" FOREIGN KEY ("marketing_campaigns_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_voucher_types_fk" FOREIGN KEY ("gift_voucher_types_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_vouchers_fk" FOREIGN KEY ("gift_vouchers_id") REFERENCES "public"."gift_vouchers"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waitlist_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shifts_fk" FOREIGN KEY ("shifts_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_supported_locales" ADD CONSTRAINT "salons_supported_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" ADD CONSTRAINT "restaurants_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_terms_sections_locales" ADD CONSTRAINT "salons_terms_sections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_terms_sections"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types" ADD CONSTRAINT "restaurants_event_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ADD CONSTRAINT "memberships_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_daily_tips" ADD CONSTRAINT "restaurants_daily_tips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ADD CONSTRAINT "email_log_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ADD CONSTRAINT "email_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ADD CONSTRAINT "email_log_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ADD CONSTRAINT "email_log_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ADD CONSTRAINT "email_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_good_to_know_locales" ADD CONSTRAINT "restaurants_good_to_know_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_good_to_know"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "notifications" ADD CONSTRAINT "notifications_voucher_id_gift_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."gift_vouchers"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships_documents" ADD CONSTRAINT "memberships_documents_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
DROP INDEX "trial_ledger_created_at_idx";
DROP INDEX "trial_ledger_updated_at_idx";
DROP INDEX "trial_ledger_email_idx";
DROP INDEX "marketing_campaigns_created_at_idx";
DROP INDEX "marketing_campaigns_updated_at_idx";
DROP INDEX "marketing_campaigns_salon_idx";
DROP INDEX "marketing_campaigns_restaurant_idx";
DROP INDEX "gift_voucher_types_locales_locale_parent_id_unique";
DROP INDEX "gift_voucher_types_created_at_idx";
DROP INDEX "gift_voucher_types_updated_at_idx";
DROP INDEX "gift_voucher_types_image_idx";
DROP INDEX "gift_voucher_types_salon_idx";
DROP INDEX "gift_voucher_types_restaurant_idx";
DROP INDEX "gift_vouchers_created_at_idx";
DROP INDEX "gift_vouchers_updated_at_idx";
DROP INDEX "gift_vouchers_redeemed_reservation_idx";
DROP INDEX "gift_vouchers_redeemed_booking_idx";
DROP INDEX "gift_vouchers_payment_intent_id_idx";
DROP INDEX "gift_vouchers_image_idx";
DROP INDEX "gift_vouchers_code_idx";
DROP INDEX "gift_vouchers_voucher_type_idx";
DROP INDEX "gift_vouchers_salon_idx";
DROP INDEX "gift_vouchers_restaurant_idx";
DROP INDEX "restaurants_custom_questions_locales_locale_parent_id_unique";
DROP INDEX "restaurants_custom_questions_parent_id_idx";
DROP INDEX "restaurants_custom_questions_order_idx";
DROP INDEX "restaurants_custom_questions_options_locales_locale_parent_i";
DROP INDEX "restaurants_custom_questions_options_parent_id_idx";
DROP INDEX "restaurants_custom_questions_options_order_idx";
DROP INDEX "salons_custom_questions_locales_locale_parent_id_unique";
DROP INDEX "salons_custom_questions_parent_id_idx";
DROP INDEX "salons_custom_questions_order_idx";
DROP INDEX "salons_custom_questions_options_locales_locale_parent_id_uni";
DROP INDEX "salons_custom_questions_options_parent_id_idx";
DROP INDEX "salons_custom_questions_options_order_idx";
-- (nem automatikusan visszafordítható) ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_voucher_types_locales" ADD CONSTRAINT "gift_voucher_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_voucher_types" ADD CONSTRAINT "gift_voucher_types_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_redeemed_reservation_id_reservations_id_fk" FOREIGN KEY ("redeemed_reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_redeemed_booking_id_bookings_id_fk" FOREIGN KEY ("redeemed_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_voucher_type_id_gift_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."gift_voucher_types"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_custom_questions_locales" ADD CONSTRAINT "restaurants_custom_questions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_custom_questions" ADD CONSTRAINT "restaurants_custom_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_custom_questions_options_locales" ADD CONSTRAINT "restaurants_custom_questions_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions_options"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_custom_questions_options" ADD CONSTRAINT "restaurants_custom_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_custom_questions_locales" ADD CONSTRAINT "salons_custom_questions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_custom_questions" ADD CONSTRAINT "salons_custom_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_custom_questions_options_locales" ADD CONSTRAINT "salons_custom_questions_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions_options"("id") ON DELETE cascade ON UPDATE no action;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_custom_questions_options" ADD CONSTRAINT "salons_custom_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "salons" DROP COLUMN "invoice_settings_billingo_api_key_enc";
ALTER TABLE "salons" DROP COLUMN "invoice_settings_szamlazz_agent_key_enc";
ALTER TABLE "salons" DROP COLUMN "invoice_settings_invoice_provider";
ALTER TABLE "salons" DROP COLUMN "stripe_connect_onboarded";
ALTER TABLE "salons" DROP COLUMN "stripe_connect_account_id";
ALTER TABLE "salons" DROP COLUMN "marketing_tracking_facebook_pixel_id";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ADD COLUMN "marketing_tracking_ga4_measurement_id" varchar;
ALTER TABLE "salons" DROP COLUMN "consent_settings_enabled";
ALTER TABLE "salons" DROP COLUMN "newsletter_settings_sending";
ALTER TABLE "salons" DROP COLUMN "newsletter_settings_package";
ALTER TABLE "salons" DROP COLUMN "voucher_settings_validity_months";
ALTER TABLE "salons" DROP COLUMN "voucher_settings_max_amount_huf";
ALTER TABLE "salons" DROP COLUMN "voucher_settings_min_amount_huf";
ALTER TABLE "salons" DROP COLUMN "voucher_settings_enabled";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_payment_gateway";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_refund_hours_before";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_per_pax_amount_huf";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_percent_value";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_fixed_amount_huf";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_type";
ALTER TABLE "salons" DROP COLUMN "deposit_settings_enabled";
ALTER TABLE "salons" DROP COLUMN "custom_monthly_fee_huf";
ALTER TABLE "users" DROP COLUMN "_verificationtoken";
ALTER TABLE "users" DROP COLUMN "_verified";
ALTER TABLE "users" DROP COLUMN "personal_notif_prefs_schedule_email";
ALTER TABLE "users" DROP COLUMN "personal_notif_prefs_bookings_email";
ALTER TABLE "users" DROP COLUMN "personal_notif_prefs_email_not_opened";
ALTER TABLE "users" DROP COLUMN "role_title";
ALTER TABLE "users" DROP COLUMN "tax_number";
ALTER TABLE "restaurants" DROP COLUMN "invoice_settings_billingo_api_key_enc";
ALTER TABLE "restaurants" DROP COLUMN "invoice_settings_szamlazz_agent_key_enc";
ALTER TABLE "restaurants" DROP COLUMN "invoice_settings_invoice_provider";
ALTER TABLE "restaurants" DROP COLUMN "stripe_connect_onboarded";
ALTER TABLE "restaurants" DROP COLUMN "stripe_connect_account_id";
ALTER TABLE "restaurants" DROP COLUMN "marketing_tracking_facebook_pixel_id";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ADD COLUMN "marketing_tracking_ga4_measurement_id" varchar;
ALTER TABLE "restaurants" DROP COLUMN "consent_settings_enabled";
ALTER TABLE "restaurants" DROP COLUMN "newsletter_settings_sending";
ALTER TABLE "restaurants" DROP COLUMN "newsletter_settings_package";
ALTER TABLE "restaurants" DROP COLUMN "voucher_settings_validity_months";
ALTER TABLE "restaurants" DROP COLUMN "voucher_settings_max_amount_huf";
ALTER TABLE "restaurants" DROP COLUMN "voucher_settings_min_amount_huf";
ALTER TABLE "restaurants" DROP COLUMN "voucher_settings_enabled";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_payment_gateway";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_refund_hours_before";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_per_pax_amount_huf";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_percent_value";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_fixed_amount_huf";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_type";
ALTER TABLE "restaurants" DROP COLUMN "deposit_settings_enabled";
ALTER TABLE "restaurants" DROP COLUMN "custom_monthly_fee_huf";
ALTER TABLE "staff" DROP COLUMN "tax_number";
ALTER TABLE "staff" DROP COLUMN "user_id";
ALTER TABLE "salons_locales" DROP COLUMN "consent_settings_template_text";
ALTER TABLE "salons_locales" DROP COLUMN "consent_settings_title";
ALTER TABLE "reservations" DROP COLUMN "custom_answers";
ALTER TABLE "reservations" DROP COLUMN "consent_accepted_ip";
ALTER TABLE "reservations" DROP COLUMN "consent_text_snapshot";
ALTER TABLE "reservations" DROP COLUMN "consent_accepted_via";
ALTER TABLE "reservations" DROP COLUMN "consent_accepted_at";
ALTER TABLE "reservations" DROP COLUMN "consent_accepted";
ALTER TABLE "reservations" DROP COLUMN "voucher_discount_huf";
ALTER TABLE "reservations" DROP COLUMN "voucher_code";
ALTER TABLE "reservations" DROP COLUMN "invoice_status";
ALTER TABLE "reservations" DROP COLUMN "invoice_pdf_url";
ALTER TABLE "reservations" DROP COLUMN "invoice_number";
ALTER TABLE "reservations" DROP COLUMN "payment_intent_id";
ALTER TABLE "reservations" DROP COLUMN "deposit_refunded";
ALTER TABLE "reservations" DROP COLUMN "deposit_paid";
ALTER TABLE "reservations" DROP COLUMN "deposit_amount_huf";
ALTER TABLE "reservations" DROP COLUMN "payment_status";
ALTER TABLE "reservations" DROP COLUMN "payment_gateway";
ALTER TABLE "reservations" DROP COLUMN "cancelled_at";
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ADD COLUMN "email_open_check_12h" boolean DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ADD COLUMN "email_open_check_24h" boolean DEFAULT false;
ALTER TABLE "reservations" DROP COLUMN "customer_address";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trial_ledger_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "marketing_campaigns_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gift_voucher_types_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gift_vouchers_id";
ALTER TABLE "restaurants_locales" DROP COLUMN "consent_settings_template_text";
ALTER TABLE "restaurants_locales" DROP COLUMN "consent_settings_title";
ALTER TABLE "bookings" DROP COLUMN "custom_answers";
ALTER TABLE "bookings" DROP COLUMN "consent_accepted_ip";
ALTER TABLE "bookings" DROP COLUMN "consent_text_snapshot";
ALTER TABLE "bookings" DROP COLUMN "consent_accepted_via";
ALTER TABLE "bookings" DROP COLUMN "consent_accepted_at";
ALTER TABLE "bookings" DROP COLUMN "consent_accepted";
ALTER TABLE "bookings" DROP COLUMN "voucher_discount_huf";
ALTER TABLE "bookings" DROP COLUMN "voucher_code";
ALTER TABLE "bookings" DROP COLUMN "invoice_status";
ALTER TABLE "bookings" DROP COLUMN "invoice_pdf_url";
ALTER TABLE "bookings" DROP COLUMN "invoice_number";
ALTER TABLE "bookings" DROP COLUMN "payment_intent_id";
ALTER TABLE "bookings" DROP COLUMN "deposit_refunded";
ALTER TABLE "bookings" DROP COLUMN "deposit_paid";
ALTER TABLE "bookings" DROP COLUMN "deposit_amount_huf";
ALTER TABLE "bookings" DROP COLUMN "payment_status";
ALTER TABLE "bookings" DROP COLUMN "payment_gateway";
ALTER TABLE "bookings" DROP COLUMN "cancelled_at";
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ADD COLUMN "email_open_check_12h" boolean DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ADD COLUMN "email_open_check_24h" boolean DEFAULT false;
ALTER TABLE "bookings" DROP COLUMN "customer_address";
ALTER TABLE "roles" DROP COLUMN "booking_notify_level";
ALTER TABLE "memberships" DROP COLUMN "tax_number";
ALTER TABLE "email_log" DROP COLUMN "campaign_id";
ALTER TABLE "email_log" DROP COLUMN "restaurant_id";
ALTER TABLE "email_log" DROP COLUMN "salon_id";
ALTER TABLE "email_log" DROP COLUMN "reservation_id";
ALTER TABLE "email_log" DROP COLUMN "booking_id";
ALTER TABLE "email_log" DROP COLUMN "opened_at";
ALTER TABLE "email_log" DROP COLUMN "delivered_at";
ALTER TABLE "email_log" DROP COLUMN "status";
ALTER TABLE "email_log" DROP COLUMN "resend_id";
ALTER TABLE "pricing_settings" DROP COLUMN "egyedi_email_cap";
ALTER TABLE "pricing_settings" DROP COLUMN "pro_email_cap";
ALTER TABLE "pricing_settings" DROP COLUMN "starter_email_cap";
ALTER TABLE "pricing_settings" DROP COLUMN "restaurant_starter_huf";
ALTER TABLE "pricing_settings" DROP COLUMN "salon_starter_huf";
ALTER TABLE "customers" DROP COLUMN "marketing_consent_at";
ALTER TABLE "customers" DROP COLUMN "marketing_consent";
ALTER TABLE "customers" DROP COLUMN "customer_country";
ALTER TABLE "customers" DROP COLUMN "customer_city";
ALTER TABLE "notifications" DROP COLUMN "voucher_id";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "feature_modules_review_delay_hours" SET DEFAULT 1;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "webhook_url" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "feature_modules_reminder_t_24h" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "tier" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_salons_tier" USING "tier"::"public"."enum_salons_tier";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "tier" SET DEFAULT 'pro'::"public"."enum_salons_tier";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "booking_window_days" SET DEFAULT 60;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons" ALTER COLUMN "booking_buffer_minutes" SET DEFAULT 15;
-- (nem automatikusan visszafordítható) ALTER TABLE "users" ALTER COLUMN "bio" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "users" ALTER COLUMN "login_attempts" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "feature_modules_review_delay_hours" SET DEFAULT 1;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "webhook_url" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "feature_modules_reminder_t_24h" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "tier" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "tier" SET DATA TYPE "public"."enum_restaurants_tier" USING "tier"::"public"."enum_restaurants_tier";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "tier" SET DEFAULT 'pro'::"public"."enum_restaurants_tier";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "booking_window_days" SET DEFAULT 60;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "lead_time_hours" SET DEFAULT 2;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "last_seating_buffer_minutes" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "slot_step_minutes" SET DEFAULT 30;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants" ALTER COLUMN "turn_duration_minutes" SET DEFAULT 120;
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET DATA TYPE "public"."enum_subscriptions_billing_cycle" USING "billing_cycle"::"public"."enum_subscriptions_billing_cycle";
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "billing_cycle" SET DEFAULT 'monthly'::"public"."enum_subscriptions_billing_cycle";
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "restaurant_count" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "salon_count" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" ALTER COLUMN "amount_huf" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "locale" SET DATA TYPE "public"."enum_waitlist_locale" USING "locale"::"public"."enum_waitlist_locale";
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "locale" SET DEFAULT 'hu'::"public"."enum_waitlist_locale";
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "token" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "status" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "status" SET DATA TYPE "public"."enum_waitlist_status" USING "status"::"public"."enum_waitlist_status";
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" ALTER COLUMN "status" SET DEFAULT 'waiting'::"public"."enum_waitlist_status";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "label" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "_parent_id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
-- (nem automatikusan visszafordítható) ALTER TABLE "tables" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "tables" ALTER COLUMN "capacity" SET DEFAULT 4;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" ALTER COLUMN "label" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" ALTER COLUMN "level" SET DATA TYPE "public"."enum_restaurants_positions_level" USING "level"::"public"."enum_restaurants_positions_level";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" ALTER COLUMN "level" SET DEFAULT 'staff'::"public"."enum_restaurants_positions_level";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "rooms" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "services" ALTER COLUMN "category_id" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "services" ALTER COLUMN "duration_minutes" SET DEFAULT 60;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" ALTER COLUMN "feedback_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" ALTER COLUMN "reminder_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" ALTER COLUMN "cancel_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" ALTER COLUMN "left_early_reason" SET DATA TYPE "public"."enum_shifts_left_early_reason" USING "left_early_reason"::"public"."enum_shifts_left_early_reason";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" ALTER COLUMN "type" SET DATA TYPE "public"."enum_shifts_type" USING "type"::"public"."enum_shifts_type";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" ALTER COLUMN "type" SET DEFAULT 'shift'::"public"."enum_shifts_type";
-- (nem automatikusan visszafordítható) ALTER TABLE "staff_documents" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" ALTER COLUMN "order" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" ALTER COLUMN "parent_id" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" ALTER COLUMN "value" SET DATA TYPE "public"."enum_roles_capabilities" USING "value"::"public"."enum_roles_capabilities";
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ALTER COLUMN "feedback_sent" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ALTER COLUMN "reminder_sent" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ALTER COLUMN "locale" SET DEFAULT 'hu';
-- (nem automatikusan visszafordítható) ALTER TABLE "reservations" ALTER COLUMN "pax" SET DEFAULT 2;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" ALTER COLUMN "feedback_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" ALTER COLUMN "reminder_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" ALTER COLUMN "cancel_email_intro" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" ALTER COLUMN "comment" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" ALTER COLUMN "rating" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "service_categories" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ALTER COLUMN "feedback_sent" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ALTER COLUMN "reminder_sent" SET DEFAULT false;
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ALTER COLUMN "locale" SET DEFAULT 'hu';
-- (nem automatikusan visszafordítható) ALTER TABLE "bookings" ALTER COLUMN "staff_id" DROP NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types" ALTER COLUMN "icon" SET DEFAULT 'party';
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "bio" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "pay_type" SET DATA TYPE "public"."enum_memberships_pay_type" USING "pay_type"::"public"."enum_memberships_pay_type";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "pay_type" SET DEFAULT 'daily'::"public"."enum_memberships_pay_type";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "status" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "status" SET DATA TYPE "public"."enum_memberships_status" USING "status"::"public"."enum_memberships_status";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'invited'::"public"."enum_memberships_status";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "role" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE "public"."enum_memberships_role" USING "role"::"public"."enum_memberships_role";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'staff'::"public"."enum_memberships_role";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" ALTER COLUMN "email" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "amount" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "date" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_daily_tips" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "audit_log" ALTER COLUMN "action" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ALTER COLUMN "type" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "email_log" ALTER COLUMN "type" SET DATA TYPE "public"."enum_email_log_type" USING "type"::"public"."enum_email_log_type";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships_position_history" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "annual_discount_pct" SET DEFAULT 20;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "annual_discount_pct" SET DATA TYPE numeric;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "salon_extra_staff_huf" SET DEFAULT 1900;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "salon_extra_staff_huf" SET DATA TYPE numeric;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "trial_days" SET DEFAULT 14;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "restaurant_pro_huf" SET DEFAULT 23800;
-- (nem automatikusan visszafordítható) ALTER TABLE "pricing_settings" ALTER COLUMN "salon_pro_huf" SET DEFAULT 6800;
-- (nem automatikusan visszafordítható) ALTER TABLE "customers" ALTER COLUMN "notes" SET DATA TYPE varchar;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET DEFAULT now();
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3) with time zone;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "created_at" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "created_at" SET DEFAULT now();
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "created_at" SET DATA TYPE timestamp(3) with time zone;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "issued_at" SET DATA TYPE timestamp(3) with time zone;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "amount_huf" SET DATA TYPE numeric;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" ALTER COLUMN "subscription_id" SET NOT NULL;
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships_documents" ALTER COLUMN "id" SET DATA TYPE varchar;
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "memberships_invite_token_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "restaurants_positions_parent_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "staff_documents_parent_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "restaurants_event_types_parent_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "memberships_status_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "restaurants_daily_tips_parent_idx";
-- (index visszaállítás kihagyva, nem kritikus) DROP INDEX "invoices_stripe_invoice_id_idx";
-- (nem automatikusan visszafordítható) ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_owner_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_terms_sections_locales" DROP CONSTRAINT "restaurants_terms_sections_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_terms_sections_locales" DROP CONSTRAINT "restaurants_terms_sections_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" DROP CONSTRAINT "waitlist_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "waitlist" DROP CONSTRAINT "waitlist_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types_locales" DROP CONSTRAINT "restaurants_event_types_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "tables" DROP CONSTRAINT "tables_room_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "tables" DROP CONSTRAINT "tables_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_supported_locales" DROP CONSTRAINT "restaurants_supported_locales_parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "tasks" DROP CONSTRAINT "tasks_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "tasks" DROP CONSTRAINT "tasks_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_positions" DROP CONSTRAINT "restaurants_positions_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_good_to_know_locales" DROP CONSTRAINT "salons_good_to_know_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_good_to_know_locales" DROP CONSTRAINT "salons_good_to_know_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "rooms" DROP CONSTRAINT "rooms_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" DROP CONSTRAINT "salons_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_locales" DROP CONSTRAINT "salons_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "staff_locales" DROP CONSTRAINT "staff_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "staff_locales" DROP CONSTRAINT "staff_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" DROP CONSTRAINT "shifts_staff_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" DROP CONSTRAINT "shifts_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" DROP CONSTRAINT "shifts_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "shifts" DROP CONSTRAINT "shifts_member_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "staff_documents" DROP CONSTRAINT "staff_documents_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" DROP CONSTRAINT "roles_capabilities_parent_id_roles_id_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "roles_capabilities" DROP CONSTRAINT "roles_capabilities_parent_id_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "service_categories_locales" DROP CONSTRAINT "service_categories_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "service_categories_locales" DROP CONSTRAINT "service_categories_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "services_locales" DROP CONSTRAINT "services_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "services_locales" DROP CONSTRAINT "services_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoices_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_supported_locales" DROP CONSTRAINT "salons_supported_locales_parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" DROP CONSTRAINT "restaurants_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_locales" DROP CONSTRAINT "restaurants_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" DROP CONSTRAINT "reviews_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "reviews" DROP CONSTRAINT "reviews_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_terms_sections_locales" DROP CONSTRAINT "salons_terms_sections_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_terms_sections_locales" DROP CONSTRAINT "salons_terms_sections_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_terms_sections" DROP CONSTRAINT "salons_terms_sections_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_terms_sections" DROP CONSTRAINT "restaurants_terms_sections_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "service_categories" DROP CONSTRAINT "service_categories_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "salons_good_to_know" DROP CONSTRAINT "salons_good_to_know_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "roles" DROP CONSTRAINT "roles_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "roles" DROP CONSTRAINT "roles_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_event_types" DROP CONSTRAINT "restaurants_event_types_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" DROP CONSTRAINT "memberships_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" DROP CONSTRAINT "memberships_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships" DROP CONSTRAINT "memberships_custom_role_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_daily_tips" DROP CONSTRAINT "restaurants_daily_tips_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "opening_hours_exceptions" DROP CONSTRAINT "opening_hours_exceptions_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_good_to_know" DROP CONSTRAINT "restaurants_good_to_know_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_good_to_know_locales" DROP CONSTRAINT "restaurants_good_to_know_locales_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "restaurants_good_to_know_locales" DROP CONSTRAINT "restaurants_good_to_know_locales__parent_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships_position_history" DROP CONSTRAINT "memberships_position_history_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "availability" DROP CONSTRAINT "availability_staff_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "availability" DROP CONSTRAINT "availability_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "customers" DROP CONSTRAINT "customers_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "customers" DROP CONSTRAINT "customers_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";
-- (nem automatikusan visszafordítható) ALTER TABLE "notifications" DROP CONSTRAINT "notifications_salon_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "notifications" DROP CONSTRAINT "notifications_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "opening_hours" DROP CONSTRAINT "opening_hours_restaurant_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "memberships_documents" DROP CONSTRAINT "memberships_documents_parent_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_user_id_users_id_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_user_fk";
-- (nem automatikusan visszafordítható) ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_endpoint_unique";
-- (tábla visszaállítás kihagyva — lásd eredeti prod_schema.sql, ha éles rollback kell) DROP TABLE "invoice_pdfs" CASCADE;
-- (nem automatikusan visszafordítható) ALTER TABLE "invoice_pdfs" DISABLE ROW LEVEL SECURITY;
DROP TABLE "trial_ledger" CASCADE;
DROP TABLE "marketing_campaigns" CASCADE;
DROP TABLE "gift_voucher_types_locales" CASCADE;
DROP TABLE "gift_voucher_types" CASCADE;
DROP TABLE "gift_vouchers" CASCADE;
DROP TABLE "restaurants_custom_questions_locales" CASCADE;
DROP TABLE "restaurants_custom_questions" CASCADE;
DROP TABLE "restaurants_custom_questions_options_locales" CASCADE;
DROP TABLE "restaurants_custom_questions_options" CASCADE;
DROP TABLE "salons_custom_questions_locales" CASCADE;
DROP TABLE "salons_custom_questions" CASCADE;
DROP TABLE "salons_custom_questions_options_locales" CASCADE;
DROP TABLE "salons_custom_questions_options" CASCADE;
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'voucher_purchase';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'email_not_opened';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'schedule_change';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'digest_evening';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'digest_morning';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'modification' BEFORE 'new_signup';
-- (nem visszavonható: enum-érték eltávolítás Postgres-ben nem támogatott) ALTER TYPE "public"."enum_notifications_audience" ADD VALUE 'member' BEFORE 'admin';
DROP TYPE "public"."enum_email_log_status";
DROP TYPE "public"."enum_email_log_type";
DROP TYPE "public"."enum_audit_log_action";
DROP TYPE "public"."enum_roles_booking_notify_level";
DROP TYPE "public"."enum_roles_capabilities";
DROP TYPE "public"."enum_memberships_pay_type";
DROP TYPE "public"."enum_memberships_status";
DROP TYPE "public"."enum_memberships_role";
DROP TYPE "public"."enum_marketing_campaigns_status";
DROP TYPE "public"."enum_gift_vouchers_locale";
DROP TYPE "public"."enum_gift_vouchers_invoice_status";
DROP TYPE "public"."enum_gift_vouchers_status";
DROP TYPE "public"."enum_waitlist_locale";
DROP TYPE "public"."enum_waitlist_status";
DROP TYPE "public"."enum_reservations_consent_accepted_via";
DROP TYPE "public"."enum_reservations_invoice_status";
DROP TYPE "public"."enum_reservations_payment_status";
DROP TYPE "public"."enum_reservations_payment_gateway";
DROP TYPE "public"."enum_restaurants_invoice_settings_invoice_provider";
DROP TYPE "public"."enum_restaurants_newsletter_settings_package";
DROP TYPE "public"."enum_restaurants_deposit_settings_payment_gateway";
DROP TYPE "public"."enum_restaurants_deposit_settings_type";
DROP TYPE "public"."enum_restaurants_tier";
DROP TYPE "public"."enum_restaurants_custom_questions_type";
DROP TYPE "public"."enum_restaurants_positions_level";
DROP TYPE "public"."enum_subscriptions_billing_cycle";
DROP TYPE "public"."enum_bookings_consent_accepted_via";
DROP TYPE "public"."enum_bookings_invoice_status";
DROP TYPE "public"."enum_bookings_payment_status";
DROP TYPE "public"."enum_bookings_payment_gateway";
DROP TYPE "public"."enum_shifts_left_early_reason";
DROP TYPE "public"."enum_shifts_type";
DROP TYPE "public"."enum_salons_invoice_settings_invoice_provider";
DROP TYPE "public"."enum_salons_newsletter_settings_package";
DROP TYPE "public"."enum_salons_deposit_settings_payment_gateway";
DROP TYPE "public"."enum_salons_deposit_settings_type";
DROP TYPE "public"."enum_salons_tier";
DROP TYPE "public"."enum_salons_custom_questions_type";
  `)
}
