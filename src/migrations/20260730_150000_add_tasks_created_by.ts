import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "created_by_id" integer;

  DO $$ BEGIN
   ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "tasks_created_by_idx" ON "tasks" USING btree ("created_by_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_created_by_id_users_id_fk";
  DROP INDEX IF EXISTS "tasks_created_by_idx";
  ALTER TABLE "tasks" DROP COLUMN IF EXISTS "created_by_id";
  `)
}
