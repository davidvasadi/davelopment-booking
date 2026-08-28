import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Az összes `*_email_intro` mező (visszaigazoló/lemondó/emlékeztető/visszajelzés-kérő/
 * tulajdonosi értesítő × szalon+étterem) sima szövegből (varchar) blokk-alapú tartalommá
 * (jsonb, `ComposerBlock[]` — lásd lib/emailBlocks.ts) vált, hogy UGYANAZT a szerkesztőt
 * kaphassa, mint a marketing hírlevél. A meglévő, kézzel írt szövegeket egy 1-elemű
 * `[{type:'text', html: <régi szöveg>}]` tömbbe csomagoljuk, hogy semmi ne vesszen el.
 */
function alterUp(table: string, col: string): string {
  return `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE jsonb USING (
  CASE WHEN "${col}" IS NULL OR btrim("${col}") = '' THEN NULL
  ELSE jsonb_build_array(jsonb_build_object('id', 'blk-migrated', 'type', 'text', 'html', "${col}"))
  END
);`
}

const FIELDS = ['booking_email_intro', 'cancel_email_intro', 'reminder_email_intro', 'feedback_email_intro', 'notify_email_intro']
const TABLES = ['salons_locales', 'restaurants_locales']

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const statements = TABLES.flatMap((t) => FIELDS.map((c) => alterUp(t, c))).join('\n')
  await db.execute(sql.raw(statements))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const statements = TABLES.flatMap((t) => FIELDS.map((c) => `ALTER TABLE "${t}" ALTER COLUMN "${c}" TYPE varchar USING (NULL);`)).join('\n')
  await db.execute(sql.raw(statements))
}
