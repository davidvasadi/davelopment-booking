/** A Payload-lokalizáció támogatott nyelvei (lásd payload.config.ts localization.locales). */
export type Locale = 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr'

/** Egy szünet-időablak (ÓÓ:PP–ÓÓ:PP) — `Shift.breaks` / `StaffMember.default_breaks` eleme. */
export interface BreakWindow {
  start_time: string
  end_time: string
}

export interface Config {
  collections: {
    users: User
    salons: Salon
    staff: StaffMember
    shifts: Shift
    services: Service
    'service-categories': ServiceCategory
    bookings: Booking
    availability: Availability
    media: Media
    subscriptions: Subscription
    restaurants: Restaurant
    rooms: Room
    tables: Table
    'opening-hours': OpeningHour
    'opening-hours-exceptions': OpeningHoursException
    reservations: Reservation
    waitlist: Waitlist
    'gift-vouchers': GiftVoucher
    'gift-voucher-types': GiftVoucherType
    customers: Customer
    'marketing-campaigns': MarketingCampaign
    notifications: Notification
    reviews: Review
    memberships: Membership
    roles: Role
    'push-subscriptions': PushSubscription
    'audit-log': AuditLogEntry
    'email-log': EmailLogEntry
    tasks: Task
    'trial-ledger': TrialLedgerEntry
    'contact-messages': ContactMessage
    'broadcast-log': BroadcastLogEntry
    'google-api-log': GoogleApiLogEntry
    'sick-notes': SickNote
    'shift-templates': ShiftTemplate
    'payload-preferences': PayloadPreference
    'payload-migrations': PayloadMigration
  }
  globals: {
    'pricing-settings': PricingSetting
  }
}

export interface PricingSetting {
  id: string
  /** Szalon — Starter havidíj. */
  salon_starter_huf: number
  /** Szalon alapdíj (a Pro csomag; + per-fő). Slug maradt `salon_pro_huf`. */
  salon_pro_huf: number
  salon_extra_staff_huf: number
  /** Étterem — Starter fix havidíj. */
  restaurant_starter_huf: number
  /** Étterem fix havidíj (a Pro csomag). Slug maradt `restaurant_pro_huf`. */
  restaurant_pro_huf: number
  /** Csomagonként beépítve járó havi hírlevél-küldési keret — nincs önálló hírlevél-fizetés. */
  starter_email_cap: number
  pro_email_cap: number
  egyedi_email_cap: number
  annual_discount_pct: number
  trial_days: number
  updatedAt?: string | null
  createdAt?: string | null
}

export interface Subscription {
  id: string
  /** Fiók-szintű: egy user = egy előfizetés. */
  owner?: string | User | null
  /** Virtuális, csak admin-listához (owner email). */
  owner_label?: string | null
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  salon_count?: number | null
  restaurant_count?: number | null
  /** Olvasható összetétel, pl. „2 étterem + 1 szalon". */
  breakdown?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  billing_cycle: 'monthly' | 'annual'
  amount_huf?: number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  last_stripe_invoice_id?: string | null
  last_invoice_number?: string | null
  last_invoice_url?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  owner: string | User
  description?: string | null
  city?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  privacy_url?: string | null
  social_links?: { url: string; id?: string | null }[] | null
  positions?: { label: string; level?: ('lead' | 'staff') | null; id?: string | null }[] | null
  daily_tips?: { date: string; amount: number; id?: string | null }[] | null
  cover_image?: string | Media | null
  cover_focal_x?: number | null
  cover_focal_y?: number | null
  cover_zoom?: number | null
  cover_focal_mobile_x?: number | null
  cover_focal_mobile_y?: number | null
  logo?: string | Media | null
  icon?: string | Media | null
  brand_logo_size?: string | null
  brand_page?: string | null
  brand_email?: string | null
  brand_qr?: string | null
  turn_duration_minutes?: number | null
  online_capacity_pct?: number | null
  min_online_pax?: number | null
  max_online_pax?: number | null
  slot_step_minutes?: number | null
  last_seating_buffer_minutes?: number | null
  lead_time_hours?: number | null
  booking_window_days?: number | null
  booking_window_periodic?: boolean | null
  booking_window_end?: string | null
  booking_window_auto_renew?: boolean | null
  booking_window_notice_for?: string | null
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  /** Üzlet-csomag (starter / pro = normál / egyedi = testreszabott). Régi (null) → Pro-ként olvasandó. */
  tier?: ('starter' | 'pro' | 'egyedi') | null
  /** Egyedi csomag tényleges havidíja (Ft) — csak `tier === 'egyedi'`-nél számít. */
  custom_monthly_fee_huf?: number | null
  notification_prefs?: {
    confirm_email?: boolean | null
    reminder_email?: boolean | null
    cancel_email?: boolean | null
    feedback_email?: boolean | null
    modification_email?: boolean | null
    digest_morning_email?: boolean | null
    digest_evening_email?: boolean | null
  } | null
  booking_rules?: {
    auto_confirm?: boolean | null
    deposit_enabled?: boolean | null
    waitlist_enabled?: boolean | null
    cancellation_protection?: boolean | null
    require_address?: boolean | null
    require_address_note?: string | null
    services_expanded_on_main?: boolean | null
    show_catalog_counts_on_public?: boolean | null
    show_service_count_on_public?: boolean | null
    show_staff_count_on_public?: boolean | null
    min_lead_hours?: number | null
    public_section_order?: string[] | null
    public_sections_hidden?: string[] | null
    form_field_order?: string[] | null
    hidden_booking_fields?: string[] | null
    address_detail_level?: 'off' | 'city' | 'full' | null
    show_marketing_consent_field?: boolean | null
  } | null
  feature_modules?: {
    reminders_on?: boolean | null
    reminder_ch_email?: boolean | null
    reminder_ch_push?: boolean | null
    reminder_t_48h?: boolean | null
    reminder_t_24h?: boolean | null
    reminder_t_3h?: boolean | null
    reminder_t_1h?: boolean | null
    reminder_custom_hours?: number | null
    waitlist_on?: boolean | null
    waitlist_auto_promote?: boolean | null
    recurring_on?: boolean | null
    reviews_on?: boolean | null
    google_review_url?: string | null
    review_delay_hours?: number | null
    review_target?: ('google' | 'tripadvisor' | 'facebook') | null
    tripadvisor_review_url?: string | null
    facebook_review_url?: string | null
    google_booking_confirmed?: boolean | null
    facebook_booking_confirmed?: boolean | null
  } | null
  deposit_settings?: {
    enabled?: boolean | null
    type?: ('fixed' | 'percent' | 'per_pax') | null
    fixed_amount_huf?: number | null
    percent_value?: number | null
    per_pax_amount_huf?: number | null
    apply_when?: ('always' | 'min_price' | 'min_pax' | 'special_days') | null
    min_price_huf?: number | null
    min_pax?: number | null
    special_days?: { weekdays?: number[]; dates?: string[] } | null
    refund_hours_before?: number | null
    payment_gateway?: ('stripe' | 'simplepay' | 'none') | null
  } | null
  voucher_settings?: {
    enabled?: boolean | null
    min_amount_huf?: number | null
    max_amount_huf?: number | null
    allow_company?: boolean | null
    validity_months?: number | null
  } | null
  newsletter_settings?: {
    package?: ('none' | 'ingyenes' | 'alap' | 'premium') | null
    /** Belső "küldés folyamatban" zár — nem admin-szerkeszthető. */
    sending?: boolean | null
  } | null
  consent_settings?: {
    enabled?: boolean | null
    title?: string | null
    template_text?: string | null
  } | null
  marketing_tracking?: {
    ga4_measurement_id?: string | null
    facebook_pixel_id?: string | null
  } | null
  stripe_connect_account_id?: string | null
  stripe_connect_onboarded?: boolean | null
  invoice_settings?: {
    invoice_provider?: ('szamlazz' | 'billingo' | 'none') | null
    issuer?: ('business' | 'staff') | null
    szamlazz_agent_key_enc?: string | null
    billingo_api_key_enc?: string | null
  } | null
  booking_email_subject?: string | null
  booking_email_intro?: unknown
  cancel_email_subject?: string | null
  cancel_email_intro?: unknown
  reminder_email_subject?: string | null
  reminder_email_intro?: unknown
  feedback_email_subject?: string | null
  feedback_email_intro?: unknown
  notify_email_subject?: string | null
  notify_email_intro?: unknown
  email_show_phone?: boolean | null
  email_contact_phone?: string | null
  email_show_email?: boolean | null
  email_show_address?: boolean | null
  email_show_directions?: boolean | null
  email_directions_address?: string | null
  email_show_terms?: boolean | null
  legal_name?: string | null
  tax_number?: string | null
  company_reg_number?: string | null
  registered_seat?: string | null
  billing_email?: string | null
  billing_postal_code?: string | null
  billing_city?: string | null
  billing_street?: string | null
  terms_sections?: { title?: string | null; body?: string | null; id?: string | null }[] | null
  good_to_know?: { icon?: string | null; title?: string | null; body?: string | null; id?: string | null }[] | null
  custom_questions?: {
    label: string
    type?: ('text' | 'yesno' | 'select') | null
    options?: { value?: string | null; id?: string | null }[] | null
    required?: boolean | null
    id?: string | null
  }[] | null
  event_types?: { icon?: string | null; label?: string | null; enabled?: boolean | null; id?: string | null }[] | null
  supported_locales?: Locale[] | null
  is_active?: boolean | null
  admin_notes?: string | null
  createdAt: string
  public_page?: {
    accent_color?: string | null
    card_style?: ('dark' | 'black' | 'glass' | 'white') | null
    card_text?: ('auto' | 'light' | 'dark') | null
    button_text?: ('auto' | 'light' | 'dark') | null
    cover_dim?: ('none' | 'soft' | 'strong') | null
    show_rating?: boolean | null
    rating_opens?: boolean | null
    show_social?: boolean | null
    cta_label?: string | null
    button_text_color?: string | null
    desc_color?: string | null
    name_color?: string | null
    address_color?: string | null
    hero_order?: string | null
    cover_color?: string | null
    name_style?: string | null
    ph_name?: string | null
    ph_email?: string | null
    ph_address?: string | null
    ph_city?: string | null
    texts?: string | null
    ph_notes?: string | null
    desc_size?: string | null
    desc_full_mobile?: boolean | null
    success_title?: string | null
    success_title_color?: string | null
    cta_next_free?: boolean | null
    cta_deposit_badge?: boolean | null
    services_filter?: boolean | null
    services_images?: boolean | null
    services_price?: boolean | null
    services_order?: ('manual' | 'popular') | null
  }
  gallery?:
    | {
        image: number | Media
        caption?: string | null
        id?: string | null
      }[]
    | null
  google_place_id?: string | null
  google_place_name?: string | null
  google_maps_url?: string | null
  google_rating?: number | null
  google_rating_count?: number | null
  google_reviews?: unknown
  google_reviews_updated_at?: string | null
  updatedAt: string
}

export interface Room {
  id: string
  restaurant: string | Restaurant
  name: string
  is_outdoor?: boolean | null
  is_active?: boolean | null
  online_bookable?: boolean | null
  seasonal?: boolean | null
  season_start?: string | null
  season_end?: string | null
  sort_order?: number | null
  createdAt: string
  updatedAt: string
}

export interface Table {
  id: string
  restaurant: string | Restaurant
  name: string
  capacity: number
  room?: string | Room | null
  combinable_with?: (string | Table)[] | null
  is_active?: boolean | null
  sort_order?: number | null
  createdAt: string
  updatedAt: string
}

export interface OpeningHour {
  id: string
  restaurant: string | Restaurant
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  is_open?: boolean | null
  open_time?: string | null
  close_time?: string | null
  createdAt: string
  updatedAt: string
}

export interface OpeningHoursException {
  id: string
  restaurant: string | Restaurant
  label?: string | null
  start_date: string
  end_date: string
  is_closed?: boolean | null
  open_time?: string | null
  close_time?: string | null
  createdAt: string
  updatedAt: string
}

export interface Reservation {
  id: string
  restaurant: string | Restaurant
  date: string
  start_time: string
  end_time: string
  pax: number
  tables?: (string | Table)[] | null
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  customer_city?: string | null
  customer_address?: string | null
  deposit_kind?: string | null
  customer_country?: string | null
  customer_tax_number?: string | null
  country?: string | null
  notes?: string | null
  internal_notes?: string | null
  occasion?: string | null
  occasion_icon?: string | null
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled'
  source: 'online' | 'walk_in' | 'phone'
  reminder_sent?: boolean | null
  reminder_last_offset?: number | null
  feedback_sent?: boolean | null
  email_open_check_24h?: boolean | null
  email_open_check_12h?: boolean | null
  cancel_token?: string | null
  series_id?: string | null
  locale?: 'hu' | 'en' | null
  cancelled_at?: string | null
  payment_gateway?: ('stripe' | 'simplepay' | 'none') | null
  payment_status?: ('none' | 'pending' | 'paid' | 'refunded' | 'failed') | null
  deposit_amount_huf?: number | null
  deposit_paid?: boolean | null
  deposit_refunded?: boolean | null
  payment_intent_id?: string | null
  invoice_number?: string | null
  invoice_pdf_url?: string | null
  invoice_status?: ('none' | 'issued' | 'failed' | 'storno') | null
  invoice_storno_number?: string | null
  voucher_code?: string | null
  voucher_discount_huf?: number | null
  consent_accepted?: boolean | null
  consent_accepted_at?: string | null
  consent_accepted_via?: ('online' | 'onsite') | null
  consent_text_snapshot?: string | null
  consent_accepted_ip?: string | null
  custom_answers?: Record<string, { question: string; answer: string }> | null
  createdAt: string
  updatedAt: string
}

export interface Waitlist {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  date: string
  time: string
  pax?: number | null
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  status: 'waiting' | 'notified' | 'promoted' | 'expired'
  token: string
  locale?: 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr' | null
  createdAt: string
  updatedAt: string
}

export interface GiftVoucherType {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  name: string
  amount_huf: number
  image?: string | Media | null
  card_layout?: string | null
  card_color?: string | null
  card_text?: string | null
  card_brand?: string | null
  description?: string | null
  active?: boolean | null
  createdAt: string
  updatedAt: string
}

export interface GiftVoucher {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  vat_mode?: string | null
  voucher_type?: string | GiftVoucherType | null
  type_name?: string | null
  code: string
  amount_huf: number
  image?: string | Media | null
  qr_code_url?: string | null
  purchaser_name: string
  purchaser_email: string
  recipient_name?: string | null
  recipient_email?: string | null
  message?: string | null
  status: 'active' | 'redeemed' | 'expired' | 'refunded'
  payment_intent_id: string
  payment_method?: ('online' | 'payment_link' | 'cash' | 'pos_card' | 'transfer' | 'other') | null
  expires_at: string
  redeemed_at?: string | null
  redeemed_booking?: string | Booking | null
  redeemed_reservation?: string | Reservation | null
  invoice_number?: string | null
  invoice_pdf_url?: string | null
  invoice_status?: 'none' | 'issued' | 'failed' | 'skipped' | 'storno' | null
  invoice_storno_number?: string | null
  issued_by?: string | User | null
  locale?: 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr' | null
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_city?: string | null
  customer_country?: string | null
  birthday?: string | null
  gender?: 'female' | 'male' | 'other' | null
  group_tag?: string | null
  notes?: string | null
  billing_name?: string | null
  billing_tax_number?: string | null
  billing_email?: string | null
  billing_postal_code?: string | null
  billing_city?: string | null
  billing_street?: string | null
  visit_count?: number | null
  cancellation_count?: number | null
  no_show_count?: number | null
  last_cancellation_reason?: string | null
  total_revenue_huf?: number | null
  external_id?: string | null
  match_index?: string | null
  blocked?: boolean | null
  block_reason?: string | null
  blocked_at?: string | null
  marketing_consent?: boolean | null
  marketing_consent_at?: string | null
  marketing_unsubscribed_at?: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketingCampaign {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  subject: string
  body_text?: string | null
  recipient_count?: number | null
  package?: string | null
  status: 'sent' | 'scheduled' | 'draft'
  blocks_json?: unknown
  target_customer_ids?: unknown
  scheduled_at?: string | null
  body_html?: string | null
  audience?: string | null
  translations?: unknown
  createdAt: string
  updatedAt: string
}

export interface Review {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  reservation?: string | Reservation | null
  booking?: string | Booking | null
  rating: number
  comment?: string | null
  customer_name?: string | null
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  description?: string | null
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  capabilities?:
    | (
        | 'overview.view'
        | 'bookings.view'
        | 'bookings.manage'
        | 'schedule.view.own'
        | 'schedule.manage'
        | 'schedule.manage.own'
        | 'guests.view'
        | 'guests.manage'
        | 'catalog.view'
        | 'catalog.manage'
        | 'staff.view'
        | 'staff.manage'
        | 'staff.salary'
        | 'roles.view'
        | 'tables.view'
        | 'tables.manage'
        | 'analytics.view'
        | 'settings.profile'
        | 'settings.own_profile'
        | 'team.view'
        | 'team.manage'
        | 'billing.manage'
        | 'danger'
        | 'audit.view'
      )[]
    | null
  notification_prefs?: {
    bookings?: boolean | null
    system?: boolean | null
    staff?: boolean | null
    schedule?: boolean | null
  } | null
  booking_notify_level?: ('off' | 'own' | 'all') | null
  createdAt: string
  updatedAt: string
}
/** Örökre megmaradó email-lista arról, ki használt már ingyenes próbaidőt (a fiók-törléstől független). */
export interface TrialLedgerEntry {
  id: string
  email: string
  first_seen_at: string
  createdAt: string
  updatedAt: string
}
/** Publikus kapcsolatfelvételi űrlap beérkező üzenetei. */
export interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string | null
  message: string
  status?: ('new' | 'answered') | null
  createdAt: string
  updatedAt: string
}
/** Admin körüzenetek naplója — egy sor kampányonként. */
export interface BroadcastLogEntry {
  id: string
  title: string
  body: string
  target: 'all' | 'paying' | 'trial' | 'custom'
  sent_count: number
  sent_by?: string | User | null
  createdAt: string
  updatedAt: string
}
export interface PushSubscription {
  id: string
  user: string | User
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
  createdAt: string
  updatedAt: string
}
export interface Membership {
  id: string
  /** Üres, amíg a meghívó függőben van; elfogadáskor kötődik be. */
  user?: string | User | null
  email: string
  name?: string | null
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  role: 'owner' | 'manager' | 'staff'
  custom_role?: string | Role | null
  status: 'active' | 'invited' | 'suspended'
  invite_token?: string | null
  position?: string | null
  avatar?: string | Media | null
  phone?: string | null
  birthday?: string | null
  address?: string | null
  tax_id?: string | null
  tax_number?: string | null
  join_date?: string | null
  weekly_hours?: number | null
  /** Éves szabadság-keret (nap). */
  annual_leave_days?: number | null
  pay_type?: ('daily' | 'hourly') | null
  pay_rate?: number | null
  tip_eligible?: boolean | null
  salary?: number | null
  bio?: string | null
  suspended_at?: string | null
  position_history?: { position?: string | null; changed_at?: string | null; id?: string | null }[] | null
  documents?: { label?: string | null; file?: string | Media | null; id?: string | null }[] | null
  createdAt: string
  updatedAt: string
}

export interface AuditLogEntry {
  id: string
  actor?: string | User | null
  actor_label?: string | null
  actor_email?: string | null
  action: 'create' | 'update' | 'delete'
  collection_name?: string | null
  doc_id?: string | null
  summary?: string | null
  changes?: AuditChangeEntry[] | null
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  subscription: string | Subscription
  invoice_number: string
  invoice_url?: string | null
  amount_huf?: number | null
  stripe_invoice_id?: string | null
  invoice_pdf_base64?: string | null
  issued_at?: string | null
  test?: boolean | null
  createdAt: string
  updatedAt: string
}

/** Táppénzes papír (Naptár „Beteg”) — nem nyilvános feltöltés, csak a /api/shifts/[id]/sick-note végponton. */
export interface SickNote {
  id: string
  salon?: (string | null) | Salon
  restaurant?: (string | null) | Restaurant
  url?: string | null
  thumbnailURL?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  createdAt: string
  updatedAt: string
}

/** Mentett beosztás-sablon (Naptár „+ Beosztás”). */
export interface ShiftTemplate {
  id: string
  name: string
  salon?: (string | null) | Salon
  restaurant?: (string | null) | Restaurant
  start_time?: string | null
  end_time?: string | null
  breaks?: BreakWindow[] | null
  /** a hét napjai: 0 = vasárnap … 6 = szombat */
  days?: number[] | null
  /** munkatárs- vagy tag-azonosítók */
  people?: string[] | null
  createdAt: string
  updatedAt: string
}

/** Google Places API hívás-napló — havi biztonsági keret-számláláshoz (ld. googleReviews.ts). */
export interface GoogleApiLogEntry {
  id: string
  kind: 'autocomplete' | 'place_details'
  createdAt: string
  updatedAt: string
}

export interface EmailLogEntry {
  id: string
  type:
    | 'booking_confirmation'
    | 'new_booking'
    | 'cancellation'
    | 'modification'
    | 'reminder'
    | 'feedback'
    | 'digest_morning'
    | 'digest_evening'
    | 'waitlist_signup'
    | 'waitlist_opening'
    | 'voucher_purchase'
    | 'marketing_broadcast'
    | 'team_invite'
    | 'password_reset'
    | 'schedule_change'
    | 'contact_form'
    | 'booking_window'
    | 'other'
  to?: string | null
  subject?: string | null
  ok?: boolean | null
  error?: string | null
  resend_id?: string | null
  status?: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | null
  delivered_at?: string | null
  opened_at?: string | null
  booking?: (string | null) | Booking
  reservation?: (string | null) | Reservation
  salon?: (string | null) | Salon
  restaurant?: (string | null) | Restaurant
  campaign?: (string | null) | MarketingCampaign
  clicked_links?: { url: string; at: string }[] | null
  clicked_at?: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditChangeEntry {
  field: string
  from: string | number | boolean | null
  to: string | number | boolean | null
}

export interface Notification {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  user?: string | User | null
  audience: 'owner' | 'member' | 'admin'
  type: 'new_booking' | 'cancellation' | 'modification' | 'new_signup' | 'new_subscriber' | 'digest_morning' | 'digest_evening' | 'schedule_change' | 'email_not_opened' | 'voucher_purchase' | 'contact_message' | 'admin_broadcast' | 'weekly_tip' | 'trial_ending' | 'dispute_created' | 'fraud_warning' | 'booking_window'
  title: string
  body?: string | null
  campaign_id?: number | null
  read?: boolean | null
  metadata?: Record<string, unknown> | null
  reservation?: string | Reservation | null
  booking?: string | Booking | null
  voucher?: string | GiftVoucher | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  title: string
  done?: boolean | null
  due_date?: string | null
  created_by?: string | User | null
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  last_login_at?: string | null
  /** Tulajdonos fiók-szintű adatlapja (nincs membershipje) — a HiringView szerkeszti /api/user/profile-on. */
  phone?: string | null
  birthday?: string | null
  join_date?: string | null
  address?: string | null
  tax_id?: string | null
  tax_number?: string | null
  emergency_contact?: string | null
  weekly_hours?: number | null
  bio?: string | null
  role_title?: string | null
  role: 'admin' | 'salon_owner' | 'restaurant_owner'
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  /** Több-üzlet: utoljára aktív üzlet `"<type>:<id>"` (pl. "restaurant:12"). */
  last_active_business?: string | null
  /** Virtuális, csak olvasható admin-összegzés (nem tárolódik). */
  businesses_summary?: string | null
  status?: 'active' | 'inactive'
  personal_notif_prefs?: {
    bookings?: boolean | null
    system?: boolean | null
    staff?: boolean | null
    schedule?: boolean | null
    digest?: boolean | null
    email_not_opened?: boolean | null
    bookings_email?: boolean | null
    schedule_email?: boolean | null
    pending_popup?: boolean | null
    payment_bar?: boolean | null
  } | null
  createdAt: string
  updatedAt: string
}

export interface Salon {
  id: string
  name: string
  slug: string
  owner: string | User
  description?: string | null
  logo?: string | Media | null
  icon?: string | Media | null
  brand_logo_size?: string | null
  brand_page?: string | null
  brand_email?: string | null
  brand_qr?: string | null
  cover_image?: string | Media | null
  cover_focal_x?: number | null
  cover_focal_y?: number | null
  cover_zoom?: number | null
  cover_focal_mobile_x?: number | null
  cover_focal_mobile_y?: number | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  privacy_url?: string | null
  social_links?: { url: string; id?: string | null }[] | null
  booking_buffer_minutes?: number | null
  services_uncategorized_sort_order?: number | null
  booking_window_days?: number | null
  booking_window_periodic?: boolean | null
  booking_window_end?: string | null
  booking_window_auto_renew?: boolean | null
  booking_window_notice_for?: string | null
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  /** Üzlet-csomag (starter / pro = normál / egyedi = testreszabott). Régi (null) → Pro-ként olvasandó. */
  tier?: ('starter' | 'pro' | 'egyedi') | null
  /** Egyedi csomag tényleges havidíja (Ft) — csak `tier === 'egyedi'`-nél számít. */
  custom_monthly_fee_huf?: number | null
  notification_prefs?: {
    confirm_email?: boolean | null
    reminder_email?: boolean | null
    cancel_email?: boolean | null
    feedback_email?: boolean | null
    modification_email?: boolean | null
    digest_morning_email?: boolean | null
    digest_evening_email?: boolean | null
  } | null
  booking_rules?: {
    auto_confirm?: boolean | null
    deposit_enabled?: boolean | null
    waitlist_enabled?: boolean | null
    cancellation_protection?: boolean | null
    require_address?: boolean | null
    require_address_note?: string | null
    services_expanded_on_main?: boolean | null
    show_catalog_counts_on_public?: boolean | null
    show_service_count_on_public?: boolean | null
    show_staff_count_on_public?: boolean | null
    min_lead_hours?: number | null
    public_section_order?: string[] | null
    public_sections_hidden?: string[] | null
    form_field_order?: string[] | null
    hidden_booking_fields?: string[] | null
    address_detail_level?: 'off' | 'city' | 'full' | null
    show_marketing_consent_field?: boolean | null
  } | null
  feature_modules?: {
    reminders_on?: boolean | null
    reminder_ch_email?: boolean | null
    reminder_ch_push?: boolean | null
    reminder_t_48h?: boolean | null
    reminder_t_24h?: boolean | null
    reminder_t_3h?: boolean | null
    reminder_t_1h?: boolean | null
    reminder_custom_hours?: number | null
    waitlist_on?: boolean | null
    waitlist_auto_promote?: boolean | null
    recurring_on?: boolean | null
    reviews_on?: boolean | null
    google_review_url?: string | null
    review_delay_hours?: number | null
    review_target?: ('google' | 'tripadvisor' | 'facebook') | null
    tripadvisor_review_url?: string | null
    facebook_review_url?: string | null
    google_booking_confirmed?: boolean | null
    facebook_booking_confirmed?: boolean | null
  } | null
  deposit_settings?: {
    enabled?: boolean | null
    type?: ('fixed' | 'percent' | 'per_pax') | null
    fixed_amount_huf?: number | null
    percent_value?: number | null
    per_pax_amount_huf?: number | null
    apply_when?: ('always' | 'min_price' | 'min_pax' | 'special_days') | null
    min_price_huf?: number | null
    min_pax?: number | null
    special_days?: { weekdays?: number[]; dates?: string[] } | null
    refund_hours_before?: number | null
    payment_gateway?: ('stripe' | 'simplepay' | 'none') | null
  } | null
  voucher_settings?: {
    enabled?: boolean | null
    min_amount_huf?: number | null
    max_amount_huf?: number | null
    allow_company?: boolean | null
    validity_months?: number | null
  } | null
  newsletter_settings?: {
    package?: ('none' | 'ingyenes' | 'alap' | 'premium') | null
    /** Belső "küldés folyamatban" zár — nem admin-szerkeszthető. */
    sending?: boolean | null
  } | null
  consent_settings?: {
    enabled?: boolean | null
    title?: string | null
    template_text?: string | null
  } | null
  marketing_tracking?: {
    ga4_measurement_id?: string | null
    facebook_pixel_id?: string | null
  } | null
  stripe_connect_account_id?: string | null
  stripe_connect_onboarded?: boolean | null
  onsite_payment?: {
    enabled?: boolean | null
    mode?: ('register' | 'invoice') | null
    methods?: string | null
    invoice_default?: ('ask' | 'always') | null
  }
  invoice_settings?: {
    invoice_provider?: ('szamlazz' | 'billingo' | 'none') | null
    issuer?: ('business' | 'staff') | null
    szamlazz_agent_key_enc?: string | null
    billingo_api_key_enc?: string | null
  } | null
  booking_email_subject?: string | null
  booking_email_intro?: unknown
  cancel_email_subject?: string | null
  cancel_email_intro?: unknown
  reminder_email_subject?: string | null
  reminder_email_intro?: unknown
  feedback_email_subject?: string | null
  feedback_email_intro?: unknown
  notify_email_subject?: string | null
  notify_email_intro?: unknown
  email_show_phone?: boolean | null
  email_contact_phone?: string | null
  email_show_email?: boolean | null
  email_show_address?: boolean | null
  email_show_directions?: boolean | null
  email_directions_address?: string | null
  email_show_terms?: boolean | null
  legal_name?: string | null
  tax_number?: string | null
  company_reg_number?: string | null
  registered_seat?: string | null
  billing_email?: string | null
  billing_postal_code?: string | null
  billing_city?: string | null
  billing_street?: string | null
  terms_sections?: { title?: string | null; body?: string | null; id?: string | null }[] | null
  good_to_know?: { icon?: string | null; title?: string | null; body?: string | null; id?: string | null }[] | null
  custom_questions?: {
    label: string
    type?: ('text' | 'yesno' | 'select') | null
    options?: { value?: string | null; id?: string | null }[] | null
    required?: boolean | null
    id?: string | null
  }[] | null
  supported_locales?: Locale[] | null
  is_active?: boolean | null
  admin_notes?: string | null
  createdAt: string
  last_booking_buffer_minutes?: number | null
  public_page?: {
    accent_color?: string | null
    card_style?: ('dark' | 'black' | 'glass' | 'white') | null
    card_text?: ('auto' | 'light' | 'dark') | null
    button_text?: ('auto' | 'light' | 'dark') | null
    cover_dim?: ('none' | 'soft' | 'strong') | null
    show_rating?: boolean | null
    rating_opens?: boolean | null
    show_social?: boolean | null
    cta_label?: string | null
    button_text_color?: string | null
    desc_color?: string | null
    name_color?: string | null
    address_color?: string | null
    hero_order?: string | null
    cover_color?: string | null
    name_style?: string | null
    ph_name?: string | null
    ph_email?: string | null
    ph_address?: string | null
    ph_city?: string | null
    texts?: string | null
    ph_notes?: string | null
    desc_size?: string | null
    desc_full_mobile?: boolean | null
    success_title?: string | null
    success_title_color?: string | null
    cta_next_free?: boolean | null
    cta_deposit_badge?: boolean | null
    services_filter?: boolean | null
    services_images?: boolean | null
    services_price?: boolean | null
    services_order?: ('manual' | 'popular') | null
  }
  gallery?:
    | {
        image: number | Media
        caption?: string | null
        id?: string | null
      }[]
    | null
  google_place_id?: string | null
  google_place_name?: string | null
  google_maps_url?: string | null
  google_rating?: number | null
  google_rating_count?: number | null
  google_reviews?: unknown
  google_reviews_updated_at?: string | null
  updatedAt: string
}

export interface StaffMember {
  id: string
  name: string
  bio?: string | null
  social_links?: { url: string; id?: string | null }[] | null
  salon: string | Salon
  /** Ha ez a szakember EGYBEN egy bejelentkezett fiók is (pl. a tulajdonos, aki maga is dolgozik). */
  user?: string | User | null
  avatar?: string | Media | null
  is_active?: boolean | null
  /** Import hozta létre, a tulaj még nem nézte át (az első szerkesztés törli). */
  import_review?: boolean | null
  role_title?: string | null
  show_role_title?: boolean | null
  department?: string | null
  salary?: number | null
  birthday?: string | null
  join_date?: string | null
  weekly_hours?: number | null
  /** Éves szabadság-keret (nap). */
  annual_leave_days?: number | null
  booking_buffer_minutes?: number | null
  min_lead_hours?: number | null
  default_breaks?: BreakWindow[] | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  tax_number?: string | null
  invoice_provider?: ('szamlazz' | 'billingo' | 'none') | null
  szamlazz_agent_key_enc?: string | null
  billingo_api_key_enc?: string | null
  stripe_connect_account_id?: string | null
  stripe_connect_onboarded?: boolean | null
  documents?: { label?: string | null; file?: string | Media | null; id?: string | null }[] | null
  createdAt: string
  updatedAt: string
}

export interface Shift {
  id: string
  staff?: string | StaffMember | null
  salon?: string | Salon | null
  member?: string | Membership | null
  restaurant?: string | Restaurant | null
  date: string
  type: 'shift' | 'leave' | 'sick' | 'vacation'
  start_time?: string | null
  end_time?: string | null
  hours?: number | null
  breaks?: BreakWindow[] | null
  note?: string | null
  /** Beteg / szabadság: fizetett-e. */
  paid?: boolean | null
  /** Betegnél a táppénzes papír. */
  sick_note?: string | SickNote | null
  owner_shift?: boolean | null
  /** Státuszváltás: a dolgozó a műszak vége előtt hazament (pl. délben beteg lett). */
  left_early_at?: string | null
  left_early_reason?: ('sick' | 'personal') | null
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: string
  name: string
  description?: string | null
  category?: string | ServiceCategory | null
  subcategory?: string | ServiceCategory | null
  image?: string | Media | null
  salon: string | Salon
  staff?: (string | StaffMember)[] | null
  duration_minutes: number
  price: number
  currency?: 'HUF' | 'EUR'
  is_active?: boolean | null
  online_visible?: boolean | null
  /** Import hozta létre, a tulaj még nem nézte át (az első szerkesztés törli). */
  import_review?: boolean | null
  sort_order?: number | null
  createdAt: string
  updatedAt: string
}

export interface ServiceCategory {
  id: string
  name: string
  image?: string | Media | null
  duration_label?: string | null
  description?: string | null
  sort_order?: number | null
  salon: string | Salon
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: string
  salon: string | Salon
  service: string | Service
  price_snapshot?: number | null
  price_snapshot_currency?: ('HUF' | 'EUR') | null
  staff: string | StaffMember
  customer_name: string
  customer_email?: string | null
  customer_phone?: string | null
  customer_city?: string | null
  customer_address?: string | null
  deposit_kind?: string | null
  customer_country?: string | null
  customer_tax_number?: string | null
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  source: 'online' | 'walk_in' | 'phone'
  notes?: string | null
  reminder_sent?: boolean | null
  reminder_last_offset?: number | null
  feedback_sent?: boolean | null
  email_open_check_24h?: boolean | null
  email_open_check_12h?: boolean | null
  cancellation_token?: string | null
  series_id?: string | null
  locale?: 'hu' | 'en' | null
  cancelled_at?: string | null
  payment_gateway?: ('stripe' | 'simplepay' | 'none') | null
  payment_status?: ('none' | 'pending' | 'paid' | 'refunded' | 'failed') | null
  deposit_amount_huf?: number | null
  deposit_paid?: boolean | null
  deposit_refunded?: boolean | null
  payment_intent_id?: string | null
  invoice_number?: string | null
  invoice_pdf_url?: string | null
  invoice_status?: ('none' | 'issued' | 'failed' | 'storno') | null
  invoice_storno_number?: string | null
  voucher_code?: string | null
  voucher_discount_huf?: number | null
  paid_amount_huf?: number | null
  pay_method?: ('cash' | 'card' | 'transfer' | 'link') | null
  pay_receipt?: ('invoice' | 'register' | 'none' | 'manual') | null
  paid_lines?: unknown
  paid_at?: string | null
  pay_link_url?: string | null
  pay_link_session?: string | null
  pay_pending?: unknown
  consent_accepted?: boolean | null
  consent_accepted_at?: string | null
  consent_accepted_via?: ('online' | 'onsite') | null
  consent_text_snapshot?: string | null
  consent_accepted_ip?: string | null
  custom_answers?: Record<string, { question: string; answer: string }> | null
  createdAt: string
  updatedAt: string
}

export interface Availability {
  id: string
  salon: string | Salon
  staff?: string | StaffMember | null
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  start_time: string
  end_time: string
  is_available?: boolean | null
  recurring?: boolean | null
  exception_date?: string | null
  createdAt: string
  updatedAt: string
}

export interface Media {
  id: string
  alt?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  sizes?: {
    thumbnail?: MediaSize
    small?: MediaSize
    medium?: MediaSize
    large?: MediaSize
  }
  url?: string | null
  createdAt: string
  updatedAt: string
}

export interface MediaSize {
  url?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
  filesize?: number | null
  filename?: string | null
}

export interface PayloadPreference {
  id: string
  user: { relationTo: 'users'; value: string | User }
  key?: string | null
  value?: unknown
  createdAt: string
  updatedAt: string
}

export interface PayloadMigration {
  id: string
  name?: string | null
  batch?: number | null
  createdAt: string
  updatedAt: string
}
