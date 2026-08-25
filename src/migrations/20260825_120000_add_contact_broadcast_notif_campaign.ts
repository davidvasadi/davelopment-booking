import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A `ContactMessages`/`BroadcastLog` collection + `Notifications.campaign_id` mező kódja már
 * jóval korábban élesre került (körüzenet + kapcsolat-form funkció), de séma-migráció SOHA nem
 * készült hozzá — csak a lokális dev DB kapta meg a Payload `push: true` auto-szinkronjával. Az
 * élesen ezért hiányzó `contact_messages_id`/`broadcast_log_id` oszlop a `payload_locked_
 * documents_rels`-en minden mentésnél elhasalt (a dokumentum-zár lekérdezése Payload-ban minden
 * collection-t végigmegy), amit a Payload fail-safe módon "nincs jogod hozzá" (403) hibaként
 * mutatott — ÖSSZES üzleti mentést érintett, nem csak az érintett collectiont. A `notifications.
 * campaign_id` hiánya külön az értesítés-harangot (500) törte.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
CREATE TYPE "public"."enum_contact_messages_status" AS ENUM('new', 'answered');
CREATE TYPE "public"."enum_broadcast_log_target" AS ENUM('all', 'paying', 'trial', 'custom');

CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"message" varchar NOT NULL,
	"status" "public"."enum_contact_messages_status" DEFAULT 'new',
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "broadcast_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"body" varchar NOT NULL,
	"target" "public"."enum_broadcast_log_target" NOT NULL,
	"sent_count" numeric DEFAULT 0 NOT NULL,
	"sent_by_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "notifications" ADD COLUMN "campaign_id" numeric;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contact_messages_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "broadcast_log_id" integer;

ALTER TABLE "broadcast_log" ADD CONSTRAINT "broadcast_log_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_messages_fk" FOREIGN KEY ("contact_messages_id") REFERENCES "public"."contact_messages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_broadcast_log_fk" FOREIGN KEY ("broadcast_log_id") REFERENCES "public"."broadcast_log"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");
CREATE INDEX "contact_messages_updated_at_idx" ON "contact_messages" USING btree ("updated_at");
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");

CREATE INDEX "broadcast_log_sent_by_idx" ON "broadcast_log" USING btree ("sent_by_id");
CREATE INDEX "broadcast_log_updated_at_idx" ON "broadcast_log" USING btree ("updated_at");
CREATE INDEX "broadcast_log_created_at_idx" ON "broadcast_log" USING btree ("created_at");

CREATE INDEX "notifications_campaign_id_idx" ON "notifications" USING btree ("campaign_id");

CREATE INDEX "payload_locked_documents_rels_contact_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("contact_messages_id");
CREATE INDEX "payload_locked_documents_rels_broadcast_log_id_idx" ON "payload_locked_documents_rels" USING btree ("broadcast_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
DROP INDEX "payload_locked_documents_rels_broadcast_log_id_idx";
DROP INDEX "payload_locked_documents_rels_contact_messages_id_idx";
DROP INDEX "notifications_campaign_id_idx";
DROP INDEX "broadcast_log_created_at_idx";
DROP INDEX "broadcast_log_updated_at_idx";
DROP INDEX "broadcast_log_sent_by_idx";
DROP INDEX "contact_messages_created_at_idx";
DROP INDEX "contact_messages_updated_at_idx";
DROP INDEX "contact_messages_status_idx";

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_broadcast_log_fk";
ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contact_messages_fk";
ALTER TABLE "broadcast_log" DROP CONSTRAINT "broadcast_log_sent_by_id_users_id_fk";

ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "broadcast_log_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contact_messages_id";
ALTER TABLE "notifications" DROP COLUMN "campaign_id";

DROP TABLE "broadcast_log";
DROP TABLE "contact_messages";

DROP TYPE "public"."enum_broadcast_log_target";
DROP TYPE "public"."enum_contact_messages_status";`)
}
