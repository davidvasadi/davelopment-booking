import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `social_links` tömb-mező a Salons/Restaurants/Staff collectionökön — a platformot (Instagram,
 * Facebook, TikTok…) mindig a linkből ismerjük fel (lib/socialLinks.ts), NEM tárolt mező, ezért
 * a gyermek-táblának csak egy `url` oszlopa van, ugyanaz a minta, mint a meglévő
 * `salons_good_to_know`/`restaurants_positions` tömb-mezőké.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
CREATE TABLE "salons_social_links" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL
);

CREATE TABLE "restaurants_social_links" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL
);

CREATE TABLE "staff_social_links" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL
);

ALTER TABLE "salons_social_links" ADD CONSTRAINT "salons_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "restaurants_social_links" ADD CONSTRAINT "restaurants_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff_social_links" ADD CONSTRAINT "staff_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "salons_social_links_order_idx" ON "salons_social_links" USING btree ("_order");
CREATE INDEX "salons_social_links_parent_id_idx" ON "salons_social_links" USING btree ("_parent_id");
CREATE INDEX "restaurants_social_links_order_idx" ON "restaurants_social_links" USING btree ("_order");
CREATE INDEX "restaurants_social_links_parent_id_idx" ON "restaurants_social_links" USING btree ("_parent_id");
CREATE INDEX "staff_social_links_order_idx" ON "staff_social_links" USING btree ("_order");
CREATE INDEX "staff_social_links_parent_id_idx" ON "staff_social_links" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
DROP TABLE "salons_social_links" CASCADE;
DROP TABLE "restaurants_social_links" CASCADE;
DROP TABLE "staff_social_links" CASCADE;`)
}
