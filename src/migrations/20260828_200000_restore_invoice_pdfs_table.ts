import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * A `invoice_pdfs` tábla (eredetileg: 20260719_300000) áldozatul esett a
 * 20260823_014350_sync_pre_launch_schema séma-szinkronnak — az a migráció eldobta, mert
 * kézzel írt tábla (nem Payload-kollekció), a szinkron-eszköz "extrának" látta. Élesben ez
 * a `[stripeCheckoutSync] PDF mentés hiba: relation "invoice_pdfs" does not exist` hibát
 * okozta minden számla-PDF mentésnél. Egyszerűen visszahozzuk, ugyanazzal a sémával.
 */
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
