import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getSiteStats } from '@/lib/siteStats'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { RestaurantSettingsForm } from '@/components/restaurant/RestaurantSettingsForm'
import { buildBookingPageEditorInitial } from '@/lib/bookingPageEditorInitial'
import { getMaxPax } from '@/lib/restaurantBooking'
import { getCapacityVM } from '@/lib/restaurantCapacity'
import { parseEmailBlocks } from '@/lib/emailBlocks'
import { getTeamForBusiness } from '@/lib/teamContext'
import { getAuditLogForBusiness } from '@/lib/auditContext'
import {
  SettingsHub, type BillingData, type SiteData, type TeamMember,
} from '@/components/settings/SettingsHub'
import { getAccountBilling } from '@/lib/accountBilling'
import { getPricing } from '@/lib/pricing'
import { getOpeningHoursVM } from '@/lib/openingHours'
import { hoursRows } from '@/lib/hoursRows'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'
import { can } from '@/lib/permissions'
import { createHmac } from 'crypto'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Restaurant, Invoice, Role, Room, Table } from '@/payload/payload-types'
import { RESTAURANT_TEMPLATES } from '@/lib/restaurantTemplates'
import type { CustomQuestionType } from '@/components/settings/CustomQuestionsEditor'
import { marketingEmailsByMonth } from '@/lib/fastRead'

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
  if (!sub) return 'Étterem'
  if (sub.status === 'trialing') return 'Étterem · Próbaidőszak'
  return sub.plan === 'paid' ? 'Étterem Pro' : 'Étterem'
}

const relId = (v: unknown): string | null => (v == null ? null : typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))

export default async function RestaurantSettingsPage() {
  const { restaurant, businessCount, userId, capabilities, role } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['settings.profile', 'settings.own_profile'], '/restaurant')
  const payload = await getPayloadClient()
  const r = restaurant as Restaurant

  const user = await requireAuth()

  // ── Csapat & jogok — VALÓS tulajdonos + membershipök. A teljes névsor (email) csak
  // `team.view`/`team.manage` jogú tagnak megy ki a szerverről.
  const canSeeTeam = can(capabilities, 'team.view') || can(capabilities, 'team.manage')
  // FONTOS: a tulaj-sor a VALÓS `r.owner` relációból jön (depth:1, tehát objektum) — nem a
  // jelenleg bejelentkezett nézőből (korábbi hiba: az üzletvezető látszott tulajdonosként).
  const restOwner = typeof r.owner === 'object' ? r.owner : null
  // ── Egyedi szerepek — önálló `roles.view` joggal is látható (a szerkesztés owner-only marad).
  const canSeeRoles = canSeeTeam || can(capabilities, 'roles.view')
  // ── Számlázás — a teljes bontás (adószám, cégnév, számlák) csak `billing.manage` jogú tagnak.
  const canSeeBilling = can(capabilities, 'billing.manage')
  const canHours = can(capabilities, 'availability.view') || can(capabilities, 'availability.manage')
  const canProfile = can(capabilities, 'settings.profile')
  // Előfizetés (16.5): az e havi felhasználás (a mentett kártyát a fül megnyitásakor kéri le: /api/billing/card)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Sebesség: a független lekérdezések EGYSZERRE futnak (eddig egymás után, mindegyik a másikra várt).
  const subP = findAccountSubscription({ payload }, userId)
  const [
    sub, invoicesRes, team, rolesRes, auditLog, sitesRes, [billingAccount, pricing], emailsUsed,
    hoursVM, maxPax, capacity, [consentTotal, consentOnsite], tablesData,
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
      ? getTeamForBusiness({
          type: 'restaurant',
          businessId: r.id,
          ownerName: restOwner?.name || r.name,
          ownerEmail: restOwner?.email || r.email || '',
          ownerAvatarUrl: restOwner?.avatar_url,
        })
      : Promise.resolve([] as TeamMember[]),
    canSeeRoles
      ? payload.find({ collection: 'roles', where: { restaurant: { equals: r.id } }, sort: 'name', limit: 100, overrideAccess: true })
      : Promise.resolve({ docs: [] as Role[] }),
    // ── Audit-napló — VALÓS legutóbbi bejegyzések (az étteremre szűrve), csak `audit.view`-val.
    can(capabilities, 'audit.view') ? getAuditLogForBusiness({ type: 'restaurant', businessId: r.id }) : Promise.resolve([]),
    // ── Telephelyek — VALÓS fiók-üzletek + statisztikájuk
    getActiveBusiness(user).then(async ({ businesses }) => ({ businesses, siteStats: await getSiteStats(businesses.map((b) => ({ id: b.id, type: b.type }))) })),
    Promise.all([
      canSeeBilling ? getAccountBilling(userId) : Promise.resolve(EMPTY_ACCOUNT_BILLING),
      getPricing(),
    ]),
    canSeeBilling
      ? payload.count({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, { restaurant: { equals: restaurant.id } }, { createdAt: { greater_than_equal: monthStart } }] }, overrideAccess: true }).then((x) => x.totalDocs)
      : Promise.resolve(0),
    canHours || canProfile ? getOpeningHoursVM('restaurant', restaurant) : Promise.resolve(undefined),
    canProfile ? getMaxPax(r.id) : Promise.resolve(undefined),
    getCapacityVM(r),
    // a két nyilatkozat-számláló
    Promise.all([
      payload.count({ collection: 'reservations', where: { and: [{ restaurant: { equals: restaurant.id } }, { consent_accepted: { equals: true } }] }, overrideAccess: true }).then((x) => x.totalDocs),
      payload.count({ collection: 'reservations', where: { and: [{ restaurant: { equals: restaurant.id } }, { consent_accepted: { equals: true } }, { consent_accepted_via: { equals: 'onsite' } }] }, overrideAccess: true }).then((x) => x.totalDocs),
    ]),
    // Asztalok & termek (design 16.22): a termek és az asztalok a szerkesztőhöz — a külön Asztalok oldal ide költözött
    can(capabilities, 'tables.view') || can(capabilities, 'tables.manage') ? Promise.all([
      payload.find({ collection: 'rooms', where: { restaurant: { equals: r.id } }, sort: 'sort_order', limit: 100, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'tables', where: { restaurant: { equals: r.id } }, sort: 'sort_order', limit: 500, depth: 0, overrideAccess: true }),
    ]).then(([roomsRes, tablesRes]) => ({
      rooms: (roomsRes.docs as Room[]).map((x) => ({ id: String(x.id), name: x.name, outdoor: !!x.is_outdoor, seasonal: !!x.seasonal, start: x.season_start ?? null, end: x.season_end ?? null, sort: x.sort_order ?? 0, online: x.online_bookable !== false })),
      tables: (tablesRes.docs as Table[]).map((t) => ({
        id: String(t.id), name: t.name, capacity: t.capacity, roomId: relId(t.room), combinable: (t.combinable_with ?? []).map((c) => relId(c)!).filter(Boolean),
        active: t.is_active !== false, sort: t.sort_order ?? 0,
      })),
      templates: RESTAURANT_TEMPLATES.map((t) => ({ id: t.id, label: t.label, rooms: t.rooms.length, turn: t.turn_duration_minutes })),
      canManage: can(capabilities, 'tables.manage'),
    })) : Promise.resolve(undefined),
  ])

  const plan = planName(sub)
  const subtitle = `${r.name} · ${plan}`

  const { businesses, siteStats } = sitesRes
  const sites: SiteData[] = businesses.map((b, i) => {
    const current = b.type === 'restaurant' && b.id === String(r.id)
    const meta = current
      ? [r.city, r.address, plan].filter(Boolean).join(' · ')
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

  const nextChargeDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : sub?.trial_ends_at
    ? new Date(sub.trial_ends_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // az elmúlt 6 hónap hírlevelei (Előfizetés › Felhasználás grafikon) — közvetlen SQL, egy csoportosított számolás
  const emailHistory = canSeeBilling ? await marketingEmailsByMonth({ restaurant: restaurant.id }, 6).catch(() => []) : []
  const billingUsage = canSeeBilling ? {
    emailsUsed, emailHistory,
    emailCap: monthlyEmailCapForTier(pricing, resolveTier(restaurant.tier)),
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
    legalName: canSeeBilling ? r.legal_name ?? '' : '',
    taxNumber: canSeeBilling ? r.tax_number ?? '' : '',
    companyRegNumber: canSeeBilling ? r.company_reg_number ?? '' : '',
    billingEmail: canSeeBilling ? r.billing_email ?? '' : '',
    billingPostalCode: canSeeBilling ? r.billing_postal_code ?? '' : '',
    billingCity: canSeeBilling ? r.billing_city ?? '' : '',
    billingStreet: canSeeBilling ? r.billing_street ?? '' : '',
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

  const senderLabel = `${r.name}${r.email ? ` <${r.email}>` : ''}`

  // ── Foglalóoldal-szerkesztő kezdőadatai (csak beállítás-joggal) — ugyanaz a builder, mint a szalonnál ──
  const bookingPageEditor = canProfile
    ? buildBookingPageEditorInitial('restaurant', r, { maxPax: maxPax ?? undefined, hours: hoursVM ? hoursRows(hoursVM.days) : [] })
    : undefined

  const np = r.notification_prefs ?? {}
  const fm = r.feature_modules ?? {}

  const consentStats = { total: consentTotal, onsite: consentOnsite }
  return (
    <div className="p-5 lg:p-0">
      <SettingsHub
        bookingPageEditor={bookingPageEditor}
        notifyNewBookings={r.notify_new_bookings ?? true}
        variant="restaurant"
        subtitle={subtitle}
        businessName={restaurant.name}
        businessCity={restaurant.city}
        availabilityHref="/restaurant/availability"
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
        apiBase="/api/restaurant/settings"
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
          reminder_t_24h: fm.reminder_t_24h ?? true,
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
          enabled: r.deposit_settings?.enabled ?? false,
          type: (r.deposit_settings?.type as 'fixed' | 'percent' | 'per_pax') ?? 'fixed',
          fixedAmountHuf: r.deposit_settings?.fixed_amount_huf ?? null,
          percentValue: r.deposit_settings?.percent_value ?? null,
          perPaxAmountHuf: r.deposit_settings?.per_pax_amount_huf ?? null,
          refundHoursBefore: r.deposit_settings?.refund_hours_before ?? 24,
          applyWhen: r.deposit_settings?.apply_when ?? 'always',
          minPriceHuf: r.deposit_settings?.min_price_huf ?? null,
          minPax: r.deposit_settings?.min_pax ?? null,
          specialWeekdays: r.deposit_settings?.special_days?.weekdays ?? [],
          specialDates: r.deposit_settings?.special_days?.dates ?? [],
        }}
        invoiceSettings={{
          provider: (r.invoice_settings?.invoice_provider as 'szamlazz' | 'billingo' | 'none') ?? 'none',
          hasSzamlazzKey: !!r.invoice_settings?.szamlazz_agent_key_enc,
          hasBillingoKey: !!r.invoice_settings?.billingo_api_key_enc,
        }}
        voucherSettings={{
          enabled: r.voucher_settings?.enabled ?? false,
          minAmountHuf: r.voucher_settings?.min_amount_huf ?? 2000,
          maxAmountHuf: r.voucher_settings?.max_amount_huf ?? 100000,
          validityMonths: r.voucher_settings?.validity_months ?? 12,
          allowCompany: r.voucher_settings?.allow_company !== false,
        }}
        consentSettings={{
          enabled: r.consent_settings?.enabled ?? false,
          title: r.consent_settings?.title ?? '',
          templateText: r.consent_settings?.template_text ?? '',
        }}
        stripeConnectAccountId={r.stripe_connect_account_id ?? null}
        stripeConnectOnboarded={!!r.stripe_connect_onboarded}
        businessTier={r.tier ?? null}
        supportedLocales={r.supported_locales}
        capacity={capacity}
        tablesData={tablesData}
        senderLabel={senderLabel}
        billing={billing}
        billingAccount={billingAccount}
        pricing={pricing}
        activeBusinessId={String(r.id)}
        startedAt={r.createdAt}
        team={team}
        sites={sites}
        businessCount={businessCount}
        planLabel={plan}
        auditLog={auditLog}
        myCapabilities={capabilities}
        customRoles={rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name, desc: `${r.capabilities?.length ?? 0} jogosultság` }))}
        icalUrl={icalUrl('restaurant', r.id)}
        bookingUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${(r as Restaurant & { slug?: string }).slug ?? r.id}/book`}
        embedUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${(r as Restaurant & { slug?: string }).slug ?? r.id}?embed=1`}
        embedSmartSnippet={`<div class="davelopment-embed" data-slug="${(r as Restaurant & { slug?: string }).slug ?? r.id}"></div>\n<script src="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/embed.js" async></script>`}
        webhookUrl={(r as Restaurant & { webhook_url?: string | null }).webhook_url ?? null}
        ga4Id={r.marketing_tracking?.ga4_measurement_id ?? null}
        facebookPixelId={r.marketing_tracking?.facebook_pixel_id ?? null}
        rolesData={canSeeRoles ? { initial: rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name, description: r.description ?? null, capabilities: r.capabilities ?? null, booking_notify_level: r.booking_notify_level ?? null })), isOwner: role === 'owner' } : undefined}
        profilePanel={
          <RestaurantSettingsForm
            restaurantId={r.id}
            restaurantName={r.name}
            restaurantLogo={r.logo && typeof r.logo === 'object' ? (r.logo as { url?: string | null }).url ?? null : null}
            businessCount={businessCount}
            supportedLocales={r.supported_locales}
            initial={{
              name: r.name,
              slug: (r as Restaurant & { slug?: string }).slug ?? '',
              city: r.city ?? '',
              address: r.address ?? '',
              phone: r.phone ?? '',
              email: r.email ?? '',
              website: r.website ?? '',
              privacy_url: r.privacy_url ?? '',
              social_links: (r.social_links ?? []).map((s) => s.url),
              cover_focal_x: r.cover_focal_x ?? 50,
              cover_focal_y: r.cover_focal_y ?? 50,
              cover_zoom: r.cover_zoom ?? 1,
              description: r.description ?? '',
              turn_duration_minutes: r.turn_duration_minutes ?? 120,
              slot_step_minutes: r.slot_step_minutes ?? 30,
              last_seating_buffer_minutes: r.last_seating_buffer_minutes ?? 0,
              lead_time_hours: r.lead_time_hours ?? 2,
              booking_window_days: r.booking_window_days ?? 60,
              require_phone: r.require_phone ?? true,
              notify_new_bookings: r.notify_new_bookings ?? true,
              booking_email_subject: r.booking_email_subject ?? '',
              booking_email_intro: parseEmailBlocks(r.booking_email_intro),
              cancel_email_subject: r.cancel_email_subject ?? '',
              cancel_email_intro: parseEmailBlocks(r.cancel_email_intro),
              reminder_email_subject: r.reminder_email_subject ?? '',
              reminder_email_intro: parseEmailBlocks(r.reminder_email_intro),
              feedback_email_subject: r.feedback_email_subject ?? '',
              feedback_email_intro: parseEmailBlocks(r.feedback_email_intro),
              notify_email_subject: r.notify_email_subject ?? '',
              notify_email_intro: parseEmailBlocks(r.notify_email_intro),
              email_show_phone: r.email_show_phone ?? true,
              email_contact_phone: r.email_contact_phone ?? '',
              email_show_email: r.email_show_email ?? false,
              email_show_address: r.email_show_address ?? false,
              email_show_directions: r.email_show_directions ?? false,
              email_directions_address: r.email_directions_address ?? '',
              email_show_terms: r.email_show_terms ?? true,
              legal_name: r.legal_name ?? '',
              tax_number: r.tax_number ?? '',
              company_reg_number: r.company_reg_number ?? '',
              registered_seat: r.registered_seat ?? '',
              terms_sections: (r.terms_sections ?? []).map((s) => ({ ...(s.id ? { id: s.id } : {}), title: s.title ?? '', body: s.body ?? '' })),
              good_to_know: (r.good_to_know ?? []).map((s) => ({ ...(s.id ? { id: s.id } : {}), icon: s.icon ?? 'info', title: s.title ?? '', body: s.body ?? '' })),
              event_types: (r.event_types ?? []).map((e) => ({ ...(e.id ? { id: e.id } : {}), icon: e.icon ?? 'party', label: e.label ?? '', enabled: e.enabled ?? true })),
              custom_questions: (r.custom_questions ?? []).map((q) => ({
                id: q.id ?? crypto.randomUUID(),
                label: q.label ?? '',
                type: (q.type ?? 'text') as CustomQuestionType,
                options: (q.options ?? []).map((o) => ({ value: o.value ?? '' })),
                required: q.required ?? false,
              })),
            }}
          />
        }
      />
    </div>
  )
}
