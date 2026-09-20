import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// A custom_questions/event_types `label` mezője localized+required volt — ez azt jelentette,
// hogy egy MÉG LE NEM FORDÍTOTT nyelven (pl. angol) a mentés a NOT NULL/required ütközés miatt
// mindig elhasalt ("Mentés sikertelen"), akkor is, ha a user csak egy másik mezőt (pl. email
// tárgy) próbált menteni azon a nyelven — a `saveLocale()` ugyanis MINDEN localizált mezőt
// egyben küld, és az üres (még le nem fordított) label-ek elbuktatták az egészet.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "restaurants_custom_questions_locales" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "salons_custom_questions_locales" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "label" DROP NOT NULL;
  `)
}

// Nem automatikusan visszafordítható (ha közben keletkezett NULL érték, a SET NOT NULL elhasalna).
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "restaurants_custom_questions_locales" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "salons_custom_questions_locales" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "restaurants_event_types_locales" ALTER COLUMN "label" SET NOT NULL;
  `)
}
