import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Az ÁFA a beváltáskor / a végszámlán keletkezik (docs/manual): az utalvány eladása és a foglaló befizetése áfa nélküli
 * (TAHK). Hogy a régiek ne adózzanak kétszer, megjelöljük, melyik szabály szerint ment:
 *  - gift_vouchers.vat_mode = 'redemption' (új) — üres = régi (az eladáskor már áfás volt, beváltáskor levonjuk)
 *  - bookings / reservations.deposit_kind = 'foglalo' (új) — üres = régi áfás előleg-számla
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_vouchers" ADD COLUMN IF NOT EXISTS "vat_mode" varchar;`))
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deposit_kind" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "gift_vouchers" DROP COLUMN IF EXISTS "vat_mode";`))
  for (const t of ['bookings', 'reservations']) await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deposit_kind";`))
}
