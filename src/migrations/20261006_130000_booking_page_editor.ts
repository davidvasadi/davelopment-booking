import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Foglalóoldal-szerkesztő mezői.
 *  - `booking_rules.show_service_count_on_public` / `show_staff_count_on_public`: a fejléc-számláló
 *    két külön kapcsolója — a régi közös kapcsoló értékét másoljuk át, így semmi nem változik.
 *  - `booking_rules.min_lead_hours`: üzlet-szintű alap minimum foglalási idő (munkatárs felülírja).
 *  - `booking_rules.public_section_order` / `public_sections_hidden`: a foglaló kártya főnézetének
 *    szakasz-sorrendje és rejtett szakaszai (NULL = alapsorrend, minden látható).
 *  - `salons.cover_focal_mobile_x/y`: külön mobil fókuszpont (NULL = a desktop fókusz).
 * A `booking_rules` csoport közös, ezért az étterem táblán is létrejönnek az oszlopok.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons"
  ADD COLUMN IF NOT EXISTS "booking_rules_show_service_count_on_public" boolean,
  ADD COLUMN IF NOT EXISTS "booking_rules_show_staff_count_on_public" boolean,
  ADD COLUMN IF NOT EXISTS "booking_rules_min_lead_hours" numeric,
  ADD COLUMN IF NOT EXISTS "booking_rules_public_section_order" jsonb,
  ADD COLUMN IF NOT EXISTS "booking_rules_public_sections_hidden" jsonb,
  ADD COLUMN IF NOT EXISTS "cover_focal_mobile_x" numeric,
  ADD COLUMN IF NOT EXISTS "cover_focal_mobile_y" numeric;
ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "booking_rules_show_service_count_on_public" boolean,
  ADD COLUMN IF NOT EXISTS "booking_rules_show_staff_count_on_public" boolean,
  ADD COLUMN IF NOT EXISTS "booking_rules_min_lead_hours" numeric,
  ADD COLUMN IF NOT EXISTS "booking_rules_public_section_order" jsonb,
  ADD COLUMN IF NOT EXISTS "booking_rules_public_sections_hidden" jsonb;
UPDATE "salons" SET
  "booking_rules_show_service_count_on_public" = COALESCE("booking_rules_show_catalog_counts_on_public", true),
  "booking_rules_show_staff_count_on_public" = COALESCE("booking_rules_show_catalog_counts_on_public", true)
WHERE "booking_rules_show_service_count_on_public" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "salons"
  DROP COLUMN IF EXISTS "booking_rules_show_service_count_on_public",
  DROP COLUMN IF EXISTS "booking_rules_show_staff_count_on_public",
  DROP COLUMN IF EXISTS "booking_rules_min_lead_hours",
  DROP COLUMN IF EXISTS "booking_rules_public_section_order",
  DROP COLUMN IF EXISTS "booking_rules_public_sections_hidden",
  DROP COLUMN IF EXISTS "cover_focal_mobile_x",
  DROP COLUMN IF EXISTS "cover_focal_mobile_y";
ALTER TABLE "restaurants"
  DROP COLUMN IF EXISTS "booking_rules_show_service_count_on_public",
  DROP COLUMN IF EXISTS "booking_rules_show_staff_count_on_public",
  DROP COLUMN IF EXISTS "booking_rules_min_lead_hours",
  DROP COLUMN IF EXISTS "booking_rules_public_section_order",
  DROP COLUMN IF EXISTS "booking_rules_public_sections_hidden";`)
}
