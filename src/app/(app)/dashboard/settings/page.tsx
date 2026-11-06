import type { Where } from 'payload'
import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getSiteStats } from '@/lib/siteStats'
import { findAccountSubscription } from '@/lib/accountSubscription'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'
import { getTeamForBusiness } from '@/lib/teamContext'
import { getAuditLogForBusiness } from '@/lib/auditContext'
import {
  SettingsHub, type BillingData, type SiteData, type TeamMember,
} from '@/components/settings/SettingsHub'
import { getAccountBilling } from '@/lib/accountBilling'
import { getPricing } from '@/lib/pricing'
import { getOpeningHoursVM } from '@/lib/openingHours'
import { hoursRows } from '@/lib/hoursRows'
import { SALON_INCLUDED_STAFF } from '@/lib/tier'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'
import { can } from '@/lib/permissions'
import { createHmac } from 'crypto'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Invoice, Role } from '@/payload/payload-types'
import type { BookingPageEditorInitial } from '@/components/settings/booking-page/BookingPageEditor'
import { buildBookingPageEditorInitial } from '@/lib/bookingPageEditorInitial'

const EMPTY_ACCOUNT_BILLING: AccountBilling = {
  items: [], totalMonthlyHuf: 0, listMonthlyHuf: 0, cycle: 'monthly', annualDiscountPct: 0, count: 0, accountStatus: null,
}

function icalUrl(type: string, id: string | number) {
  const secret = process.env.PAYLOAD_SECRET ?? 'dev-secret'
  const token = createHmac('sha256', secret).update(`ical-${type}-${id}`).digest('hex').slice(0, 24)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  return `${base}/api/ical?id=${id}&type=${type}&token=${token}`
}

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const HUF = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

function planName(sub: { plan?: string | null; status?: string | null } | null): string {
  if (!sub) return 'Szalon'
  if (sub.status === 'trialing') return 'Szalon · Próbaidőszak'
  return sub.plan === 'paid' ? 'Szalon Pro' : 'Szalon'
}

export default async function SettingsPage() {
  const { salon, businessCount, capabilities, role } = await getOwnedSalon(1)
  requireAnyCapability(capabilities, ['settings.profile', 'settings.own_profile'], '/dashboard')
  const payload = await getPayloadClient()
  const user = await requireAuth()

  const ownerId = typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner
  // ── Csapat & jogok — VALÓS tulajdonos + membershipök (aktív tagok + függő meghívók). A
  // teljes névsor (email) csak `team.view`/`team.manage` jogú tagnak megy ki a szerverről.
  const canSeeTeam = can(capabilities, 'team.view') || can(capabilities, 'team.manage')
  const ownerEmail = (typeof salon.owner === 'object' && salon.owner?.email) || user.email || ''
  const ownerName = (typeof salon.owner === 'object' && salon.owner?.name) || user.name || salon.name
  const ownerAvatarUrl = (typeof salon.owner === 'object' && salon.owner?.avatar_url) || user.avatar_url || null
  // ── Egyedi szerepek — önálló `roles.view` joggal is látható (a szerkesztés owner-only marad).
  const canSeeRoles = canSeeTeam || can(capabilities, 'roles.view')
  // ── Számlázás — a teljes bontás (adószám, cégnév, számlák) csak `billing.manage` jogú tagnak.
  const canSeeBilling = can(capabilities, 'billing.manage')
  const canHours = can(capabilities, 'availability.view') || can(capabilities, 'availability.manage')
  const canProfile = can(capabilities, 'settings.profile')
  const activeStaffWhere: Where = { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] }
  // Előfizetés (16.5): az e havi felhasználás (a mentett kártyát a fül megnyitásakor kéri le: /api/billing/card)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Sebesség: a független lekérdezések EGYSZERRE futnak (eddig ~14 egymás után, mindegyik a másikra várt).
  const subP = ownerId ? findAccountSubscription({ payload }, ownerId) : Promise.resolve(null)
  const [
    sub, invoicesRes, team, rolesRes, auditLog, sitesRes, [billingAccount, pricing], inviteStaff,
    [usedEmails, activeStaff], hoursVM, editorStaff, editorServices, [consentTotal, consentOnsite],
  ] = await Promise.all([
    subP,
    subP.then((sub) => sub && canSeeBilling ? payload.find({
      collection: 'invoices',
      where: { subscription: { equals: sub.id } },
      sort: '-issued_at',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }) : null),
    canSeeTeam
      ? getTeamForBusiness({ type: 'salon', businessId: salon.id, ownerName, ownerEmail, ownerAvatarUrl, ownerUserId: ownerId })
      : Promise.resolve([] as TeamMember[]),
    canSeeRoles
      ? payload.find({ collection: 'roles', where: { salon: { equals: salon.id } }, sort: 'name', limit: 100, overrideAccess: true })
      : Promise.resolve({ docs: [] as Role[] }),
    // ── Audit-napló — VALÓS legutóbbi bejegyzések (a szalonra szűrve), csak `audit.view`-val.
    can(capabilities, 'audit.view') ? getAuditLogForBusiness({ type: 'salon', businessId: salon.id }) : Promise.resolve([]),
    // ── Telephelyek — VALÓS fiók-üzletek + statisztikájuk
    getActiveBusiness(user).then(async ({ businesses }) => ({ businesses, siteStats: await getSiteStats(businesses.map((b) => ({ id: b.id, type: b.type }))) })),
    Promise.all([
      canSeeBilling
        ? getAccountBilling(typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner ?? user.id)
        : Promise.resolve(EMPTY_ACCOUNT_BILLING),
      getPricing(),
    ]),
    // Csapat & jogok › Meghívás (közös InviteFlow): a fiókhoz még nem kötött munkatárs-profilok és a foglalható létszám
    can(capabilities, 'team.manage')
      ? payload.find({ collection: 'staff', where: activeStaffWhere, depth: 0, limit: 300, overrideAccess: true, select: { name: true, user: true } as never }).then((r) => r.docs as { id: number; name?: string | null; user?: unknown }[])
      : Promise.resolve(null),
    canSeeBilling ? Promise.all([
      payload.count({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, { salon: { equals: salon.id } }, { createdAt: { greater_than_equal: monthStart } }] }, overrideAccess: true }).then((r) => r.totalDocs),
      payload.count({ collection: 'staff', where: activeStaffWhere, overrideAccess: true }).then((r) => r.totalDocs),
    ]) : Promise.resolve([0, 0] as const),
    canHours || canProfile ? getOpeningHoursVM('salon', salon) : Promise.resolve(undefined),
    // Foglalóoldal-szerkesztő: munkatársak + szolgáltatások (csak beállítás-joggal)
    canProfile ? payload.find({ collection: 'staff', where: activeStaffWhere, sort: 'name', depth: 0, limit: 100, overrideAccess: true }).then((r) => r.docs) : Promise.resolve([]),
    canProfile ? payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      sort: ['sort_order', 'name'], depth: 0, limit: 200, overrideAccess: true, select: { name: true, online_visible: true } as never,
    }).then((r) => r.docs) : Promise.resolve([]),
    Promise.all([
      payload.count({ collection: 'bookings', where: { and: [{ salon: { equals: salon.id } }, { consent_accepted: { equals: true } }] }, overrideAccess: true }).then((r) => r.totalDocs),
      payload.count({ collection: 'bookings', where: { and: [{ salon: { equals: salon.id } }, { consent_accepted: { equals: true } }, { consent_accepted_via: { equals: 'onsite' } }] }, overrideAccess: true }).then((r) => r.totalDocs),
    ]),
  ])

  const plan = planName(sub)
  const subtitle = `${salon.name} · ${plan}`

  const { businesses, siteStats } = sitesRes
  const sites: SiteData[] = businesses.map((b, i) => {
    const current = b.type === 'salon' && b.id === String(salon.id)
    const meta = current
      ? [salon.city, salon.address, plan].filter(Boolean).join(' · ')
      : `${b.type === 'salon' ? 'Szalon' : 'Étterem'}`
    return {
      id: b.id,
      type: b.type,
      initials: initialsOf(b.name),
      name: b.name,
      meta: meta || plan,
      role: b.roleName,
      current,
      gold: !current && i > 0,
      logoUrl: b.logoUrl,
      team: siteStats[`${b.type}:${b.id}`]?.team ?? 0,
      monthBookings: siteStats[`${b.type}:${b.id}`]?.monthBookings ?? 0,
    }
  })

  const inviteSetup = inviteStaff
    ? { freeStaff: inviteStaff.filter((m) => !m.user).map((m) => ({ id: String(m.id), name: m.name ?? '' })), bookable: inviteStaff.length, extraFee: { fee: pricing.salon_extra_staff_huf, included: SALON_INCLUDED_STAFF } }
    : undefined

  const nextChargeDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : sub?.trial_ends_at
    ? new Date(sub.trial_ends_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const billingUsage = canSeeBilling ? {
    emailsUsed: usedEmails,
    emailCap: monthlyEmailCapForTier(pricing, resolveTier(salon.tier)),
    staff: activeStaff, staffIncluded: SALON_INCLUDED_STAFF,
  } : undefined

  const billing: BillingData = {
    planLabel: planName(sub),
    // Státusz/ciklus/próbaidő MINDENKINEK látszik (pl. a nav trial-badge-hez) — csak a
    // ténylegesen érzékeny (adószám, cím, számlák, terhelendő összeg) mezők vannak lakat mögött.
    subscriptionStatus: sub?.status ?? null,
    billingCycle: sub?.billing_cycle === 'annual' ? 'annual' : 'monthly',
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    trialEndsAt: sub?.trial_ends_at ?? null,
    nextChargeDate: canSeeBilling ? nextChargeDate : null,
    nextChargeAmount: canSeeBilling ? HUF(sub?.amount_huf ?? 0) : '',
    hasStripeCustomer: !!sub?.stripe_customer_id,
    legalName: canSeeBilling ? salon.legal_name ?? '' : '',
    taxNumber: canSeeBilling ? salon.tax_number ?? '' : '',
    companyRegNumber: canSeeBilling ? salon.company_reg_number ?? '' : '',
    billingEmail: canSeeBilling ? salon.billing_email ?? '' : '',
    billingPostalCode: canSeeBilling ? salon.billing_postal_code ?? '' : '',
    billingCity: canSeeBilling ? salon.billing_city ?? '' : '',
    billingStreet: canSeeBilling ? salon.billing_street ?? '' : '',
    invoices: (invoicesRes?.docs ?? [] as Invoice[]).map((inv) => ({
      id: String(inv.id),
      invoice_number: inv.invoice_number,
      invoice_url: inv.invoice_url ?? null,
      amount_huf: inv.amount_huf ?? null,
      issued_at: inv.issued_at ?? null,
      test: inv.test ?? null,
    })),
    lastInvoiceNumber: canSeeBilling ? sub?.last_invoice_number ?? null : null,
    lastInvoiceUrl: canSeeBilling ? sub?.last_invoice_url ?? null : null,
    usage: billingUsage,
  }

  const senderLabel = `${salon.name}${salon.email ? ` <${salon.email}>` : ''}`

  // ── Foglalóoldal-szerkesztő kezdőadatai (csak beállítás-joggal) — közös builder a szalonnal/étteremmel ──
  const bookingPageEditor: BookingPageEditorInitial | undefined = canProfile
    ? buildBookingPageEditorInitial('salon', salon, {
        hours: hoursVM ? hoursRows(hoursVM.days) : [],
        staff: editorStaff.map((m) => ({
          id: String(m.id),
          name: m.name,
          role_title: m.role_title ?? '',
          bio: m.bio ?? '',
          social_links: (m.social_links ?? []).map((l: { url: string }) => l.url),
        })),
        // Foglalóoldal › Szolgáltatások: melyik látszik online (az aktívak közül)
        services: editorServices.map((x) => { const v = x as unknown as { id: number; name?: string; online_visible?: boolean | null }; return { id: String(v.id), name: v.name ?? '', visible: v.online_visible !== false } }),
      })
    : undefined

  const np = salon.notification_prefs ?? {}
  const fm = salon.feature_modules ?? {}

  const consentStats = { total: consentTotal, onsite: consentOnsite }
  return (
    <div className="p-5 lg:p-0">
      <SettingsHub
        variant="salon"
        subtitle={subtitle}
        businessName={salon.name}
        businessCity={salon.city}
        availabilityHref="/dashboard/availability"
        hoursVM={canHours ? hoursVM : undefined}
        hoursCanManage={can(capabilities, 'availability.manage')}
        consentStats={consentStats}
        selfProfile={{
          name: user.name ?? '',
          email: user.email ?? '',
          avatarUrl: (user as { avatar_url?: string | null }).avatar_url ?? null,
          phone: (user as { phone?: string | null }).phone ?? null,
          address: (user as { address?: string | null }).address ?? null,
          birthday: (user as { birthday?: string | null }).birthday ?? null,
          emergency: (user as { emergency_contact?: string | null }).emergency_contact ?? null,
          roles: businesses.map((b) => ({ name: b.name, role: b.roleName })),
        }}
        apiBase="/api/salon/settings"
        notificationPrefs={{
          confirm_email: np.confirm_email ?? true,
          cancel_email: np.cancel_email ?? true,
          modification_email: np.modification_email ?? false,
          digest_morning_email: np.digest_morning_email ?? false,
          digest_evening_email: np.digest_evening_email ?? false,
        }}
        featureModules={{
          reminders_on: fm.reminders_on ?? true,
          reminder_ch_email: fm.reminder_ch_email ?? true,
          reminder_ch_push: fm.reminder_ch_push ?? false,
          reminder_t_24h: fm.reminder_t_24h ?? false,
          reminder_t_3h: fm.reminder_t_3h ?? true,
          reminder_t_1h: fm.reminder_t_1h ?? false,
          reminder_t_48h: fm.reminder_t_48h ?? false,
          reminder_custom_hours: fm.reminder_custom_hours ?? null,
          waitlist_on: fm.waitlist_on ?? false,
          waitlist_auto_promote: fm.waitlist_auto_promote ?? false,
          recurring_on: fm.recurring_on ?? false,
          reviews_on: fm.reviews_on ?? false,
          google_review_url: fm.google_review_url ?? null,
          review_delay_hours: fm.review_delay_hours ?? 1,
          review_target: fm.review_target ?? 'google',
          tripadvisor_review_url: fm.tripadvisor_review_url ?? null,
          facebook_review_url: fm.facebook_review_url ?? null,
          google_booking_confirmed: fm.google_booking_confirmed ?? false,
          facebook_booking_confirmed: fm.facebook_booking_confirmed ?? false,
        }}
        depositSettings={{
          enabled: salon.deposit_settings?.enabled ?? false,
          type: (salon.deposit_settings?.type as 'fixed' | 'percent' | 'per_pax') ?? 'fixed',
          fixedAmountHuf: salon.deposit_settings?.fixed_amount_huf ?? null,
          percentValue: salon.deposit_settings?.percent_value ?? null,
          perPaxAmountHuf: salon.deposit_settings?.per_pax_amount_huf ?? null,
          refundHoursBefore: salon.deposit_settings?.refund_hours_before ?? 24,
          applyWhen: salon.deposit_settings?.apply_when ?? 'always',
          minPriceHuf: salon.deposit_settings?.min_price_huf ?? null,
          minPax: salon.deposit_settings?.min_pax ?? null,
          specialWeekdays: salon.deposit_settings?.special_days?.weekdays ?? [],
          specialDates: salon.deposit_settings?.special_days?.dates ?? [],
        }}
        invoiceSettings={{
          provider: (salon.invoice_settings?.invoice_provider as 'szamlazz' | 'billingo' | 'none') ?? 'none',
          hasSzamlazzKey: !!salon.invoice_settings?.szamlazz_agent_key_enc,
          hasBillingoKey: !!salon.invoice_settings?.billingo_api_key_enc,
          issuer: salon.invoice_settings?.issuer === 'staff' ? 'staff' : 'business',
          onsite: { enabled: !!salon.onsite_payment?.enabled, mode: salon.onsite_payment?.mode === 'invoice' ? 'invoice' : 'register', methods: (salon.onsite_payment?.methods ?? 'cash,card,transfer').split(',').filter(Boolean), invoiceDefault: salon.onsite_payment?.invoice_default === 'always' ? 'always' : 'ask' },
        }}
        voucherSettings={{
          enabled: salon.voucher_settings?.enabled ?? false,
          minAmountHuf: salon.voucher_settings?.min_amount_huf ?? 2000,
          maxAmountHuf: salon.voucher_settings?.max_amount_huf ?? 100000,
          validityMonths: salon.voucher_settings?.validity_months ?? 12,
          allowCompany: salon.voucher_settings?.allow_company !== false,
        }}
        consentSettings={{
          enabled: salon.consent_settings?.enabled ?? false,
          title: salon.consent_settings?.title ?? '',
          templateText: salon.consent_settings?.template_text ?? '',
        }}
        stripeConnectAccountId={salon.stripe_connect_account_id ?? null}
        stripeConnectOnboarded={!!salon.stripe_connect_onboarded}
        businessTier={salon.tier ?? null}
        supportedLocales={salon.supported_locales}
        senderLabel={senderLabel}
        billing={billing}
        billingAccount={billingAccount}
        pricing={pricing}
        activeBusinessId={String(salon.id)}
        startedAt={salon.createdAt}
        team={team}
        sites={sites}
        businessCount={businessCount}
        planLabel={plan}
        auditLog={auditLog}
        myCapabilities={capabilities}
        customRoles={rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name, desc: `${r.capabilities?.length ?? 0} jogosultság` }))}
        inviteSetup={inviteSetup}
        icalUrl={icalUrl('salon', salon.id)}
        bookingUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${salon.slug}/book`}
        embedUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${salon.slug}?embed=1`}
        embedSmartSnippet={`<div class="davelopment-embed" data-slug="${salon.slug}"></div>\n<script src="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/embed.js" async></script>`}
        webhookUrl={(salon as unknown as { webhook_url?: string | null }).webhook_url ?? null}
        ga4Id={salon.marketing_tracking?.ga4_measurement_id ?? null}
        facebookPixelId={salon.marketing_tracking?.facebook_pixel_id ?? null}
        rolesData={canSeeRoles ? { initial: rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name, description: r.description ?? null, capabilities: r.capabilities ?? null, booking_notify_level: r.booking_notify_level ?? null })), isOwner: role === 'owner' } : undefined}
        profilePanel={<SalonSettingsForm salon={salon} businessCount={businessCount} />}
        bookingPageEditor={bookingPageEditor}
        notifyNewBookings={salon.notify_new_bookings ?? true}
      />
    </div>
  )
}
