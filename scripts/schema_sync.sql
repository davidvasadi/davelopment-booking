-- ============================================================
-- Schedulio / Payload CMS — idempotent schema sync
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Generated from: src/payload/collections/*.ts
-- ============================================================

-- ============================================================
-- 1. USERS  (slug: users → table: users)
-- Payload auth collections get extra columns automatically;
-- we only add the custom fields.
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS name               varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url         varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone              varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday           timestamp(3) with time zone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS join_date          timestamp(3) with time zone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address            varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_id             varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact  varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_hours       numeric;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio                text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role               varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salon_id           integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id      integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_business varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status             varchar;

-- ============================================================
-- 2. MEDIA  (slug: media → table: media)
-- Upload collections get filename, url, mime_type etc from Payload.
-- Custom field:
-- ============================================================
ALTER TABLE media ADD COLUMN IF NOT EXISTS alt                varchar;

-- ============================================================
-- 3. SALONS  (slug: salons → table: salons)
-- ============================================================
ALTER TABLE salons ADD COLUMN IF NOT EXISTS name                          varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS slug                          varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS owner_id                      integer;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS logo_id                       integer;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS cover_image_id                integer;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS address                       varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS city                          varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS postal_code                   varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS phone                         varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email                         varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS website                       varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_buffer_minutes        integer;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_window_days           integer;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS require_phone                 boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notify_new_bookings           boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS tier                          varchar;
-- notification_prefs group (stored as flat columns by Payload)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notification_prefs_confirm_email  boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notification_prefs_cancel_email   boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notification_prefs_reminder_email boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notification_prefs_feedback_email boolean;
-- booking_rules group
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_rules_auto_confirm         boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_rules_deposit_enabled      boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_rules_waitlist_enabled     boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS booking_rules_cancellation_protection boolean;
-- feature_modules group
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminders_on        boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminder_ch_email   boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminder_ch_push    boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_24h      boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_3h       boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_1h       boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_waitlist_on         boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_waitlist_auto_promote boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_recurring_on        boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_reviews_on          boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS feature_modules_google_review_url   varchar;
-- email template fields (localized → salons_locales, see below)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_show_phone             boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_contact_phone          varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_show_email             boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_show_address           boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_show_directions        boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_directions_address     varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS legal_name                   varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS tax_number                   varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS company_reg_number           varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS registered_seat              varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS supported_locales            varchar;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_active                    boolean;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS admin_notes                  text;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS webhook_url                  text;

-- salons_locales (localized: description richText, booking_email_subject, booking_email_intro,
--   cancel_email_subject, cancel_email_intro, reminder_email_subject, reminder_email_intro,
--   feedback_email_subject, feedback_email_intro)
CREATE TABLE IF NOT EXISTS salons_locales (
    id              serial PRIMARY KEY,
    _locale         varchar NOT NULL,
    _parent_id      integer NOT NULL,
    description     jsonb,
    booking_email_subject  varchar,
    booking_email_intro    text,
    cancel_email_subject   varchar,
    cancel_email_intro     text,
    reminder_email_subject varchar,
    reminder_email_intro   text,
    feedback_email_subject varchar,
    feedback_email_intro   text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON salons_locales TO schedulio;
GRANT ALL ON SEQUENCE salons_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE salons_locales ADD CONSTRAINT salons_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- salons_terms_sections array
CREATE TABLE IF NOT EXISTS salons_terms_sections (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL
);
ALTER TABLE salons_terms_sections ADD COLUMN IF NOT EXISTS _locale varchar;
GRANT ALL ON salons_terms_sections TO schedulio;
GRANT ALL ON SEQUENCE salons_terms_sections_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE salons_terms_sections ADD CONSTRAINT salons_terms_sections_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- salons_terms_sections_locales (title + body are localized)
CREATE TABLE IF NOT EXISTS salons_terms_sections_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    title       varchar,
    body        text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON salons_terms_sections_locales TO schedulio;
GRANT ALL ON SEQUENCE salons_terms_sections_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE salons_terms_sections_locales ADD CONSTRAINT salons_terms_sections_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES salons_terms_sections(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- salons_good_to_know array
CREATE TABLE IF NOT EXISTS salons_good_to_know (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    icon        varchar
);
GRANT ALL ON salons_good_to_know TO schedulio;
GRANT ALL ON SEQUENCE salons_good_to_know_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE salons_good_to_know ADD CONSTRAINT salons_good_to_know_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- salons_good_to_know_locales (title + body localized)
CREATE TABLE IF NOT EXISTS salons_good_to_know_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    title       varchar,
    body        text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON salons_good_to_know_locales TO schedulio;
GRANT ALL ON SEQUENCE salons_good_to_know_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE salons_good_to_know_locales ADD CONSTRAINT salons_good_to_know_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES salons_good_to_know(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 4. RESTAURANTS  (slug: restaurants → table: restaurants)
-- ============================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS name                           varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug                           varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id                       integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city                           varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address                        varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone                          varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email                          varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website                        varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cover_image_id                 integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_id                        integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS turn_duration_minutes          integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slot_step_minutes              integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS last_seating_buffer_minutes    integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lead_time_hours                integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_window_days            integer;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS require_phone                  boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notify_new_bookings            boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tier                           varchar;
-- notification_prefs group
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_prefs_confirm_email  boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_prefs_cancel_email   boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_prefs_reminder_email boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS notification_prefs_feedback_email boolean;
-- booking_rules group
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_rules_auto_confirm         boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_rules_deposit_enabled      boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_rules_waitlist_enabled     boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_rules_cancellation_protection boolean;
-- feature_modules group
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminders_on        boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminder_ch_email   boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminder_ch_push    boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_24h      boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_3h       boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reminder_t_1h       boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_waitlist_on         boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_waitlist_auto_promote boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_recurring_on        boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_reviews_on          boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS feature_modules_google_review_url   varchar;
-- email settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_show_phone             boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_contact_phone          varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_show_email             boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_show_address           boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_show_directions        boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_directions_address     varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS legal_name                   varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_number                   varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS company_reg_number           varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS registered_seat              varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS supported_locales            varchar;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active                    boolean;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS admin_notes                  text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS webhook_url                  text;

-- restaurants_locales (description, booking_email_*, cancel_email_*, reminder_email_*, feedback_email_*)
CREATE TABLE IF NOT EXISTS restaurants_locales (
    id              serial PRIMARY KEY,
    _locale         varchar NOT NULL,
    _parent_id      integer NOT NULL,
    description     text,
    booking_email_subject  varchar,
    booking_email_intro    text,
    cancel_email_subject   varchar,
    cancel_email_intro     text,
    reminder_email_subject varchar,
    reminder_email_intro   text,
    feedback_email_subject varchar,
    feedback_email_intro   text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON restaurants_locales TO schedulio;
GRANT ALL ON SEQUENCE restaurants_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_locales ADD CONSTRAINT restaurants_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- restaurants_positions array
CREATE TABLE IF NOT EXISTS restaurants_positions (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    label       varchar,
    level       varchar
);
GRANT ALL ON restaurants_positions TO schedulio;
GRANT ALL ON SEQUENCE restaurants_positions_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_positions ADD CONSTRAINT restaurants_positions_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- restaurants_daily_tips array
CREATE TABLE IF NOT EXISTS restaurants_daily_tips (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    date        varchar,
    amount      numeric
);
GRANT ALL ON restaurants_daily_tips TO schedulio;
GRANT ALL ON SEQUENCE restaurants_daily_tips_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_daily_tips ADD CONSTRAINT restaurants_daily_tips_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- restaurants_terms_sections array
CREATE TABLE IF NOT EXISTS restaurants_terms_sections (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL
);
GRANT ALL ON restaurants_terms_sections TO schedulio;
GRANT ALL ON SEQUENCE restaurants_terms_sections_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_terms_sections ADD CONSTRAINT restaurants_terms_sections_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS restaurants_terms_sections_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    title       varchar,
    body        text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON restaurants_terms_sections_locales TO schedulio;
GRANT ALL ON SEQUENCE restaurants_terms_sections_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_terms_sections_locales ADD CONSTRAINT restaurants_terms_sections_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants_terms_sections(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- restaurants_good_to_know array
CREATE TABLE IF NOT EXISTS restaurants_good_to_know (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    icon        varchar
);
GRANT ALL ON restaurants_good_to_know TO schedulio;
GRANT ALL ON SEQUENCE restaurants_good_to_know_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_good_to_know ADD CONSTRAINT restaurants_good_to_know_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS restaurants_good_to_know_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    title       varchar,
    body        text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON restaurants_good_to_know_locales TO schedulio;
GRANT ALL ON SEQUENCE restaurants_good_to_know_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_good_to_know_locales ADD CONSTRAINT restaurants_good_to_know_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants_good_to_know(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- restaurants_event_types array
CREATE TABLE IF NOT EXISTS restaurants_event_types (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    icon        varchar,
    enabled     boolean
);
GRANT ALL ON restaurants_event_types TO schedulio;
GRANT ALL ON SEQUENCE restaurants_event_types_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_event_types ADD CONSTRAINT restaurants_event_types_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS restaurants_event_types_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    label       varchar,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON restaurants_event_types_locales TO schedulio;
GRANT ALL ON SEQUENCE restaurants_event_types_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE restaurants_event_types_locales ADD CONSTRAINT restaurants_event_types_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES restaurants_event_types(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 5. BOOKINGS  (slug: bookings → table: bookings)
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS salon_id            integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id          integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_id            integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name       varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email      varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone      varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_city       varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date                varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time          varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time            varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status              varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent       boolean;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feedback_sent       boolean;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_id           varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_token  varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locale              varchar;

-- ============================================================
-- 6. RESERVATIONS  (slug: reservations → table: reservations)
-- ============================================================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS restaurant_id    integer;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS date             varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS start_time       varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_time         varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pax              integer;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_name    varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_email   varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_phone   varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_city    varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS country          varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes            text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS internal_notes   text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS occasion         varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS occasion_icon    varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status           varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source           varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminder_sent    boolean;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS feedback_sent    boolean;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS series_id        varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_token     varchar;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS locale           varchar;

-- reservations → tables  many-to-many (hasMany relationship)
-- Payload stores hasMany rels in a junction/rels table; the main pattern is
-- a separate _rels table OR a child table per collection. Using child array table:
CREATE TABLE IF NOT EXISTS reservations_rels (
    id              serial PRIMARY KEY,
    order_val       integer,
    parent_id       integer NOT NULL,
    path            varchar NOT NULL,
    tables_id       integer
);
GRANT ALL ON reservations_rels TO schedulio;
GRANT ALL ON SEQUENCE reservations_rels_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE reservations_rels ADD CONSTRAINT reservations_rels_parent_fk
    FOREIGN KEY (parent_id) REFERENCES reservations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 7. STAFF  (slug: staff → table: staff)
-- ============================================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS name              varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salon_id          integer;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_id         integer;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active         boolean;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role_title        varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department        varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary            numeric;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS birthday          timestamp(3) with time zone;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS join_date         timestamp(3) with time zone;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_hours      numeric;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone             varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email             varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address           varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tax_id            varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact varchar;

-- staff_locales (bio is localized)
CREATE TABLE IF NOT EXISTS staff_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    bio         text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON staff_locales TO schedulio;
GRANT ALL ON SEQUENCE staff_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE staff_locales ADD CONSTRAINT staff_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES staff(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- staff_documents array
CREATE TABLE IF NOT EXISTS staff_documents (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    label       varchar,
    file_id     integer
);
GRANT ALL ON staff_documents TO schedulio;
GRANT ALL ON SEQUENCE staff_documents_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE staff_documents ADD CONSTRAINT staff_documents_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES staff(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 8. SERVICES  (slug: services → table: services)
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id       integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS subcategory_id    integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_id          integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS salon_id          integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes  integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price             numeric;
ALTER TABLE services ADD COLUMN IF NOT EXISTS currency          varchar;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active         boolean;

-- services_locales (name + description localized)
CREATE TABLE IF NOT EXISTS services_locales (
    id          serial PRIMARY KEY,
    _locale     varchar NOT NULL,
    _parent_id  integer NOT NULL,
    name        varchar,
    description text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON services_locales TO schedulio;
GRANT ALL ON SEQUENCE services_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE services_locales ADD CONSTRAINT services_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES services(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- services → staff  many-to-many (hasMany)
CREATE TABLE IF NOT EXISTS services_rels (
    id          serial PRIMARY KEY,
    order_val   integer,
    parent_id   integer NOT NULL,
    path        varchar NOT NULL,
    staff_id    integer
);
GRANT ALL ON services_rels TO schedulio;
GRANT ALL ON SEQUENCE services_rels_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE services_rels ADD CONSTRAINT services_rels_parent_fk
    FOREIGN KEY (parent_id) REFERENCES services(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 9. SERVICE-CATEGORIES  (slug: service-categories → table: service_categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_categories (
    id          serial PRIMARY KEY,
    image_id    integer,
    sort_order  integer,
    salon_id    integer,
    updated_at  timestamp(3) with time zone,
    created_at  timestamp(3) with time zone
);
GRANT ALL ON service_categories TO schedulio;
GRANT ALL ON SEQUENCE service_categories_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE service_categories ADD CONSTRAINT service_categories_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- service_categories_locales (name, duration_label, description localized)
CREATE TABLE IF NOT EXISTS service_categories_locales (
    id             serial PRIMARY KEY,
    _locale        varchar NOT NULL,
    _parent_id     integer NOT NULL,
    name           varchar,
    duration_label varchar,
    description    text,
    UNIQUE (_locale, _parent_id)
);
GRANT ALL ON service_categories_locales TO schedulio;
GRANT ALL ON SEQUENCE service_categories_locales_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE service_categories_locales ADD CONSTRAINT service_categories_locales_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES service_categories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 10. AVAILABILITY  (slug: availability → table: availability)
-- ============================================================
CREATE TABLE IF NOT EXISTS availability (
    id              serial PRIMARY KEY,
    salon_id        integer,
    staff_id        integer,
    day_of_week     varchar,
    start_time      varchar,
    end_time        varchar,
    is_available    boolean,
    recurring       boolean,
    exception_date  varchar,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON availability TO schedulio;
GRANT ALL ON SEQUENCE availability_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE availability ADD CONSTRAINT availability_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE availability ADD CONSTRAINT availability_staff_fk
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 11. OPENING-HOURS  (slug: opening-hours → table: opening_hours)
-- ============================================================
CREATE TABLE IF NOT EXISTS opening_hours (
    id            serial PRIMARY KEY,
    restaurant_id integer NOT NULL,
    day_of_week   varchar,
    is_open       boolean,
    open_time     varchar,
    close_time    varchar,
    updated_at    timestamp(3) with time zone,
    created_at    timestamp(3) with time zone
);
GRANT ALL ON opening_hours TO schedulio;
GRANT ALL ON SEQUENCE opening_hours_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE opening_hours ADD CONSTRAINT opening_hours_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 12. OPENING-HOURS-EXCEPTIONS  (slug: opening-hours-exceptions → table: opening_hours_exceptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS opening_hours_exceptions (
    id            serial PRIMARY KEY,
    restaurant_id integer NOT NULL,
    label         varchar,
    start_date    varchar,
    end_date      varchar,
    is_closed     boolean,
    open_time     varchar,
    close_time    varchar,
    updated_at    timestamp(3) with time zone,
    created_at    timestamp(3) with time zone
);
GRANT ALL ON opening_hours_exceptions TO schedulio;
GRANT ALL ON SEQUENCE opening_hours_exceptions_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE opening_hours_exceptions ADD CONSTRAINT opening_hours_exceptions_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 13. ROOMS  (slug: rooms → table: rooms)
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    id            serial PRIMARY KEY,
    restaurant_id integer NOT NULL,
    name          varchar,
    is_outdoor    boolean,
    is_active     boolean,
    seasonal      boolean,
    season_start  varchar,
    season_end    varchar,
    sort_order    integer,
    updated_at    timestamp(3) with time zone,
    created_at    timestamp(3) with time zone
);
GRANT ALL ON rooms TO schedulio;
GRANT ALL ON SEQUENCE rooms_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE rooms ADD CONSTRAINT rooms_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 14. TABLES  (slug: tables → table: tables)
-- ============================================================
CREATE TABLE IF NOT EXISTS tables (
    id            serial PRIMARY KEY,
    restaurant_id integer NOT NULL,
    name          varchar,
    capacity      integer,
    room_id       integer,
    is_active     boolean,
    sort_order    integer,
    updated_at    timestamp(3) with time zone,
    created_at    timestamp(3) with time zone
);
GRANT ALL ON tables TO schedulio;
GRANT ALL ON SEQUENCE tables_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE tables ADD CONSTRAINT tables_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE tables ADD CONSTRAINT tables_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- tables_combinable_with array (self-join hasMany)
CREATE TABLE IF NOT EXISTS tables_rels (
    id              serial PRIMARY KEY,
    order_val       integer,
    parent_id       integer NOT NULL,
    path            varchar NOT NULL,
    tables_id       integer
);
GRANT ALL ON tables_rels TO schedulio;
GRANT ALL ON SEQUENCE tables_rels_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE tables_rels ADD CONSTRAINT tables_rels_parent_fk
    FOREIGN KEY (parent_id) REFERENCES tables(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 15. SHIFTS  (slug: shifts → table: shifts)
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
    id              serial PRIMARY KEY,
    staff_id        integer,
    salon_id        integer,
    member_id       integer,
    restaurant_id   integer,
    date            timestamp(3) with time zone,
    type            varchar,
    start_time      varchar,
    end_time        varchar,
    hours           numeric,
    note            varchar,
    left_early_at   varchar,
    left_early_reason varchar,
    owner_shift     boolean,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON shifts TO schedulio;
GRANT ALL ON SEQUENCE shifts_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE shifts ADD CONSTRAINT shifts_staff_fk
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE shifts ADD CONSTRAINT shifts_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE shifts ADD CONSTRAINT shifts_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 16. MEMBERSHIPS  (slug: memberships → table: memberships)
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
    id                  serial PRIMARY KEY,
    user_id             integer,
    email               varchar NOT NULL,
    name                varchar,
    salon_id            integer,
    restaurant_id       integer,
    role                varchar,
    custom_role_id      integer,
    status              varchar,
    invite_token        varchar UNIQUE,
    position            varchar,
    avatar_id           integer,
    phone               varchar,
    birthday            timestamp(3) with time zone,
    address             varchar,
    tax_id              varchar,
    emergency_contact   varchar,
    join_date           timestamp(3) with time zone,
    weekly_hours        numeric,
    pay_type            varchar,
    pay_rate            numeric,
    tip_eligible        boolean,
    salary              numeric,
    bio                 text,
    suspended_at        timestamp(3) with time zone,
    updated_at          timestamp(3) with time zone,
    created_at          timestamp(3) with time zone
);
GRANT ALL ON memberships TO schedulio;
GRANT ALL ON SEQUENCE memberships_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE memberships ADD CONSTRAINT memberships_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE memberships ADD CONSTRAINT memberships_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE memberships ADD CONSTRAINT memberships_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- memberships_position_history array
CREATE TABLE IF NOT EXISTS memberships_position_history (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    position    varchar,
    changed_at  timestamp(3) with time zone
);
GRANT ALL ON memberships_position_history TO schedulio;
GRANT ALL ON SEQUENCE memberships_position_history_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE memberships_position_history ADD CONSTRAINT memberships_position_history_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES memberships(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- memberships_documents array
CREATE TABLE IF NOT EXISTS memberships_documents (
    id          serial PRIMARY KEY,
    _order      integer NOT NULL,
    _parent_id  integer NOT NULL,
    label       varchar,
    file_id     integer
);
GRANT ALL ON memberships_documents TO schedulio;
GRANT ALL ON SEQUENCE memberships_documents_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE memberships_documents ADD CONSTRAINT memberships_documents_parent_fk
    FOREIGN KEY (_parent_id) REFERENCES memberships(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- shifts FK to memberships (member_id)
DO $$ BEGIN
  ALTER TABLE shifts ADD CONSTRAINT shifts_member_fk
    FOREIGN KEY (member_id) REFERENCES memberships(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 17. ROLES  (slug: roles → table: roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id              serial PRIMARY KEY,
    name            varchar NOT NULL,
    salon_id        integer,
    restaurant_id   integer,
    capabilities    varchar,  -- stored as JSON array or comma-separated by Payload
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON roles TO schedulio;
GRANT ALL ON SEQUENCE roles_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE roles ADD CONSTRAINT roles_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE roles ADD CONSTRAINT roles_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- memberships FK to roles
DO $$ BEGIN
  ALTER TABLE memberships ADD CONSTRAINT memberships_custom_role_fk
    FOREIGN KEY (custom_role_id) REFERENCES roles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 18. SUBSCRIPTIONS  (slug: subscriptions → table: subscriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id                      serial PRIMARY KEY,
    owner_id                integer NOT NULL UNIQUE,
    plan                    varchar,
    status                  varchar,
    salon_count             integer,
    restaurant_count        integer,
    breakdown               varchar,
    trial_ends_at           timestamp(3) with time zone,
    current_period_end      timestamp(3) with time zone,
    cancel_at_period_end    boolean,
    billing_cycle           varchar,
    amount_huf              numeric,
    stripe_customer_id      varchar,
    stripe_subscription_id  varchar,
    last_stripe_invoice_id  varchar,
    last_invoice_number     varchar,
    last_invoice_url        varchar,
    notes                   text,
    updated_at              timestamp(3) with time zone,
    created_at              timestamp(3) with time zone
);
GRANT ALL ON subscriptions TO schedulio;
GRANT ALL ON SEQUENCE subscriptions_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_owner_fk
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 19. NOTIFICATIONS  (slug: notifications → table: notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              serial PRIMARY KEY,
    restaurant_id   integer,
    salon_id        integer,
    audience        varchar,
    type            varchar,
    title           varchar NOT NULL,
    body            varchar,
    read            boolean,
    reservation_id  integer,
    booking_id      integer,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON notifications TO schedulio;
GRANT ALL ON SEQUENCE notifications_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 20. PUSH-SUBSCRIPTIONS  (slug: push-subscriptions → table: push_subscriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          serial PRIMARY KEY,
    user_id     integer NOT NULL,
    endpoint    varchar NOT NULL UNIQUE,
    p256dh      varchar NOT NULL,
    auth        varchar NOT NULL,
    user_agent  varchar,
    updated_at  timestamp(3) with time zone,
    created_at  timestamp(3) with time zone
);
GRANT ALL ON push_subscriptions TO schedulio;
GRANT ALL ON SEQUENCE push_subscriptions_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 21. REVIEWS  (slug: reviews → table: reviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id              serial PRIMARY KEY,
    restaurant_id   integer,
    salon_id        integer,
    reservation_id  integer,
    booking_id      integer,
    rating          integer,
    comment         text,
    customer_name   varchar,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON reviews TO schedulio;
GRANT ALL ON SEQUENCE reviews_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 22. CUSTOMERS  (slug: customers → table: customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id              serial PRIMARY KEY,
    restaurant_id   integer,
    salon_id        integer,
    customer_name   varchar,
    customer_email  varchar,
    customer_phone  varchar,
    notes           text,
    match_index     varchar,
    blocked         boolean,
    block_reason    varchar,
    blocked_at      timestamp(3) with time zone,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON customers TO schedulio;
GRANT ALL ON SEQUENCE customers_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 23. WAITLIST  (slug: waitlist → table: waitlist)
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
    id              serial PRIMARY KEY,
    restaurant_id   integer,
    salon_id        integer,
    date            varchar NOT NULL,
    time            varchar NOT NULL,
    pax             integer,
    customer_name   varchar NOT NULL,
    customer_email  varchar NOT NULL,
    customer_phone  varchar,
    status          varchar,
    token           varchar NOT NULL UNIQUE,
    locale          varchar,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON waitlist TO schedulio;
GRANT ALL ON SEQUENCE waitlist_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE waitlist ADD CONSTRAINT waitlist_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE waitlist ADD CONSTRAINT waitlist_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 24. AUDIT-LOG  (slug: audit-log → table: audit_log)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              serial PRIMARY KEY,
    actor_id        integer,
    actor_label     varchar,
    actor_email     varchar,
    action          varchar NOT NULL,
    collection_name varchar,
    doc_id          varchar,
    summary         varchar,
    changes         jsonb,
    salon_id        integer,
    restaurant_id   integer,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON audit_log TO schedulio;
GRANT ALL ON SEQUENCE audit_log_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_fk
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 25. EMAIL-LOG  (slug: email-log → table: email_log)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
    id          serial PRIMARY KEY,
    type        varchar NOT NULL,
    "to"        varchar,
    subject     varchar,
    ok          boolean,
    error       varchar,
    updated_at  timestamp(3) with time zone,
    created_at  timestamp(3) with time zone
);
GRANT ALL ON email_log TO schedulio;
GRANT ALL ON SEQUENCE email_log_id_seq TO schedulio;

-- ============================================================
-- 26. TASKS  (slug: tasks → table: tasks)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id              serial PRIMARY KEY,
    restaurant_id   integer,
    salon_id        integer,
    title           varchar NOT NULL,
    done            boolean,
    due_date        timestamp(3) with time zone,
    updated_at      timestamp(3) with time zone,
    created_at      timestamp(3) with time zone
);
GRANT ALL ON tasks TO schedulio;
GRANT ALL ON SEQUENCE tasks_id_seq TO schedulio;

DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_restaurant_fk
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_salon_fk
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- PATCH: ALTER TABLE for tables that already existed in baseline
-- but are missing newer columns (CREATE TABLE IF NOT EXISTS skips them)
-- ============================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS owner_id              integer,
  ADD COLUMN IF NOT EXISTS plan                  varchar,
  ADD COLUMN IF NOT EXISTS status                varchar,
  ADD COLUMN IF NOT EXISTS salon_count           integer,
  ADD COLUMN IF NOT EXISTS restaurant_count      integer,
  ADD COLUMN IF NOT EXISTS breakdown             varchar,
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  boolean,
  ADD COLUMN IF NOT EXISTS billing_cycle         varchar,
  ADD COLUMN IF NOT EXISTS amount_huf            numeric,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    varchar,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar,
  ADD COLUMN IF NOT EXISTS last_stripe_invoice_id varchar,
  ADD COLUMN IF NOT EXISTS last_invoice_number   varchar,
  ADD COLUMN IF NOT EXISTS last_invoice_url      varchar,
  ADD COLUMN IF NOT EXISTS notes                 text;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS restaurant_id  integer,
  ADD COLUMN IF NOT EXISTS salon_id       integer,
  ADD COLUMN IF NOT EXISTS audience       varchar,
  ADD COLUMN IF NOT EXISTS type           varchar,
  ADD COLUMN IF NOT EXISTS title          varchar,
  ADD COLUMN IF NOT EXISTS body           varchar,
  ADD COLUMN IF NOT EXISTS read           boolean,
  ADD COLUMN IF NOT EXISTS reservation_id integer,
  ADD COLUMN IF NOT EXISTS booking_id     integer;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS restaurant_id integer,
  ADD COLUMN IF NOT EXISTS name          varchar,
  ADD COLUMN IF NOT EXISTS is_outdoor    boolean,
  ADD COLUMN IF NOT EXISTS is_active     boolean,
  ADD COLUMN IF NOT EXISTS seasonal      boolean,
  ADD COLUMN IF NOT EXISTS season_start  varchar,
  ADD COLUMN IF NOT EXISTS season_end    varchar,
  ADD COLUMN IF NOT EXISTS sort_order    integer;

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS restaurant_id integer,
  ADD COLUMN IF NOT EXISTS name          varchar,
  ADD COLUMN IF NOT EXISTS capacity      integer,
  ADD COLUMN IF NOT EXISTS room_id       integer,
  ADD COLUMN IF NOT EXISTS is_active     boolean,
  ADD COLUMN IF NOT EXISTS sort_order    integer;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS restaurant_id integer,
  ADD COLUMN IF NOT EXISTS salon_id      integer,
  ADD COLUMN IF NOT EXISTS title         varchar,
  ADD COLUMN IF NOT EXISTS done          boolean,
  ADD COLUMN IF NOT EXISTS due_date      timestamp(3) with time zone;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id      integer,
  ADD COLUMN IF NOT EXISTS subcategory_id   integer,
  ADD COLUMN IF NOT EXISTS image_id         integer,
  ADD COLUMN IF NOT EXISTS salon_id         integer,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS price            numeric,
  ADD COLUMN IF NOT EXISTS currency         varchar,
  ADD COLUMN IF NOT EXISTS is_active        boolean;

ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS salon_id       integer,
  ADD COLUMN IF NOT EXISTS staff_id       integer,
  ADD COLUMN IF NOT EXISTS day_of_week    varchar,
  ADD COLUMN IF NOT EXISTS start_time     varchar,
  ADD COLUMN IF NOT EXISTS end_time       varchar,
  ADD COLUMN IF NOT EXISTS is_available   boolean,
  ADD COLUMN IF NOT EXISTS recurring      boolean,
  ADD COLUMN IF NOT EXISTS exception_date varchar;

ALTER TABLE opening_hours
  ADD COLUMN IF NOT EXISTS restaurant_id integer,
  ADD COLUMN IF NOT EXISTS day_of_week   varchar,
  ADD COLUMN IF NOT EXISTS is_open       boolean,
  ADD COLUMN IF NOT EXISTS open_time     varchar,
  ADD COLUMN IF NOT EXISTS close_time    varchar;

ALTER TABLE opening_hours_exceptions
  ADD COLUMN IF NOT EXISTS restaurant_id integer,
  ADD COLUMN IF NOT EXISTS label         varchar,
  ADD COLUMN IF NOT EXISTS start_date    varchar,
  ADD COLUMN IF NOT EXISTS end_date      varchar,
  ADD COLUMN IF NOT EXISTS is_closed     boolean,
  ADD COLUMN IF NOT EXISTS open_time     varchar,
  ADD COLUMN IF NOT EXISTS close_time    varchar;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS country       varchar,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS occasion      varchar,
  ADD COLUMN IF NOT EXISTS occasion_icon varchar,
  ADD COLUMN IF NOT EXISTS pax           integer,
  ADD COLUMN IF NOT EXISTS customer_name varchar,
  ADD COLUMN IF NOT EXISTS customer_email varchar,
  ADD COLUMN IF NOT EXISTS customer_phone varchar,
  ADD COLUMN IF NOT EXISTS customer_city varchar;

ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS locale varchar;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS type    varchar,
  ADD COLUMN IF NOT EXISTS "to"    varchar,
  ADD COLUMN IF NOT EXISTS subject varchar,
  ADD COLUMN IF NOT EXISTS ok      boolean,
  ADD COLUMN IF NOT EXISTS error   varchar;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_id        integer,
  ADD COLUMN IF NOT EXISTS actor_label     varchar,
  ADD COLUMN IF NOT EXISTS actor_email     varchar,
  ADD COLUMN IF NOT EXISTS action          varchar,
  ADD COLUMN IF NOT EXISTS collection_name varchar,
  ADD COLUMN IF NOT EXISTS doc_id          varchar,
  ADD COLUMN IF NOT EXISTS summary         varchar,
  ADD COLUMN IF NOT EXISTS changes         jsonb,
  ADD COLUMN IF NOT EXISTS salon_id        integer,
  ADD COLUMN IF NOT EXISTS restaurant_id   integer;

-- ============================================================
-- FIX: roles_capabilities — Payload v3 select+hasMany uses
-- parent_id / order (no underscore), NOT _parent_id / _order.
-- The migration accidentally used array-field naming convention.
-- ============================================================
ALTER TABLE roles_capabilities ADD COLUMN IF NOT EXISTS parent_id integer;
ALTER TABLE roles_capabilities ADD COLUMN IF NOT EXISTS "order"   integer;
UPDATE roles_capabilities SET parent_id = _parent_id WHERE parent_id IS NULL AND _parent_id IS NOT NULL;
UPDATE roles_capabilities SET "order"   = _order     WHERE "order" IS NULL AND _order IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE roles_capabilities ADD CONSTRAINT roles_capabilities_parent_id_roles_id_fk
    FOREIGN KEY (parent_id) REFERENCES roles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
GRANT ALL ON roles_capabilities TO schedulio;

-- ============================================================
-- FIX: payload internal rels tables — need FK columns for every
-- collection, including all new ones added after baseline.
-- ============================================================
ALTER TABLE payload_locked_documents_rels
  ADD COLUMN IF NOT EXISTS shifts_id             integer,
  ADD COLUMN IF NOT EXISTS memberships_id        integer,
  ADD COLUMN IF NOT EXISTS roles_id              integer,
  ADD COLUMN IF NOT EXISTS customers_id          integer,
  ADD COLUMN IF NOT EXISTS reviews_id            integer,
  ADD COLUMN IF NOT EXISTS waitlist_id           integer,
  ADD COLUMN IF NOT EXISTS audit_log_id          integer,
  ADD COLUMN IF NOT EXISTS email_log_id          integer,
  ADD COLUMN IF NOT EXISTS push_subscriptions_id integer,
  ADD COLUMN IF NOT EXISTS tasks_id              integer;

ALTER TABLE payload_preferences_rels
  ADD COLUMN IF NOT EXISTS shifts_id             integer,
  ADD COLUMN IF NOT EXISTS memberships_id        integer,
  ADD COLUMN IF NOT EXISTS roles_id              integer,
  ADD COLUMN IF NOT EXISTS customers_id          integer,
  ADD COLUMN IF NOT EXISTS reviews_id            integer,
  ADD COLUMN IF NOT EXISTS waitlist_id           integer,
  ADD COLUMN IF NOT EXISTS audit_log_id          integer,
  ADD COLUMN IF NOT EXISTS email_log_id          integer,
  ADD COLUMN IF NOT EXISTS push_subscriptions_id integer,
  ADD COLUMN IF NOT EXISTS tasks_id              integer;
