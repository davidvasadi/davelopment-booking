import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_pdfs (
      invoice_id integer PRIMARY KEY REFERENCES invoices(id) ON DELETE CASCADE,
      pdf_base64 text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS invoice_pdfs;
  `)
}
