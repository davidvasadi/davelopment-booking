import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Melyik hírlevél-kampányból jött a foglalás (a levél foglalás-linkjének `?c=` jelölése) — a kampány „foglalás a
 *  levélből” száma ebből (lib/marketingView). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) {
    await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "marketing_campaign_id" integer;`))
    await db.execute(sql.raw(`DO $$ BEGIN
      ALTER TABLE "${t}" ADD CONSTRAINT "${t}_marketing_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("marketing_campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;`))
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_marketing_campaign_idx" ON "${t}" USING btree ("marketing_campaign_id");`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of ['bookings', 'reservations']) {
    await db.execute(sql.raw(`DROP INDEX IF EXISTS "${t}_marketing_campaign_idx";`))
    await db.execute(sql.raw(`ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_marketing_campaign_id_marketing_campaigns_id_fk";`))
    await db.execute(sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "marketing_campaign_id";`))
  }
}
