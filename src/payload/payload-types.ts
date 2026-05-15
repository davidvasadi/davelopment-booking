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
    'payload-preferences': PayloadPreference
    'payload-migrations': PayloadMigration
  }
  globals: {}
}

export interface Subscription {
  id: string
  salon: string | Salon
  plan: 'free' | 'starter' | 'pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
  amount_huf?: number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'salon_owner'
  salon?: string | Salon | null
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
  customer_phone: string
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
