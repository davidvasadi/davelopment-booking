import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A foglalóoldal megjelenése (design 21.x / 21.6): `public_page` csoport (arculat, borító-sötétítés, borító-elemek,
 * foglalás gomb, szolgáltatás-megjelenítés), `gallery` (kép + nyelvenkénti felirat), `services.online_visible`.
 * Az alapértékekkel az oldal ugyanúgy néz ki, mint eddig.
 */
const ENUMS: [string, string[], string][] = [
  ['card_style', ['dark', 'black', 'glass', 'white'], 'dark'],
  ['card_text', ['auto', 'light', 'dark'], 'auto'],
  ['button_text', ['auto', 'light', 'dark'], 'auto'],
  ['cover_dim', ['none', 'soft', 'strong'], 'soft'],
  ['services_order', ['manual', 'popular'], 'manual'],
]
const BOOLS: [string, boolean][] = [['show_rating', true], ['rating_opens', true], ['show_social', true], ['cta_next_free', true], ['cta_deposit_badge', false], ['services_filter', true], ['services_images', true], ['services_price', true]]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    const parts: string[] = [`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_accent_color" varchar;`]
    for (const [f, vals, def] of ENUMS) {
      parts.push(`DO $$ BEGIN CREATE TYPE "public"."enum_${t}_public_page_${f}" AS ENUM(${vals.map((v) => `'${v}'`).join(', ')}); EXCEPTION WHEN duplicate_object THEN null; END $$;`)
      parts.push(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_${f}" "enum_${t}_public_page_${f}" DEFAULT '${def}';`)
    }
    for (const [f, def] of BOOLS) parts.push(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "public_page_${f}" boolean DEFAULT ${def};`)
    parts.push(`ALTER TABLE "${t}_locales" ADD COLUMN IF NOT EXISTS "public_page_cta_label" varchar;`)
    parts.push(`
      CREATE TABLE IF NOT EXISTS "${t}_gallery" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "image_id" integer
      );
      CREATE INDEX IF NOT EXISTS "${t}_gallery_order_idx" ON "${t}_gallery" USING btree ("_order");
      CREATE INDEX IF NOT EXISTS "${t}_gallery_parent_id_idx" ON "${t}_gallery" USING btree ("_parent_id");
      CREATE INDEX IF NOT EXISTS "${t}_gallery_image_idx" ON "${t}_gallery" USING btree ("image_id");
      DO $$ BEGIN ALTER TABLE "${t}_gallery" ADD CONSTRAINT "${t}_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."${t}"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN ALTER TABLE "${t}_gallery" ADD CONSTRAINT "${t}_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
      CREATE TABLE IF NOT EXISTS "${t}_gallery_locales" (
        "caption" varchar,
        "id" serial PRIMARY KEY NOT NULL,
        "_locale" "_locales" NOT NULL,
        "_parent_id" varchar NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "${t}_gallery_locales_locale_parent_id_unique" ON "${t}_gallery_locales" USING btree ("_locale", "_parent_id");
      DO $$ BEGIN ALTER TABLE "${t}_gallery_locales" ADD CONSTRAINT "${t}_gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."${t}_gallery"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
    `)
    await db.execute(sql.raw(parts.join('\n')))
  }
  await db.execute(sql.raw(`ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "online_visible" boolean DEFAULT true;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    const parts = [`DROP TABLE IF EXISTS "${t}_gallery_locales";`, `DROP TABLE IF EXISTS "${t}_gallery";`, `ALTER TABLE "${t}_locales" DROP COLUMN IF EXISTS "public_page_cta_label";`, `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_accent_color";`]
    for (const [f] of ENUMS) parts.push(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_${f}";`, `DROP TYPE IF EXISTS "public"."enum_${t}_public_page_${f}";`)
    for (const [f] of BOOLS) parts.push(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "public_page_${f}";`)
    await db.execute(sql.raw(parts.join('\n')))
  }
  await db.execute(sql.raw(`ALTER TABLE "services" DROP COLUMN IF EXISTS "online_visible";`))
}
