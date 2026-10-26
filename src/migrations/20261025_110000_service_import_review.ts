import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Import által (mellékhatásként) létrehozott szolgáltatás jelölése — a Szolgáltatások listán
 *  „Importált — nézd át” címkét kap, amíg a tulaj nem szerkeszti (ld. Services.ts beforeChange). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "import_review" boolean DEFAULT false;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "services" DROP COLUMN IF EXISTS "import_review";
  `))
}
