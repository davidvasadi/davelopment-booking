import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `bookings.customer_email` opcionális: a dashboardon kézzel rögzített foglalásnál nem kötelező
 * megadni a vendég e-mail címét. A down csak akkor állítható vissza, ha nincs üres érték.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "bookings" ALTER COLUMN "customer_email" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
UPDATE "bookings" SET "customer_email" = '' WHERE "customer_email" IS NULL;
ALTER TABLE "bookings" ALTER COLUMN "customer_email" SET NOT NULL;
  `)
}
