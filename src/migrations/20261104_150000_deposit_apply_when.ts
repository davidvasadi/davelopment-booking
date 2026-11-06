import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Előleg — mely foglalásoknál (design 16.1): mindig / X Ft feletti szolgáltatásnál / X fő felett / kiemelt napokon.
 * A meglévő üzleteknél „mindig” marad (ahogy eddig működött).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "public"."enum_${t}_deposit_settings_apply_when" AS ENUM('always', 'min_price', 'min_pax', 'special_days');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deposit_settings_apply_when" "enum_${t}_deposit_settings_apply_when" DEFAULT 'always';
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deposit_settings_min_price_huf" numeric;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deposit_settings_min_pax" numeric;
      ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deposit_settings_special_days" jsonb;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['salons', 'restaurants']) {
    await db.execute(sql.raw(`
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deposit_settings_apply_when";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deposit_settings_min_price_huf";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deposit_settings_min_pax";
      ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deposit_settings_special_days";
      DROP TYPE IF EXISTS "public"."enum_${t}_deposit_settings_apply_when";
    `))
  }
}
