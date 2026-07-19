import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id serial PRIMARY KEY,
      subscription_id integer REFERENCES subscriptions(id) ON DELETE CASCADE,
      invoice_number varchar NOT NULL,
      invoice_url varchar,
      amount_huf integer,
      stripe_invoice_id varchar,
      issued_at timestamp with time zone,
      test boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS invoices_subscription_idx ON invoices(subscription_id);
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_stripe_invoice_id_idx ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS invoices;`)
}
