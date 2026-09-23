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
import * as migration_20260731_100000_add_review_feature_columns from './20260731_100000_add_review_feature_columns';
import * as migration_20260823_014350_sync_pre_launch_schema from './20260823_014350_sync_pre_launch_schema';
import * as migration_20260823_213013_add_users_deleted_at from './20260823_213013_add_users_deleted_at';
import * as migration_20260825_120000_add_contact_broadcast_notif_campaign from './20260825_120000_add_contact_broadcast_notif_campaign';
import * as migration_20260825_190000_add_weekly_tip_notification_type from './20260825_190000_add_weekly_tip_notification_type';
import * as migration_20260826_120000_simplify_salon_description from './20260826_120000_simplify_salon_description';
import * as migration_20260827_100000_add_social_links from './20260827_100000_add_social_links';
import * as migration_20260827_140000_add_cover_focal_point from './20260827_140000_add_cover_focal_point';
import * as migration_20260827_150000_add_cover_zoom from './20260827_150000_add_cover_zoom';
import * as migration_20260827_160000_email_intro_to_blocks from './20260827_160000_email_intro_to_blocks';
import * as migration_20260827_170000_add_require_address from './20260827_170000_add_require_address';
import * as migration_20260827_180000_add_email_show_terms from './20260827_180000_add_email_show_terms';
import * as migration_20260827_190000_add_service_sort_order from './20260827_190000_add_service_sort_order';
import * as migration_20260827_200000_add_break_fields from './20260827_200000_add_break_fields';
import * as migration_20260828_000000_add_broadcast_contact_notification_types from './20260828_000000_add_broadcast_contact_notification_types';
import * as migration_20260828_100000_add_subscription_webhook_notification_types from './20260828_100000_add_subscription_webhook_notification_types';
import * as migration_20260828_200000_restore_invoice_pdfs_table from './20260828_200000_restore_invoice_pdfs_table';
import * as migration_20260828_300000_add_customer_tax_number from './20260828_300000_add_customer_tax_number';
import * as migration_20260920_150000_relax_localized_label_not_null from './20260920_150000_relax_localized_label_not_null';
import * as migration_20260921_120000_multi_breaks from './20260921_120000_multi_breaks';
import * as migration_20260921_130000_drop_old_break_columns from './20260921_130000_drop_old_break_columns';
import * as migration_20260923_090000_relax_service_category_not_null from './20260923_090000_relax_service_category_not_null';

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
  {
    up: migration_20260731_100000_add_review_feature_columns.up,
    down: migration_20260731_100000_add_review_feature_columns.down,
    name: '20260731_100000_add_review_feature_columns',
  },
  {
    up: migration_20260823_014350_sync_pre_launch_schema.up,
    down: migration_20260823_014350_sync_pre_launch_schema.down,
    name: '20260823_014350_sync_pre_launch_schema',
  },
  {
    up: migration_20260823_213013_add_users_deleted_at.up,
    down: migration_20260823_213013_add_users_deleted_at.down,
    name: '20260823_213013_add_users_deleted_at'
  },
  {
    up: migration_20260825_120000_add_contact_broadcast_notif_campaign.up,
    down: migration_20260825_120000_add_contact_broadcast_notif_campaign.down,
    name: '20260825_120000_add_contact_broadcast_notif_campaign',
  },
  {
    up: migration_20260825_190000_add_weekly_tip_notification_type.up,
    down: migration_20260825_190000_add_weekly_tip_notification_type.down,
    name: '20260825_190000_add_weekly_tip_notification_type',
  },
  {
    up: migration_20260826_120000_simplify_salon_description.up,
    down: migration_20260826_120000_simplify_salon_description.down,
    name: '20260826_120000_simplify_salon_description',
  },
  {
    up: migration_20260827_100000_add_social_links.up,
    down: migration_20260827_100000_add_social_links.down,
    name: '20260827_100000_add_social_links',
  },
  {
    up: migration_20260827_140000_add_cover_focal_point.up,
    down: migration_20260827_140000_add_cover_focal_point.down,
    name: '20260827_140000_add_cover_focal_point',
  },
  {
    up: migration_20260827_150000_add_cover_zoom.up,
    down: migration_20260827_150000_add_cover_zoom.down,
    name: '20260827_150000_add_cover_zoom',
  },
  {
    up: migration_20260827_160000_email_intro_to_blocks.up,
    down: migration_20260827_160000_email_intro_to_blocks.down,
    name: '20260827_160000_email_intro_to_blocks',
  },
  {
    up: migration_20260827_170000_add_require_address.up,
    down: migration_20260827_170000_add_require_address.down,
    name: '20260827_170000_add_require_address',
  },
  {
    up: migration_20260827_180000_add_email_show_terms.up,
    down: migration_20260827_180000_add_email_show_terms.down,
    name: '20260827_180000_add_email_show_terms',
  },
  {
    up: migration_20260827_190000_add_service_sort_order.up,
    down: migration_20260827_190000_add_service_sort_order.down,
    name: '20260827_190000_add_service_sort_order',
  },
  {
    up: migration_20260827_200000_add_break_fields.up,
    down: migration_20260827_200000_add_break_fields.down,
    name: '20260827_200000_add_break_fields',
  },
  {
    up: migration_20260828_000000_add_broadcast_contact_notification_types.up,
    down: migration_20260828_000000_add_broadcast_contact_notification_types.down,
    name: '20260828_000000_add_broadcast_contact_notification_types',
  },
  {
    up: migration_20260828_100000_add_subscription_webhook_notification_types.up,
    down: migration_20260828_100000_add_subscription_webhook_notification_types.down,
    name: '20260828_100000_add_subscription_webhook_notification_types',
  },
  {
    up: migration_20260828_200000_restore_invoice_pdfs_table.up,
    down: migration_20260828_200000_restore_invoice_pdfs_table.down,
    name: '20260828_200000_restore_invoice_pdfs_table',
  },
  {
    up: migration_20260828_300000_add_customer_tax_number.up,
    down: migration_20260828_300000_add_customer_tax_number.down,
    name: '20260828_300000_add_customer_tax_number',
  },
  {
    up: migration_20260920_150000_relax_localized_label_not_null.up,
    down: migration_20260920_150000_relax_localized_label_not_null.down,
    name: '20260920_150000_relax_localized_label_not_null',
  },
  {
    up: migration_20260921_120000_multi_breaks.up,
    down: migration_20260921_120000_multi_breaks.down,
    name: '20260921_120000_multi_breaks',
  },
  {
    up: migration_20260921_130000_drop_old_break_columns.up,
    down: migration_20260921_130000_drop_old_break_columns.down,
    name: '20260921_130000_drop_old_break_columns',
  },
  {
    up: migration_20260923_090000_relax_service_category_not_null.up,
    down: migration_20260923_090000_relax_service_category_not_null.down,
    name: '20260923_090000_relax_service_category_not_null',
  },
];
