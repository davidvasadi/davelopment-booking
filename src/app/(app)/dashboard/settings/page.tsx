import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'
import { ProfileEditor } from '@/components/dashboard/ProfileEditor'
import { DefaultBreakCard } from '@/components/dashboard/DefaultBreakCard'
import { getTeamForBusiness } from '@/lib/teamContext'
import { getAuditLogForBusiness } from '@/lib/auditContext'
import {
  SettingsHub, type BillingData, type RulesData, type SiteData, type TeamMember,
} from '@/components/settings/SettingsHub'
import { RolesManager } from '@/components/settings/RolesManager'
import { getAccountBilling } from '@/lib/accountBilling'
import { getPricing } from '@/lib/pricing'
import { can } from '@/lib/permissions'
import { createHmac } from 'crypto'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Invoice, Role, Media } from '@/payload/payload-types'
import type { BookingPageEditorInitial } from '@/components/settings/booking-page/BookingPageEditor'
import { resolveAvailableLocales } from '@/lib/i18n'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { randomUUID } from 'crypto'

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
  const sub = ownerId ? await findAccountSubscription({ payload }, ownerId) : null

  const plan = planName(sub)
  const subtitle = `${salon.name} · ${plan}`

  // ── Csapat & jogok — VALÓS tulajdonos + membershipök (aktív tagok + függő meghívók). A
  // teljes névsor (email) csak `team.view`/`team.manage` jogú tagnak megy ki a szerverről —
  // korábban BÁRKI megkapta, aki egyáltalán be tudott lépni a Beállításokba, a UI csak a fület
  // rejtette el kliens-oldalon (a payloadban ott volt az adat).
  const canSeeTeam = can(capabilities, 'team.view') || can(capabilities, 'team.manage')
  const ownerEmail = (typeof salon.owner === 'object' && salon.owner?.email) || user.email || ''
  const ownerName = (typeof salon.owner === 'object' && salon.owner?.name) || user.name || salon.name
  const ownerAvatarUrl = (typeof salon.owner === 'object' && salon.owner?.avatar_url) || user.avatar_url || null
  const team: TeamMember[] = canSeeTeam
    ? await getTeamForBusiness({ type: 'salon', businessId: salon.id, ownerName, ownerEmail, ownerAvatarUrl, ownerUserId: ownerId })
    : []

  // ── Egyedi szerepek (2. fázis) — az üzlet custom szerepei a RolesManager panelhez. Önálló
  // `roles.view` joggal is látható, a `team.view`/`team.manage`-től FÜGGETLENÜL (pl. valaki
  // lássa, milyen szerepek/jogok léteznek, anélkül hogy a csapat-listát is látná) — a szerkesztés
  // ettől függetlenül továbbra is owner-only (`assertOwner` a szerveren, `isOwner` a kliensen).
  const canSeeRoles = canSeeTeam || can(capabilities, 'roles.view')
  const rolesRes = canSeeRoles
    ? await payload.find({ collection: 'roles', where: { salon: { equals: salon.id } }, sort: 'name', limit: 100, overrideAccess: true })
    : { docs: [] as Role[] }

  // ── Audit-napló — VALÓS legutóbbi bejegyzések (a szalonra szűrve), csak `audit.view`-val.
  const auditLog = can(capabilities, 'audit.view')
    ? await getAuditLogForBusiness({ type: 'salon', businessId: salon.id })
    : []

  // ── Saját napi szünet — a bejelentkezett user linkelt staff-rekordja EBBEN a szalonban (ha
  // van), hogy a "Saját profil" fülön önkiszolgálóan beállíthassa az alap szünetidejét.
  const myStaffRes = await payload.find({
    collection: 'staff',
    where: { and: [{ salon: { equals: salon.id } }, { user: { equals: user.id } }] },
    depth: 0, limit: 1, overrideAccess: true,
  })
  const myStaff = myStaffRes.docs[0] ?? null

  // ── Telephelyek — VALÓS fiók-üzletek. Az aktuális üzlethez a betöltött szalon címét mutatjuk.
  const { businesses } = await getActiveBusiness(user)
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

  // ── Számlázás — VALÓS fiók-előfizetés + üzlet-díjak + globális árazás. A teljes bontás
  // (adószám, cégnév, számlák) csak `billing.manage` jogú tagnak megy ki a szerverről.
  const canSeeBilling = can(capabilities, 'billing.manage')
  const [billingAccount, pricing] = await Promise.all([
    canSeeBilling
      ? getAccountBilling(typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner ?? user.id)
      : Promise.resolve(EMPTY_ACCOUNT_BILLING),
    getPricing(),
  ])

  const nextChargeDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : sub?.trial_ends_at
    ? new Date(sub.trial_ends_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const invoicesRes = sub && canSeeBilling ? await payload.find({
    collection: 'invoices',
    where: { subscription: { equals: sub.id } },
    sort: '-issued_at',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  }) : null

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
  }

  const senderLabel = `${salon.name}${salon.email ? ` <${salon.email}>` : ''}`

  // ── Foglalóoldal-szerkesztő kezdőadatai (csak beállítás-joggal) ──
  const mediaOf = (m: unknown) => (m && typeof m === 'object' ? { id: Number((m as Media).id), url: (m as Media).url ?? null } : { id: null, url: null })
  const bookingPageEditor: BookingPageEditorInitial | undefined = can(capabilities, 'settings.profile')
    ? await (async () => {
        const staffRes = await payload.find({
          collection: 'staff',
          where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
          sort: 'name', depth: 0, limit: 100, overrideAccess: true,
        })
        const cover = mediaOf(salon.cover_image)
        const logo = mediaOf(salon.logo)
        return {
          slug: salon.slug,
          supportedLocales: resolveAvailableLocales(salon.supported_locales),
          name: salon.name,
          address: salon.address ?? '',
          city: salon.city ?? '',
          phone: salon.phone ?? '',
          email: salon.email ?? '',
          website: salon.website ?? '',
          description: typeof salon.description === 'string' ? salon.description : '',
          socialLinks: (salon.social_links ?? []).map((l) => l.url),
          coverId: cover.id,
          coverUrl: cover.url,
          coverFocalX: salon.cover_focal_x ?? 50,
          coverFocalY: salon.cover_focal_y ?? 50,
          coverZoom: salon.cover_zoom ?? 1,
          logoId: logo.id,
          logoUrl: logo.url,
          goodToKnow: (salon.good_to_know ?? []).map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
          coverFocalMobileX: salon.cover_focal_mobile_x ?? null,
          coverFocalMobileY: salon.cover_focal_mobile_y ?? null,
          showServiceCount: salon.booking_rules?.show_service_count_on_public ?? salon.booking_rules?.show_catalog_counts_on_public !== false,
          showStaffCount: salon.booking_rules?.show_staff_count_on_public ?? salon.booking_rules?.show_catalog_counts_on_public !== false,
          sectionOrder: (() => {
            const all = ['services', 'voucher', 'staff', 'reviews']
            const saved = (salon.booking_rules?.public_section_order ?? []).filter((x) => all.includes(x))
            return [...saved, ...all.filter((x) => !saved.includes(x))]
          })(),
          hiddenSections: salon.booking_rules?.public_sections_hidden ?? [],
          minLeadHours: salon.booking_rules?.min_lead_hours ?? null,
          servicesExpandedOnMain: !!salon.booking_rules?.services_expanded_on_main,
          bookingRules: (salon.booking_rules ?? {}) as Record<string, unknown>,
          notificationPrefs: (salon.notification_prefs ?? {}) as Record<string, unknown>,
          featureModules: (salon.feature_modules ?? {}) as Record<string, unknown>,
          bookingWindowDays: salon.booking_window_days ?? 60,
          bufferMinutes: salon.booking_buffer_minutes ?? 15,
          requirePhone: salon.require_phone ?? true,
          autoConfirm: salon.booking_rules?.auto_confirm ?? true,
          requireAddress: !!salon.booking_rules?.require_address,
          requireAddressNote: salon.booking_rules?.require_address_note ?? '',
          confirmEmail: salon.notification_prefs?.confirm_email !== false,
          reminders: {
            on: salon.feature_modules?.reminders_on ?? true,
            h48: !!salon.feature_modules?.reminder_t_48h,
            h24: !!salon.feature_modules?.reminder_t_24h,
            h3: salon.feature_modules?.reminder_t_3h ?? true,
            h1: !!salon.feature_modules?.reminder_t_1h,
            custom: salon.feature_modules?.reminder_custom_hours ?? null,
            chEmail: salon.feature_modules?.reminder_ch_email ?? true,
            chPush: !!salon.feature_modules?.reminder_ch_push,
          },
          consentEnabled: !!salon.consent_settings?.enabled,
          consentTitle: salon.consent_settings?.title ?? '',
          consentText: salon.consent_settings?.template_text ?? '',
          customQuestions: (salon.custom_questions ?? []).map((q) => ({
            id: q.id ?? randomUUID(),
            label: q.label ?? '',
            type: (q.type ?? 'text') as 'text' | 'yesno' | 'select',
            options: (q.options ?? []).map((o) => ({ value: o.value ?? '' })),
            required: !!q.required,
          })),
          flags: {
            deposit: !!salon.deposit_settings?.enabled && !!salon.stripe_connect_onboarded,
            depositLabel: salon.deposit_settings?.type === 'percent'
              ? `${salon.deposit_settings?.percent_value ?? 0}%`
              : `${(salon.deposit_settings?.fixed_amount_huf ?? 0).toLocaleString('hu-HU')} Ft`,
            voucher: !!salon.voucher_settings?.enabled && !!salon.stripe_connect_onboarded,
            newsletter: hasActivePackage(salon.newsletter_settings?.package),
          },
          staff: staffRes.docs.map((m) => ({
            id: String(m.id),
            name: m.name,
            role_title: m.role_title ?? '',
            bio: m.bio ?? '',
            social_links: (m.social_links ?? []).map((l: { url: string }) => l.url),
          })),
        }
      })()
    : undefined

  const np = salon.notification_prefs ?? {}
  const br = salon.booking_rules ?? {}
  const fm = salon.feature_modules ?? {}

  return (
    <div className="p-5 lg:p-0">
      <SettingsHub
        variant="salon"
        subtitle={subtitle}
        availabilityHref="/dashboard/availability"
        selfProfile={
          <div className="space-y-6">
            <ProfileEditor
              name={user.name}
              email={user.email}
              avatarUrl={(user as { avatar_url?: string | null }).avatar_url ?? null}
              fields={{
                phone: (user as { phone?: string | null }).phone ?? null,
                address: (user as { address?: string | null }).address ?? null,
                birthday: (user as { birthday?: string | null }).birthday ?? null,
                emergency_contact: (user as { emergency_contact?: string | null }).emergency_contact ?? null,
              }}
              roles={businesses.map((b) => ({ type: b.type, name: b.name, roleName: b.roleName, isOwner: b.role === 'owner' }))}
            />
            {myStaff && (
              <DefaultBreakCard staffId={String(myStaff.id)} defaultBreaks={myStaff.default_breaks ?? null} />
            )}
          </div>
        }
        apiBase="/api/salon/settings"
        notificationPrefs={{
          confirm_email: np.confirm_email ?? true,
          cancel_email: np.cancel_email ?? true,
          modification_email: np.modification_email ?? false,
          digest_morning_email: np.digest_morning_email ?? false,
          digest_evening_email: np.digest_evening_email ?? false,
        }}
        bookingRules={{ auto_confirm: br.auto_confirm ?? true, require_address: br.require_address ?? false, require_address_note: br.require_address_note ?? '' }}
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
        }}
        depositSettings={{
          enabled: salon.deposit_settings?.enabled ?? false,
          type: (salon.deposit_settings?.type as 'fixed' | 'percent' | 'per_pax') ?? 'fixed',
          fixedAmountHuf: salon.deposit_settings?.fixed_amount_huf ?? null,
          percentValue: salon.deposit_settings?.percent_value ?? null,
          perPaxAmountHuf: salon.deposit_settings?.per_pax_amount_huf ?? null,
          refundHoursBefore: salon.deposit_settings?.refund_hours_before ?? 24,
        }}
        invoiceSettings={{
          provider: (salon.invoice_settings?.invoice_provider as 'szamlazz' | 'billingo' | 'none') ?? 'none',
          hasSzamlazzKey: !!salon.invoice_settings?.szamlazz_agent_key_enc,
          hasBillingoKey: !!salon.invoice_settings?.billingo_api_key_enc,
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
        rules={rules}
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
        customRoles={rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name }))}
        icalUrl={icalUrl('salon', salon.id)}
        bookingUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${salon.slug}/book`}
        embedUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/${salon.slug}?embed=1`}
        embedSmartSnippet={`<div class="davelopment-embed" data-slug="${salon.slug}"></div>\n<script src="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/embed.js" async></script>`}
        webhookUrl={(salon as unknown as { webhook_url?: string | null }).webhook_url ?? null}
        ga4Id={salon.marketing_tracking?.ga4_measurement_id ?? null}
        facebookPixelId={salon.marketing_tracking?.facebook_pixel_id ?? null}
        rolesSection={
          <RolesManager
            key="roles-panel"
            variant="salon"
            businessId={String(salon.id)}
            initialRoles={rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name, capabilities: r.capabilities ?? null, booking_notify_level: r.booking_notify_level ?? null }))}
            myCapabilities={capabilities}
            isOwner={role === 'owner'}
          />
        }
        profilePanel={<SalonSettingsForm salon={salon} businessCount={businessCount} />}
        bookingPageEditor={bookingPageEditor}
      />
    </div>
  )
}
