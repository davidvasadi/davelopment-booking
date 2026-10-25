import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Import által (mellékhatásként) létrehozott munkatárs jelölése — a Munkatársak listán
 *  „Importált — nézd át” címkét kap, és nem számít bele a fejléc számlálóiba, amíg a tulaj
 *  nem szerkeszti (ld. Staff.ts beforeChange). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "import_review" boolean DEFAULT false;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "staff" DROP COLUMN IF EXISTS "import_review";
  `))
}
