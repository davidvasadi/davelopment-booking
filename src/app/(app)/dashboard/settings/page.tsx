import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'
import { getTeamForBusiness } from '@/lib/teamContext'
import { getAuditLogForBusiness } from '@/lib/auditContext'
import {
  SettingsHub, type BillingData, type RulesData, type SiteData, type TeamMember,
} from '@/components/settings/SettingsHub'

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const HUF = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

function planName(sub: { plan?: string | null; status?: string | null } | null): string {
  if (!sub) return 'Szalon'
  if (sub.status === 'trialing') return 'Szalon · Próbaidőszak'
  return sub.plan === 'paid' ? 'Szalon Pro' : 'Szalon'
}

export default async function SettingsPage() {
  const { salon, businessCount } = await getOwnedSalon(1)
  const payload = await getPayloadClient()
  const user = await requireAuth()

  const ownerId = typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner
  const sub = ownerId ? await findAccountSubscription({ payload }, ownerId) : null

  const plan = planName(sub)
  const subtitle = `${salon.name} · ${plan}`

  // ── Csapat & jogok — VALÓS tulajdonos + membershipök (aktív tagok + függő meghívók).
  const ownerEmail = (typeof salon.owner === 'object' && salon.owner?.email) || user.email || ''
  const ownerName = (typeof salon.owner === 'object' && salon.owner?.name) || user.name || salon.name
  const team: TeamMember[] = await getTeamForBusiness({
    type: 'salon',
    businessId: salon.id,
    ownerName,
    ownerEmail,
  })

  // ── Audit-napló — VALÓS legutóbbi bejegyzések (a szalonra szűrve).
  const auditLog = await getAuditLogForBusiness({ type: 'salon', businessId: salon.id })

  // ── Telephelyek — VALÓS fiók-üzletek. Az aktuális üzlethez a betöltött szalon címét mutatjuk.
  const { businesses } = await getActiveBusiness(user)
  const sites: SiteData[] = businesses.map((b, i) => {
    const current = b.type === 'salon' && b.id === String(salon.id)
    const meta = current
      ? [salon.city, salon.address, plan].filter(Boolean).join(' · ')
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

  // ── Foglalási szabályok — VALÓS mezők a szalonból. A szalonnál nincs idősáv/max-létszám
  //    mező, ezért „—" (a stat-kártya null-t kap).
  const rules: RulesData = {
    slotDurationMin: null,
    bufferMin: salon.booking_buffer_minutes ?? null,
    maxParty: null,
    leadTimeHours: null,
    windowDays: salon.booking_window_days ?? null,
  }

  // ── Számlázás — VALÓS fiók-előfizetésből. Számla-adat (invoice) egyelőre nincs a sémában
  //    → üres állapot. Fizetési mód kártya sincs rögzítve → null (üzenet).
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
      legalName: salon.legal_name ?? '',
      taxNumber: salon.tax_number ?? '',
      address: salon.registered_seat ?? [salon.postal_code, salon.city, salon.address].filter(Boolean).join(' '),
    },
    invoices: [],
  }

  const senderLabel = `${salon.name}${salon.email ? ` <${salon.email}>` : ''}`

  const np = salon.notification_prefs ?? {}
  const br = salon.booking_rules ?? {}
  const fm = salon.feature_modules ?? {}

  return (
    <div className="p-5 lg:p-0">
      <SettingsHub
        variant="salon"
        businessName={salon.name}
        subtitle={subtitle}
        availabilityHref="/dashboard/availability"
        apiBase={`/api/salons/${salon.id}`}
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
        profilePanel={<SalonSettingsForm salon={salon} businessCount={businessCount} />}
      />
    </div>
  )
}
