export interface Config {
  collections: {
    users: User
    salons: Salon
    staff: StaffMember
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
    notifications: Notification
    'payload-preferences': PayloadPreference
    'payload-migrations': PayloadMigration
  }
  globals: {
    'pricing-settings': PricingSetting
  }
}

export interface PricingSetting {
  id: string
  salon_pro_huf: number
  restaurant_pro_huf: number
  trial_days: number
  updatedAt?: string | null
  createdAt?: string | null
}

export interface Subscription {
  id: string
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
  plan: 'trial' | 'pro' | 'restaurant_pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  amount_huf?: number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
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
  cover_image?: string | Media | null
  logo?: string | Media | null
  turn_duration_minutes?: number | null
  slot_step_minutes?: number | null
  last_seating_buffer_minutes?: number | null
  lead_time_hours?: number | null
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  booking_email_subject?: string | null
  booking_email_intro?: string | null
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
  terms_sections?: { title?: string | null; body?: string | null; id?: string | null }[] | null
  good_to_know?: { icon?: string | null; title?: string | null; body?: string | null; id?: string | null }[] | null
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
  country?: string | null
  notes?: string | null
  internal_notes?: string | null
  is_birthday?: boolean | null
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled'
  source: 'online' | 'walk_in' | 'phone'
  cancel_token?: string | null
  createdAt: string
  updatedAt: string
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

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  role: 'admin' | 'salon_owner' | 'restaurant_owner'
  salon?: string | Salon | null
  restaurant?: string | Restaurant | null
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
  require_phone?: boolean | null
  notify_new_bookings?: boolean | null
  booking_email_subject?: string | null
  booking_email_intro?: string | null
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
  terms_sections?: { title?: string | null; body?: string | null; id?: string | null }[] | null
  good_to_know?: { icon?: string | null; title?: string | null; body?: string | null; id?: string | null }[] | null
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
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: string
  name: string
  description?: string | null
  category?: string | null
  subcategory?: string | null
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
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string | null
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
