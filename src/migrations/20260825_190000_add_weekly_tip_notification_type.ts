import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Új `notifications.type` érték a proaktív, heti tipp-értesítéshez (tipsAdvisor → push).
 * DOWN: Postgres nem tudja simán eltávolítani egy enum-értéket — a visszafordítás
 * szándékosan no-op (a régi típusú sorok megmaradnak, csak az érték nem választható újra).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'weekly_tip';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // no-op — lásd fenti megjegyzés.
}
