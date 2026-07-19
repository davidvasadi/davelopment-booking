import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels
      ADD COLUMN IF NOT EXISTS invoices_id integer REFERENCES invoices(id) ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS invoices_id;
  `)
}
