/** Az üzlet `feature_modules` csoportja (payload-types) — a Beállítások lapjai ezt olvassák és PATCH-elik. */
export type FeatureModules = {
  reminders_on: boolean
  reminder_ch_email: boolean; reminder_ch_push: boolean
  reminder_t_24h: boolean; reminder_t_3h: boolean; reminder_t_1h: boolean
  reminder_t_48h?: boolean | null
  reminder_custom_hours?: number | null
  waitlist_on: boolean; waitlist_auto_promote: boolean
  recurring_on: boolean
  reviews_on: boolean
  google_review_url?: string | null
  review_delay_hours?: number | null
  review_target?: 'google' | 'tripadvisor' | 'facebook' | null
  tripadvisor_review_url?: string | null
  facebook_review_url?: string | null
  google_booking_confirmed?: boolean | null
  facebook_booking_confirmed?: boolean | null
}
