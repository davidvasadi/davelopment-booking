import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A `notifications.type` mező `contact_message`/`admin_broadcast` értékei a Payload-kollekcióban
 * (Notifications.ts) már jóval korábban éltek, de a `20260825_120000_add_contact_broadcast_
 * notif_campaign` migráció (ami a hozzájuk tartozó `contact_messages`/`broadcast_log` táblákat +
 * a `notifications.campaign_id` oszlopot hozta létre) ELFELEJTETTE ezt a két enum-értéket
 * hozzáadni magához az `enum_notifications_type` Postgres típushoz — emiatt MINDEN kapcsolat-
 * üzenet és admin körüzenet notification-létrehozás elhasalt élesben ("invalid input value for
 * enum", a Drizzle generic "Failed query" hibaként takarta el a valódi okot).
 * DOWN: Postgres nem tudja simán eltávolítani egy enum-értéket — a visszafordítás szándékosan
 * no-op (a régi típusú sorok megmaradnak, csak az érték nem választható újra).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'contact_message';
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'admin_broadcast';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // no-op — lásd fenti megjegyzés.
}
