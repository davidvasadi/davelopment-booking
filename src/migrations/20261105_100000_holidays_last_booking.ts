import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Nyitvatartás (design 16.8): a szalon utolsó foglalható időpontja zárás előtt (perc; 0 = a régi működés). A munkaszüneti
 *  napokat a rendszer csak jelzi (lib/huHolidays), nem zár automatikusan — ezért ahhoz nincs mező. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "last_booking_buffer_minutes" numeric DEFAULT 0;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "salons" DROP COLUMN IF EXISTS "last_booking_buffer_minutes";
  `))
}
