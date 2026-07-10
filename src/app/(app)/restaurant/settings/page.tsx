import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { RestaurantSettingsForm } from '@/components/restaurant/RestaurantSettingsForm'
import { getTeamForBusiness } from '@/lib/teamContext'
import { getAuditLogForBusiness } from '@/lib/auditContext'
import {
  SettingsHub, type BillingData, type RulesData, type SiteData, type TeamMember,
} from '@/components/settings/SettingsHub'
import type { Restaurant } from '@/payload/payload-types'

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const HUF = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

function planName(sub: { plan?: string | null; status?: string | null } | null): string {
  if (!sub) return 'Étterem'
  if (sub.status === 'trialing') return 'Étterem · Próbaidőszak'
  return sub.plan === 'paid' ? 'Étterem Pro' : 'Étterem'
}

export default async function RestaurantSettingsPage() {
  const { restaurant, businessCount, userId } = await getOwnedRestaurant()
  const payload = await getPayloadClient()
  const r = restaurant as Restaurant

  const sub = await findAccountSubscription({ payload }, userId)
  const plan = planName(sub)
  const subtitle = `${r.name} · ${plan}`
  const user = await requireAuth()

  // ── Csapat & jogok — VALÓS tulajdonos + membershipök (aktív tagok + függő meghívók).
  const team: TeamMember[] = await getTeamForBusiness({
    type: 'restaurant',
    businessId: r.id,
    ownerName: user.name || r.name,
    ownerEmail: (user.email || r.email) ?? '',
  })

  // ── Audit-napló — VALÓS legutóbbi bejegyzések (az étteremre szűrve).
  const auditLog = await getAuditLogForBusiness({ type: 'restaurant', businessId: r.id })

  // ── Telephelyek — VALÓS fiók-üzletek. Az aktuális üzlethez a betöltött étterem címét mutatjuk.
  const { businesses } = await getActiveBusiness(user)
  const sites: SiteData[] = businesses.map((b, i) => {
    const current = b.type === 'restaurant' && b.id === String(r.id)
    const meta = current
      ? [r.city, r.address, plan].filter(Boolean).join(' · ')
      : `${b.type === 'salon' ? 'Szalon' : 'Étterem'}`
    return {
      initials: initialsOf(b.name),
      name: b.name,
      meta: meta || plan,
      role: 'Tulajdonos',
      current,
      gold: !current && i > 0,
    }
  })

  // ── Foglalási szabályok — VALÓS mezők az étteremből. Per-foglalás max létszám mező nincs → „—".
  const rules: RulesData = {
    slotDurationMin: r.turn_duration_minutes ?? null,
    bufferMin: r.last_seating_buffer_minutes ?? null,
    maxParty: null,
    leadTimeHours: r.lead_time_hours ?? null,
    windowDays: r.booking_window_days ?? null,
  }

  // ── Számlázás — VALÓS fiók-előfizetésből. Invoice-adat még nincs a sémában → üres állapot.
  const nextChargeDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : sub?.trial_ends_at
    ? new Date(sub.trial_ends_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const billing: BillingData = {
    planLabel: planName(sub),
    nextChargeDate,
    nextChargeAmount: HUF(sub?.amount_huf ?? 0),
    card: null,
    details: {
      legalName: r.legal_name ?? '',
      taxNumber: r.tax_number ?? '',
      address: r.registered_seat ?? [r.city, r.address].filter(Boolean).join(', '),
    },
    invoices: [],
  }

  const senderLabel = `${r.name}${r.email ? ` <${r.email}>` : ''}`

  const np = r.notification_prefs ?? {}
  const br = r.booking_rules ?? {}
  const fm = r.feature_modules ?? {}

  return (
    <div className="p-5 lg:p-0">
      <SettingsHub
        variant="restaurant"
        businessName={r.name}
        subtitle={subtitle}
        availabilityHref="/restaurant/availability"
        apiBase={`/api/restaurants/${r.id}`}
        notificationPrefs={{
          confirm_email: np.confirm_email ?? true,
          cancel_email: np.cancel_email ?? true,
        }}
        bookingRules={{ auto_confirm: br.auto_confirm ?? true }}
        featureModules={{
          reminders_on: fm.reminders_on ?? true,
          reminder_ch_email: fm.reminder_ch_email ?? true,
          reminder_ch_push: fm.reminder_ch_push ?? false,
          reminder_t_24h: fm.reminder_t_24h ?? true,
          reminder_t_3h: fm.reminder_t_3h ?? true,
          reminder_t_1h: fm.reminder_t_1h ?? false,
          waitlist_on: fm.waitlist_on ?? false,
          waitlist_auto_promote: fm.waitlist_auto_promote ?? false,
          recurring_on: fm.recurring_on ?? false,
          reviews_on: fm.reviews_on ?? false,
          google_review_url: fm.google_review_url ?? null,
        }}
        rules={rules}
        senderLabel={senderLabel}
        billing={billing}
        team={team}
        sites={sites}
        businessCount={businessCount}
        planLabel={plan}
        auditLog={auditLog}
        profilePanel={
          <RestaurantSettingsForm
            restaurantId={r.id}
            restaurantName={r.name}
            businessCount={businessCount}
            slug={r.slug}
            supportedLocales={r.supported_locales}
            logo={r.logo}
            coverImage={r.cover_image}
            initial={{
              name: r.name,
              city: r.city ?? '',
              address: r.address ?? '',
              phone: r.phone ?? '',
              email: r.email ?? '',
              website: r.website ?? '',
              turn_duration_minutes: r.turn_duration_minutes ?? 120,
              slot_step_minutes: r.slot_step_minutes ?? 30,
              last_seating_buffer_minutes: r.last_seating_buffer_minutes ?? 0,
              lead_time_hours: r.lead_time_hours ?? 2,
              booking_window_days: r.booking_window_days ?? 60,
              require_phone: r.require_phone ?? true,
              notify_new_bookings: r.notify_new_bookings ?? true,
              booking_email_subject: r.booking_email_subject ?? '',
              booking_email_intro: r.booking_email_intro ?? '',
              cancel_email_subject: r.cancel_email_subject ?? '',
              cancel_email_intro: r.cancel_email_intro ?? '',
              reminder_email_subject: r.reminder_email_subject ?? '',
              reminder_email_intro: r.reminder_email_intro ?? '',
              feedback_email_subject: r.feedback_email_subject ?? '',
              feedback_email_intro: r.feedback_email_intro ?? '',
              email_show_phone: r.email_show_phone ?? true,
              email_contact_phone: r.email_contact_phone ?? '',
              email_show_email: r.email_show_email ?? false,
              email_show_address: r.email_show_address ?? false,
              email_show_directions: r.email_show_directions ?? false,
              email_directions_address: r.email_directions_address ?? '',
              legal_name: r.legal_name ?? '',
              tax_number: r.tax_number ?? '',
              company_reg_number: r.company_reg_number ?? '',
              registered_seat: r.registered_seat ?? '',
              terms_sections: (r.terms_sections ?? []).map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
              good_to_know: (r.good_to_know ?? []).map((s) => ({ icon: s.icon ?? 'info', title: s.title ?? '', body: s.body ?? '' })),
              event_types: (r.event_types ?? []).map((e) => ({ icon: e.icon ?? 'party', label: e.label ?? '', enabled: e.enabled ?? true })),
            }}
          />
        }
      />
    </div>
  )
}
