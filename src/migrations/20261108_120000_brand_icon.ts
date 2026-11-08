import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Az üzlet ikonja és a „hol mi jelenjen meg” választások (design 24.x, lib/brandImage):
 *  - salons / restaurants: `icon_id` (media), `brand_logo_size`, `brand_page`, `brand_email`, `brand_qr`
 *  - gift_voucher_types: `card_brand` (az üzlet képe a jegyen)
 * Mind üres = az alapbeállítás; csak hozzáad, meglévő adathoz nem nyúl.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "icon_id" integer;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "brand_logo_size" varchar;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "brand_page" varchar;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "brand_email" varchar;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "brand_qr" varchar;
      DO $$ BEGIN
        ALTER TABLE "${t}" ADD CONSTRAINT "${t}_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      CREATE INDEX IF NOT EXISTS "${t}_icon_idx" ON "${t}" USING btree ("icon_id");
    `))
  }
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" ADD COLUMN IF NOT EXISTS "card_brand" varchar;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_icon_id_media_id_fk";
      DROP INDEX IF EXISTS "${t}_icon_idx";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "icon_id";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "brand_logo_size";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "brand_page";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "brand_email";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "brand_qr";
    `))
  }
  await db.execute(sql.raw(`ALTER TABLE "gift_voucher_types" DROP COLUMN IF EXISTS "card_brand";`))
}
