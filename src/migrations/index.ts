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
import * as migration_20260923_100000_add_services_uncategorized_sort_order from './20260923_100000_add_services_uncategorized_sort_order';
import * as migration_20260923_110000_add_services_expanded_on_main from './20260923_110000_add_services_expanded_on_main';
import * as migration_20260923_120000_add_show_catalog_counts_on_public from './20260923_120000_add_show_catalog_counts_on_public';
import * as migration_20260923_130000_add_booking_price_snapshot from './20260923_130000_add_booking_price_snapshot';
import * as migration_20261004_100000_booking_email_optional from './20261004_100000_booking_email_optional';
import * as migration_20261004_110000_reminder_options from './20261004_110000_reminder_options';
import * as migration_20261004_120000_staff_buffer_lead from './20261004_120000_staff_buffer_lead';
import * as migration_20261006_100000_voucher_allow_company from './20261006_100000_voucher_allow_company';
import * as migration_20261006_110000_voucher_payment_method from './20261006_110000_voucher_payment_method';
import * as migration_20261006_120000_google_reviews from './20261006_120000_google_reviews';
import * as migration_20261006_130000_booking_page_editor from './20261006_130000_booking_page_editor';
import * as migration_20261006_140000_form_field_order from './20261006_140000_form_field_order';
import * as migration_20261007_100000_restaurant_cover_mobile_focus from './20261007_100000_restaurant_cover_mobile_focus';
import * as migration_20261009_100000_booking_window_periodic from './20261009_100000_booking_window_periodic';
import * as migration_20261014_100000_google_api_log from './20261014_100000_google_api_log';
import * as migration_20261018_100000_google_api_log_locked_rels from './20261018_100000_google_api_log_locked_rels';
import * as migration_20261018_110000_booking_field_visibility from './20261018_110000_booking_field_visibility';
import * as migration_20261018_120000_google_booking_confirmed from './20261018_120000_google_booking_confirmed';
import * as migration_20261018_130000_facebook_booking_confirmed from './20261018_130000_facebook_booking_confirmed';
import * as migration_20261018_140000_address_detail_level from './20261018_140000_address_detail_level';
import * as migration_20261018_150000_customer_crm_fields from './20261018_150000_customer_crm_fields';
import * as migration_20261019_100000_customer_gender from './20261019_100000_customer_gender';
import * as migration_20261020_100000_customer_import_summary from './20261020_100000_customer_import_summary';
import * as migration_20261020_110000_customer_external_id from './20261020_110000_customer_external_id';
import * as migration_20261025_100000_staff_import_review from './20261025_100000_staff_import_review';
import * as migration_20261025_110000_service_import_review from './20261025_110000_service_import_review';
import * as migration_20261027_100000_voucher_issued_by from './20261027_100000_voucher_issued_by';

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
  {
    up: migration_20260923_100000_add_services_uncategorized_sort_order.up,
    down: migration_20260923_100000_add_services_uncategorized_sort_order.down,
    name: '20260923_100000_add_services_uncategorized_sort_order',
  },
  {
    up: migration_20260923_110000_add_services_expanded_on_main.up,
    down: migration_20260923_110000_add_services_expanded_on_main.down,
    name: '20260923_110000_add_services_expanded_on_main',
  },
  {
    up: migration_20260923_120000_add_show_catalog_counts_on_public.up,
    down: migration_20260923_120000_add_show_catalog_counts_on_public.down,
    name: '20260923_120000_add_show_catalog_counts_on_public',
  },
  {
    up: migration_20260923_130000_add_booking_price_snapshot.up,
    down: migration_20260923_130000_add_booking_price_snapshot.down,
    name: '20260923_130000_add_booking_price_snapshot',
  },
  {
    up: migration_20261004_100000_booking_email_optional.up,
    down: migration_20261004_100000_booking_email_optional.down,
    name: '20261004_100000_booking_email_optional',
  },
  {
    up: migration_20261004_110000_reminder_options.up,
    down: migration_20261004_110000_reminder_options.down,
    name: '20261004_110000_reminder_options',
  },
  {
    up: migration_20261004_120000_staff_buffer_lead.up,
    down: migration_20261004_120000_staff_buffer_lead.down,
    name: '20261004_120000_staff_buffer_lead',
  },
  {
    up: migration_20261006_100000_voucher_allow_company.up,
    down: migration_20261006_100000_voucher_allow_company.down,
    name: '20261006_100000_voucher_allow_company',
  },
  {
    up: migration_20261006_110000_voucher_payment_method.up,
    down: migration_20261006_110000_voucher_payment_method.down,
    name: '20261006_110000_voucher_payment_method',
  },
  {
    up: migration_20261006_120000_google_reviews.up,
    down: migration_20261006_120000_google_reviews.down,
    name: '20261006_120000_google_reviews',
  },
  {
    up: migration_20261006_130000_booking_page_editor.up,
    down: migration_20261006_130000_booking_page_editor.down,
    name: '20261006_130000_booking_page_editor',
  },
  {
    up: migration_20261006_140000_form_field_order.up,
    down: migration_20261006_140000_form_field_order.down,
    name: '20261006_140000_form_field_order',
  },
  {
    up: migration_20261007_100000_restaurant_cover_mobile_focus.up,
    down: migration_20261007_100000_restaurant_cover_mobile_focus.down,
    name: '20261007_100000_restaurant_cover_mobile_focus',
  },
  {
    up: migration_20261009_100000_booking_window_periodic.up,
    down: migration_20261009_100000_booking_window_periodic.down,
    name: '20261009_100000_booking_window_periodic',
  },
  {
    up: migration_20261014_100000_google_api_log.up,
    down: migration_20261014_100000_google_api_log.down,
    name: '20261014_100000_google_api_log',
  },
  {
    up: migration_20261018_100000_google_api_log_locked_rels.up,
    down: migration_20261018_100000_google_api_log_locked_rels.down,
    name: '20261018_100000_google_api_log_locked_rels',
  },
  {
    up: migration_20261018_110000_booking_field_visibility.up,
    down: migration_20261018_110000_booking_field_visibility.down,
    name: '20261018_110000_booking_field_visibility',
  },
  {
    up: migration_20261018_120000_google_booking_confirmed.up,
    down: migration_20261018_120000_google_booking_confirmed.down,
    name: '20261018_120000_google_booking_confirmed',
  },
  {
    up: migration_20261018_130000_facebook_booking_confirmed.up,
    down: migration_20261018_130000_facebook_booking_confirmed.down,
    name: '20261018_130000_facebook_booking_confirmed',
  },
  {
    up: migration_20261018_140000_address_detail_level.up,
    down: migration_20261018_140000_address_detail_level.down,
    name: '20261018_140000_address_detail_level',
  },
  {
    up: migration_20261018_150000_customer_crm_fields.up,
    down: migration_20261018_150000_customer_crm_fields.down,
    name: '20261018_150000_customer_crm_fields',
  },
  {
    up: migration_20261019_100000_customer_gender.up,
    down: migration_20261019_100000_customer_gender.down,
    name: '20261019_100000_customer_gender',
  },
  {
    up: migration_20261020_100000_customer_import_summary.up,
    down: migration_20261020_100000_customer_import_summary.down,
    name: '20261020_100000_customer_import_summary',
  },
  {
    up: migration_20261020_110000_customer_external_id.up,
    down: migration_20261020_110000_customer_external_id.down,
    name: '20261020_110000_customer_external_id',
  },
  {
    up: migration_20261025_100000_staff_import_review.up,
    down: migration_20261025_100000_staff_import_review.down,
    name: '20261025_100000_staff_import_review',
  },
  {
    up: migration_20261025_110000_service_import_review.up,
    down: migration_20261025_110000_service_import_review.down,
    name: '20261025_110000_service_import_review',
  },
  {
    up: migration_20261027_100000_voucher_issued_by.up,
    down: migration_20261027_100000_voucher_issued_by.down,
    name: '20261027_100000_voucher_issued_by',
  },
];
