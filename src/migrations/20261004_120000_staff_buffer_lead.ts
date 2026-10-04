import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Munkatársankénti foglalási szünet (perc) és minimum foglalási idő előre (óra). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "staff"
      ADD COLUMN IF NOT EXISTS "booking_buffer_minutes" numeric,
      ADD COLUMN IF NOT EXISTS "min_lead_hours" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "staff"
      DROP COLUMN IF EXISTS "booking_buffer_minutes",
      DROP COLUMN IF EXISTS "min_lead_hours";
  `)
}
