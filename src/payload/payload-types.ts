/** A Payload-lokalizáció támogatott nyelvei (lásd payload.config.ts localization.locales). */
export type Locale = 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr'

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
    customers: Customer
    notifications: Notification
    reviews: Review
    memberships: Membership
    roles: Role
    'push-subscriptions': PushSubscription
    'audit-log': AuditLogEntry
    'email-log': EmailLogEntry
    tasks: Task
    'payload-preferences': PayloadPreference
    'payload-migrations': PayloadMigration
  }
  globals: {
    'pricing-settings': PricingSetting
  }
}

export interface PricingSetting {
  id: string
  /** Szalon alapdíj (a normál csomag; + per-fő). Slug maradt `salon_pro_huf`. */
  salon_pro_huf: number
  salon_extra_staff_huf: number
  /** Étterem fix havidíj (a normál csomag). Slug maradt `restaurant_pro_huf`. */
  restaurant_pro_huf: number
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
  positions?: { label: string; level?: ('lead' | 'staff') | null; id?: string | null }[] | null
  daily_tips?: { date: string; amount: number; id?: string | null }[] | null
  cover_image?: string | Media | null
  logo?: string | Media | null
  turn_duration_minutes?: number | null
  slot_step_minutes?: number | null
  last_seating_buffer_minutes?: number | null
  lead_time_hours?: number | null
  booking_window_days?: number | null
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  /** Üzlet-csomag (pro = normál / egyedi = testreszabott). Régi (null) → Pro-ként olvasandó. */
  tier?: ('pro' | 'egyedi') | null
  notification_prefs?: {
    confirm_email?: boolean | null
    reminder_email?: boolean | null
    cancel_email?: boolean | null
    feedback_email?: boolean | null
  } | null
  booking_rules?: {
    auto_confirm?: boolean | null
    deposit_enabled?: boolean | null
    waitlist_enabled?: boolean | null
    cancellation_protection?: boolean | null
  } | null
  feature_modules?: {
    reminders_on?: boolean | null
    reminder_ch_email?: boolean | null
    reminder_ch_push?: boolean | null
    reminder_t_24h?: boolean | null
    reminder_t_3h?: boolean | null
    reminder_t_1h?: boolean | null
    waitlist_on?: boolean | null
    waitlist_auto_promote?: boolean | null
    recurring_on?: boolean | null
    reviews_on?: boolean | null
    google_review_url?: string | null
  } | null
  booking_email_subject?: string | null
  booking_email_intro?: string | null
  cancel_email_subject?: string | null
  cancel_email_intro?: string | null
  reminder_email_subject?: string | null
  reminder_email_intro?: string | null
  feedback_email_subject?: string | null
  feedback_email_intro?: string | null
  email_show_phone?: boolean | null
  email_contact_phone?: string | null
  email_show_email?: boolean | null
  email_show_address?: boolean | null
  email_show_directions?: boolean | null
  email_directions_address?: string | null
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
  event_types?: { icon?: string | null; label?: string | null; enabled?: boolean | null; id?: string | null }[] | null
  supported_locales?: Locale[] | null
  is_active?: boolean | null
  admin_notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: string
  restaurant: string | Restaurant
  name: string
  is_outdoor?: boolean | null
  is_active?: boolean | null
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
  country?: string | null
  notes?: string | null
  internal_notes?: string | null
  occasion?: string | null
  occasion_icon?: string | null
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled'
  source: 'online' | 'walk_in' | 'phone'
  reminder_sent?: boolean | null
  feedback_sent?: boolean | null
  cancel_token?: string | null
  series_id?: string | null
  locale?: 'hu' | 'en' | null
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

export interface Customer {
  id: string
  restaurant?: string | Restaurant | null
  salon?: string | Salon | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  notes?: string | null
  match_index?: string | null
  blocked?: boolean | null
  block_reason?: string | null
  blocked_at?: string | null
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
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  capabilities?:
    | (
        | 'overview.view'
        | 'bookings.view'
        | 'bookings.manage'
        | 'schedule.view.own'
        | 'schedule.manage'
        | 'guests.view'
        | 'guests.manage'
        | 'catalog.view'
        | 'catalog.manage'
        | 'staff.view'
        | 'staff.manage'
        | 'analytics.view'
        | 'settings.profile'
        | 'team.view'
        | 'team.manage'
        | 'billing.manage'
        | 'danger'
        | 'audit.view'
      )[]
    | null
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
  emergency_contact?: string | null
  join_date?: string | null
  weekly_hours?: number | null
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

export interface EmailLogEntry {
  id: string
  type:
    | 'booking_confirmation'
    | 'new_booking'
    | 'cancellation'
    | 'reminder'
    | 'feedback'
    | 'waitlist_signup'
    | 'waitlist_opening'
    | 'team_invite'
    | 'password_reset'
    | 'other'
  to?: string | null
  subject?: string | null
  ok?: boolean | null
  error?: string | null
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
  audience: 'owner' | 'admin'
  type: 'new_booking' | 'cancellation' | 'new_signup' | 'new_subscriber'
  title: string
  body?: string | null
  read?: boolean | null
  reservation?: string | Reservation | null
  booking?: string | Booking | null
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
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  /** Tulajdonos fiók-szintű adatlapja (nincs membershipje) — a HiringView szerkeszti /api/user/profile-on. */
  phone?: string | null
  birthday?: string | null
  join_date?: string | null
  address?: string | null
  tax_id?: string | null
  emergency_contact?: string | null
  weekly_hours?: number | null
  bio?: string | null
  role: 'admin' | 'salon_owner' | 'restaurant_owner'
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  /** Több-üzlet: utoljára aktív üzlet `"<type>:<id>"` (pl. "restaurant:12"). */
  last_active_business?: string | null
  /** Virtuális, csak olvasható admin-összegzés (nem tárolódik). */
  businesses_summary?: string | null
  status?: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Salon {
  id: string
  name: string
  slug: string
  owner: string | User
  description?: {
    root: {
      children: unknown[]
      direction: string | null
      format: string
      indent: number
      type: string
      version: number
    }
  } | null
  logo?: string | Media | null
  cover_image?: string | Media | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  booking_buffer_minutes?: number | null
  booking_window_days?: number | null
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  /** Üzlet-csomag (pro = normál / egyedi = testreszabott). Régi (null) → Pro-ként olvasandó. */
  tier?: ('pro' | 'egyedi') | null
  notification_prefs?: {
    confirm_email?: boolean | null
    reminder_email?: boolean | null
    cancel_email?: boolean | null
    feedback_email?: boolean | null
  } | null
  booking_rules?: {
    auto_confirm?: boolean | null
    deposit_enabled?: boolean | null
    waitlist_enabled?: boolean | null
    cancellation_protection?: boolean | null
  } | null
  feature_modules?: {
    reminders_on?: boolean | null
    reminder_ch_email?: boolean | null
    reminder_ch_push?: boolean | null
    reminder_t_24h?: boolean | null
    reminder_t_3h?: boolean | null
    reminder_t_1h?: boolean | null
    waitlist_on?: boolean | null
    waitlist_auto_promote?: boolean | null
    recurring_on?: boolean | null
    reviews_on?: boolean | null
    google_review_url?: string | null
  } | null
  booking_email_subject?: string | null
  booking_email_intro?: string | null
  cancel_email_subject?: string | null
  cancel_email_intro?: string | null
  reminder_email_subject?: string | null
  reminder_email_intro?: string | null
  feedback_email_subject?: string | null
  feedback_email_intro?: string | null
  email_show_phone?: boolean | null
  email_contact_phone?: string | null
  email_show_email?: boolean | null
  email_show_address?: boolean | null
  email_show_directions?: boolean | null
  email_directions_address?: string | null
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
  supported_locales?: Locale[] | null
  is_active?: boolean | null
  admin_notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface StaffMember {
  id: string
  name: string
  bio?: string | null
  salon: string | Salon
  avatar?: string | Media | null
  is_active?: boolean | null
  role_title?: string | null
  department?: string | null
  salary?: number | null
  birthday?: string | null
  join_date?: string | null
  weekly_hours?: number | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  emergency_contact?: string | null
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
  note?: string | null
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
  category: string | ServiceCategory
  subcategory?: string | ServiceCategory | null
  image?: string | Media | null
  salon: string | Salon
  staff?: (string | StaffMember)[] | null
  duration_minutes: number
  price: number
  currency?: 'HUF' | 'EUR'
  is_active?: boolean | null
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
  staff: string | StaffMember
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  customer_city?: string | null
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string | null
  reminder_sent?: boolean | null
  feedback_sent?: boolean | null
  cancellation_token?: string | null
  series_id?: string | null
  locale?: 'hu' | 'en' | null
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
