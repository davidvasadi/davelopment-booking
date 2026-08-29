import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Új opcionális mező a `bookings`/`reservations` táblákon — a vendég adószáma, ha cégként
 * vásárolt (adószámos számlát kért) előleg-fizetéskor. A gift-vouchers ajándékutalvány-vásárlásnál
 * ez a mező már régóta megvan a kódban, csak az előleg-fizetésnél hiányzott a bookings/
 * reservations kollekciókról.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_tax_number" varchar;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "customer_tax_number" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "customer_tax_number";
    ALTER TABLE "reservations" DROP COLUMN IF EXISTS "customer_tax_number";
  `)
}
