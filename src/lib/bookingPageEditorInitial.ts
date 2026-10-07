import { randomUUID } from 'crypto'
import { resolveAvailableLocales } from '@/lib/i18n'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import type { BookingPageEditorInitial, EditorStaff } from '@/components/settings/booking-page/BookingPageEditor'
import type { Media, Restaurant, Salon } from '@/payload/payload-types'

const mediaOf = (m: unknown) => (m && typeof m === 'object' ? { id: Number((m as Media).id), url: (m as Media).url ?? null } : { id: null, url: null })

/** A mentett sorrend + a hiányzó azonosítók az alapsorrend szerint (ismeretlenek nélkül). */
const ordered = (saved: string[] | null | undefined, all: string[]) => {
  const ok = (saved ?? []).filter((x) => all.includes(x))
  return [...ok, ...all.filter((x) => !ok.includes(x))]
}

/**
 * A Foglalóoldal-szerkesztő kezdőadatai egy szalon VAGY étterem rekordból — közös, hogy a két
 * Beállítások-oldal ugyanabból a forrásból dolgozzon (egységes szerkesztő).
 */
export function buildBookingPageEditorInitial(
  kind: 'salon' | 'restaurant',
  doc: Salon | Restaurant,
  extra: { staff?: EditorStaff[]; maxPax?: number } = {},
): BookingPageEditorInitial {
  const isSalon = kind === 'salon'
  const salon = doc as Salon
  const restaurant = doc as Restaurant
  const br = doc.booking_rules ?? {}
  const fm = doc.feature_modules ?? {}
  const cover = mediaOf(doc.cover_image)
  const logo = mediaOf(doc.logo)
  return {
    variant: kind,
    slug: doc.slug,
    supportedLocales: resolveAvailableLocales(doc.supported_locales),
    name: doc.name,
    address: doc.address ?? '',
    city: doc.city ?? '',
    postalCode: isSalon ? salon.postal_code ?? '' : '',
    phone: doc.phone ?? '',
    email: doc.email ?? '',
    website: doc.website ?? '',
    description: typeof doc.description === 'string' ? doc.description : '',
    socialLinks: (doc.social_links ?? []).map((l) => l.url),
    coverId: cover.id,
    coverUrl: cover.url,
    coverFocalX: doc.cover_focal_x ?? 50,
    coverFocalY: doc.cover_focal_y ?? 50,
    coverZoom: doc.cover_zoom ?? 1,
    coverFocalMobileX: doc.cover_focal_mobile_x ?? null,
    coverFocalMobileY: doc.cover_focal_mobile_y ?? null,
    logoId: logo.id,
    logoUrl: logo.url,
    goodToKnow: (doc.good_to_know ?? []).map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
    showServiceCount: isSalon && (br.show_service_count_on_public ?? br.show_catalog_counts_on_public !== false),
    showStaffCount: isSalon && (br.show_staff_count_on_public ?? br.show_catalog_counts_on_public !== false),
    servicesExpandedOnMain: !!br.services_expanded_on_main,
    sectionOrder: ordered(br.public_section_order, isSalon ? ['services', 'voucher', 'staff', 'reviews'] : ['reviews', 'slots', 'voucher']),
    hiddenSections: br.public_sections_hidden ?? [],
    fieldOrder: ordered(br.form_field_order, ['name', 'email', 'phone', 'address', 'questions', 'notes']),
    // Étteremnél a saját `lead_time_hours` a minimum foglalási idő.
    minLeadHours: isSalon ? br.min_lead_hours ?? null : (restaurant.lead_time_hours || null),
    bookingRules: br as Record<string, unknown>,
    notificationPrefs: (doc.notification_prefs ?? {}) as Record<string, unknown>,
    featureModules: fm as Record<string, unknown>,
    bookingWindowDays: doc.booking_window_days ?? 60,
    bufferMinutes: isSalon ? salon.booking_buffer_minutes ?? 15 : 0,
    requirePhone: doc.require_phone ?? true,
    autoConfirm: br.auto_confirm ?? true,
    requireAddress: !!br.require_address,
    requireAddressNote: br.require_address_note ?? '',
    confirmEmail: doc.notification_prefs?.confirm_email !== false,
    reminders: {
      on: fm.reminders_on ?? true,
      h48: !!fm.reminder_t_48h,
      h24: !!fm.reminder_t_24h,
      h3: fm.reminder_t_3h ?? true,
      h1: !!fm.reminder_t_1h,
      custom: fm.reminder_custom_hours ?? null,
      chEmail: fm.reminder_ch_email ?? true,
      chPush: !!fm.reminder_ch_push,
    },
    consentEnabled: !!doc.consent_settings?.enabled,
    consentTitle: doc.consent_settings?.title ?? '',
    consentText: doc.consent_settings?.template_text ?? '',
    customQuestions: (doc.custom_questions ?? []).map((q) => ({
      id: q.id ?? randomUUID(),
      label: q.label ?? '',
      type: (q.type ?? 'text') as 'text' | 'yesno' | 'select',
      options: (q.options ?? []).map((o) => ({ value: o.value ?? '' })),
      required: !!q.required,
    })),
    flags: {
      deposit: !!doc.deposit_settings?.enabled && !!doc.stripe_connect_onboarded,
      depositLabel: doc.deposit_settings?.type === 'percent'
        ? `${doc.deposit_settings?.percent_value ?? 0}%`
        : doc.deposit_settings?.type === 'per_pax'
        ? `${(doc.deposit_settings?.per_pax_amount_huf ?? 0).toLocaleString('hu-HU')} Ft / fő`
        : `${(doc.deposit_settings?.fixed_amount_huf ?? 0).toLocaleString('hu-HU')} Ft`,
      voucher: !!doc.voucher_settings?.enabled && !!doc.stripe_connect_onboarded,
      newsletter: hasActivePackage(doc.newsletter_settings?.package),
    },
    staff: extra.staff ?? [],
    turnMinutes: isSalon ? 0 : restaurant.turn_duration_minutes ?? 120,
    slotStepMinutes: isSalon ? 0 : restaurant.slot_step_minutes ?? 30,
    lastSeatingMinutes: isSalon ? 0 : restaurant.last_seating_buffer_minutes ?? 0,
    eventTypes: isSalon ? [] : (restaurant.event_types?.length
      ? restaurant.event_types.map((e) => ({ icon: e.icon ?? 'party', label: e.label ?? '', enabled: e.enabled !== false }))
      : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label, enabled: true }))),
    maxPax: extra.maxPax ?? 0,
  }
}
