import * as migration_20260618_134215_baseline from './20260618_134215_baseline';
import * as migration_20260702_081938_add_tasks from './20260702_081938_add_tasks';
import * as migration_20260717_000000_add_new_collections from './20260717_000000_add_new_collections';
import * as migration_20260719_000000_add_billing_fields from './20260719_000000_add_billing_fields';
import * as migration_20260719_100000_add_invoices_table from './20260719_100000_add_invoices_table';
import * as migration_20260719_200000_add_invoice_pdf from './20260719_200000_add_invoice_pdf';
import * as migration_20260719_300000_add_invoice_pdfs_table from './20260719_300000_add_invoice_pdfs_table';
import * as migration_20260719_400000_add_invoices_rels_col from './20260719_400000_add_invoices_rels_col';
import * as migration_20260730_150000_add_tasks_created_by from './20260730_150000_add_tasks_created_by';
import * as migration_20260730_160000_add_roles_notification_prefs from './20260730_160000_add_roles_notification_prefs';
import * as migration_20260730_170000_add_users_personal_notif_prefs from './20260730_170000_add_users_personal_notif_prefs';
import * as migration_20260731_000000_add_users_digest_notif_pref from './20260731_000000_add_users_digest_notif_pref';

export const migrations = [
  {
    up: migration_20260618_134215_baseline.up,
    down: migration_20260618_134215_baseline.down,
    name: '20260618_134215_baseline',
  },
  {
    up: migration_20260702_081938_add_tasks.up,
    down: migration_20260702_081938_add_tasks.down,
    name: '20260702_081938_add_tasks',
  },
  {
    up: migration_20260717_000000_add_new_collections.up,
    down: migration_20260717_000000_add_new_collections.down,
    name: '20260717_000000_add_new_collections',
  },
  {
    up: migration_20260719_000000_add_billing_fields.up,
    down: migration_20260719_000000_add_billing_fields.down,
    name: '20260719_000000_add_billing_fields',
  },
  {
    up: migration_20260719_100000_add_invoices_table.up,
    down: migration_20260719_100000_add_invoices_table.down,
    name: '20260719_100000_add_invoices_table',
  },
  {
    up: migration_20260719_200000_add_invoice_pdf.up,
    down: migration_20260719_200000_add_invoice_pdf.down,
    name: '20260719_200000_add_invoice_pdf',
  },
  {
    up: migration_20260719_300000_add_invoice_pdfs_table.up,
    down: migration_20260719_300000_add_invoice_pdfs_table.down,
    name: '20260719_300000_add_invoice_pdfs_table',
  },
  {
    up: migration_20260719_400000_add_invoices_rels_col.up,
    down: migration_20260719_400000_add_invoices_rels_col.down,
    name: '20260719_400000_add_invoices_rels_col',
  },
  {
    up: migration_20260730_150000_add_tasks_created_by.up,
    down: migration_20260730_150000_add_tasks_created_by.down,
    name: '20260730_150000_add_tasks_created_by',
  },
  {
    up: migration_20260730_160000_add_roles_notification_prefs.up,
    down: migration_20260730_160000_add_roles_notification_prefs.down,
    name: '20260730_160000_add_roles_notification_prefs',
  },
  {
    up: migration_20260730_170000_add_users_personal_notif_prefs.up,
    down: migration_20260730_170000_add_users_personal_notif_prefs.down,
    name: '20260730_170000_add_users_personal_notif_prefs',
  },
  {
    up: migration_20260731_000000_add_users_digest_notif_pref.up,
    down: migration_20260731_000000_add_users_digest_notif_pref.down,
    name: '20260731_000000_add_users_digest_notif_pref',
  },
];
