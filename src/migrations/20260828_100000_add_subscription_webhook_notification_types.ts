import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `notifications.type` új értékei: `trial_ending`/`dispute_created`/`fraud_warning` — az élő
 * Stripe webhookba most felvett `customer.subscription.trial_will_end`/`charge.dispute.created`/
 * `radar.early_fraud_warning.created` események notification-létrehozásához. Ugyanaz a hiba
 * történt volna, mint az `admin_broadcast`/`contact_message` esetében (ld. 20260828_000000):
 * a Payload-kollekció mezőlistája és az élő Postgres enum sose eshet szét, minden új
 * select-értéket migrálni kell.
 * DOWN: Postgres nem tudja simán eltávolítani egy enum-értéket — a visszafordítás szándékosan
 * no-op.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'trial_ending';
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'dispute_created';
ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'fraud_warning';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // no-op — lásd fenti megjegyzés.
}
