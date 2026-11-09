'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import { TicketCheck, WifiOff, ChevronLeft, Settings2, Plus, Download, Building2, UserRound, Sparkles, Search, Settings, type LucideIcon } from 'lucide-react'
import { IconButton, IconCircle } from '@/components/ui-kit'
import { getNavConfig, navItemsForCapabilities, type DashboardVariant } from './navConfig'
import { can, type Capability } from '@/lib/permissions'
import { UserMenu } from './UserMenu'
import { CommandPalette } from './CommandPalette'
import type { SwitcherBusiness } from './switcherTypes'
import { useOnline } from '@/lib/useOnline'

/** Globális offline-jelző a mobil fejlécben — ha elment a net (figyelmeztetés-szín, 48px kör, mint a többi fejléc-gomb). */
function OfflineIndicator() {
  const online = useOnline()
  if (online) return null
  return (
    <span title="Nincs internetkapcsolat — vázlat módban dolgozol"><IconCircle icon={WifiOff} tone="warn" size="lg" /></span>
  )
}


type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

export function DashboardNav({
  salonName,
  salonSlug,
  subscription,
  variant = 'salon',
  capabilities = [],
  brandLogoUrl = null,
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
  businesses = [],
  activeBusinessKey = null,
  hiddenHrefs = [],
}: {
  salonName: string
  salonSlug: string
  subscription?: SubInfo
  variant?: DashboardVariant
  capabilities?: Capability[]
  /** Az üzlet logója a fejléc store-switcher blokkjához. */
  brandLogoUrl?: string | null
  /** A bejelentkezett felhasználó adatai a sidebar alján lévő fiók-blokkhoz. */
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
  /** Több-üzlet: a felhasználó összes üzlete a store-switcherhez. */
  businesses?: SwitcherBusiness[]
  /** Az aktív üzlet "<type>:<id>" kulcsa. */
  activeBusinessKey?: string | null
  /** Nav-hrefek, amiket egy kikapcsolt funkció miatt el kell rejteni (pl. utalványok). */
  hiddenHrefs?: string[]
}) {
  const { settingsHref, subscriptionHref, notificationsHref } = getNavConfig(variant)
  const navItems = navItemsForCapabilities(variant, capabilities, hiddenHrefs)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  // offline: az offline-jelző kör is a fejlécbe kerül — hogy kiférjen, addig az export (letöltés) ikon eltűnik
  // (net nélkül úgysem működne)
  const online = useOnline()

  // Mobilon a body háttere is krém legyen, hogy a notch + bottom safe area ne fehér legyen.
  useEffect(() => {
    document.body.style.backgroundColor = 'var(--ui-cell)' // ui-allow: a body háttere JS-ből (a notch / alsó biztonsági sáv is krém)
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  // A vissza-gomb az ELŐZŐ oldalra visz (böngésző-history).
  const goBack = () => router.back()
  // fő oldalon (a menü egy eleme) balra a logó, mint a designban (/design 2.12); aloldalon a vissza-gomb
  const isTopLevel = navItems.some((it) => it.href === pathname)

  // Backstage (admin): nincs üzlet/előfizetés/nyilvános oldal/store-switcher — ezeket
  // elrejtjük, a fejlécben admin-email + „Backstage" badge van. A nav-elemek, a kereső,
  // a fiók-blokk és a teljes layout viszont UGYANAZ mint a szalon/étterem dashboardon.
  const isBackstage = variant === 'backstage'


  // a mobil fejléc oldal-eszközei — ugyanazok az események / linkek, mint eddig, csak egy listában
  type Tool = { icon: LucideIcon; label: string; onClick?: () => void; href?: string; download?: boolean; dark?: boolean; yellow?: boolean }
  const fire = (ev: string) => () => window.dispatchEvent(new Event(ev))
  const pageTools: Tool[] = []
  const at = (sfx: string) => pathname.endsWith(sfx)
  if (pathname.startsWith(settingsHref)) pageTools.push({ icon: Search, label: 'Beállítás keresése', onClick: fire('davelopment:open-settings-search') }, { icon: Settings2, label: 'Beállítások menü', onClick: fire('davelopment:open-settings-nav') })
  if (pathname.startsWith(notificationsHref)) pageTools.push({ icon: Settings2, label: 'Szűrők', onClick: fire('davelopment:open-notifications-filter') }, { icon: Settings, label: 'Értesítési beállítások', onClick: fire('davelopment:open-notifications-tabs') })
  if (at('/tips')) pageTools.push({ icon: Settings2, label: 'Kategória szűrő', onClick: fire('davelopment:open-tips-filter') })
  if (at('/guests')) pageTools.push({ icon: Download, label: 'Export', onClick: fire('davelopment:open-guests-export') })
  if (at('/schedule')) pageTools.push(
    { icon: Settings2, label: 'Szűrők', onClick: fire('davelopment:open-schedule-filter') },
    { icon: Search, label: 'Munkatárs keresése', onClick: fire('davelopment:open-schedule-search') },
    { icon: Plus, label: 'Beosztás', onClick: fire('davelopment:open-schedule-add'), dark: true },
  )
  // Áttekintés: „Új foglalás” — átvisz a Foglalásokra és rögtön megnyitja az új-foglalás panelt (`?new=1`)
  if (pathname === '/dashboard' || pathname === '/restaurant') pageTools.push({ icon: Plus, label: 'Új foglalás', href: `${pathname}/bookings?new=1`, dark: true })
  if (at('/help')) pageTools.push({ icon: Sparkles, label: 'Bevezető indítása', onClick: fire('davelopment:open-onboarding'), dark: true, yellow: true })
  if (at('/bookings')) pageTools.push(
    { icon: Settings2, label: 'Nézet és szűrők', onClick: fire('davelopment:open-bookings-view') },
    { icon: Search, label: 'Keresés (vendég, telefon)', onClick: fire('davelopment:open-bookings-search') },
    { icon: Download, label: 'Foglalások letöltése (CSV)', onClick: fire('davelopment:export-bookings-day') },
    { icon: Plus, label: 'Új foglalás', onClick: fire('davelopment:open-bookings-create'), dark: true },
  )
  if (at('/analytics')) {
    // szalonnál, analytics.view joggal: Üzlet ↔ Saját munka váltó
    if (at('/dashboard/analytics') && can(capabilities, 'analytics.view')) {
      const scope = searchParams.get('scope') === 'own' ? 'own' : 'business'
      const from = searchParams.get('from'), to = searchParams.get('to')
      const rangeQuery = from && to ? `from=${from}&to=${to}` : `period=${searchParams.get('period') ?? '30'}`
      const nextHref = `${pathname}?${rangeQuery}&scope=${scope === 'business' ? 'own' : 'business'}`
      pageTools.push({ icon: scope === 'business' ? Building2 : UserRound, label: scope === 'business' ? 'Váltás saját munkára' : 'Váltás üzleti nézetre', onClick: () => router.push(nextHref) })
    }
    pageTools.push(
      // mobil: az időszak (7 nap / 30 nap / Negyedév / Év / Egyedi) a szűrő-ikonról nyíló lapon — mint a többi oldal szűrője
      { icon: Settings2, label: 'Időszak', onClick: fire('davelopment:open-analytics-daterange') },
      { icon: Download, label: 'CSV export', onClick: fire('davelopment:open-analytics-csv') },
    )
  }
  // Szolgáltatások (design 8.5): a szűrő-ikon a kategória-lapot nyitja, a „+” az új szolgáltatást
  if (at('/services')) pageTools.push({ icon: Settings2, label: 'Szűrés kategóriára', onClick: fire('davelopment:open-services-filter') })
  // Asztalok (design 9.5): új asztal a fejléc „+” gombjával
  if (at('/services') && can(capabilities, 'catalog.manage')) pageTools.push({ icon: Plus, label: 'Új szolgáltatás', onClick: fire('davelopment:open-services-add'), dark: true })
  // Munkatársak (design 10.5): a fejléc „+” gombja a meghívót nyitja
  if (at('/staff')) pageTools.push({ icon: Search, label: 'Munkatárs keresése', onClick: fire('davelopment:open-staff-search') })
  // Súgó: mobilon a kereső a fejléc nagyítójáról nyílik (mint a Munkatársaknál)
  if (at('/help')) pageTools.push({ icon: Search, label: 'Keresés a súgóban', onClick: fire('davelopment:open-help-search') })
  if (at('/staff') && can(capabilities, 'staff.manage')) pageTools.push({ icon: Plus, label: 'Munkatárs meghívása', onClick: fire('davelopment:open-staff-add'), dark: true })
  // Utalványok (design 12.8): a szűrő-ikon az állapot / fizetési mód lapját nyitja, mellette a beváltás (QR), a „+” az új utalvány
  if (at('/vouchers')) pageTools.push({ icon: Settings2, label: 'Szűrés', onClick: fire('davelopment:open-vouchers-filter') })
  if (at('/vouchers') && can(capabilities, 'vouchers.manage')) pageTools.push(
    { icon: TicketCheck, label: 'Utalvány beváltása', onClick: fire('davelopment:open-vouchers-redeem') },
    { icon: Plus, label: 'Új utalvány', onClick: fire('davelopment:open-vouchers-create'), dark: true },
  )
  // Marketing (design 13.7): a szűrő-ikon a kampányok szűrő-lapját nyitja, a „+” az új kampányt
  if (at('/marketing')) pageTools.push({ icon: Settings2, label: 'Szűrés', onClick: fire('davelopment:open-marketing-filter') })
  if (at('/marketing') && can(capabilities, 'marketing.manage')) pageTools.push({ icon: Plus, label: 'Új kampány', onClick: fire('davelopment:open-marketing-composer'), dark: true })

  return (
    <>
      {/* ── MOBILE TOP BAR — vissza + cím + „…" menü ───────────── */}
      {/* Crextio-stílus: NINCS tömör sáv/határvonal — a fejléc a krém gradiensen ül, a
          gombok lebegő fehér KÖRÖK (üveg + lágy árnyék + blur), mint a referencia „←" ikon.
          A cím középen marad (kompakt sáv-elrendezés). */}
      <header className="lg:hidden print:hidden relative z-40 px-3 h-16 flex items-center justify-between gap-2 shrink-0">
        {isTopLevel ? (
          <Link href={navItems[0]?.href ?? '/'} aria-label="davelopment booking" className="flex shrink-0 items-center px-1">
            <BrandLogo variant="light" className="h-6" />
          </Link>
        ) : (
          <IconButton icon={ChevronLeft} label="Vissza" size="lg" onClick={goBack} />
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 shrink-0">
          <OfflineIndicator />
          {/* Al-navigáció portál-célpontja — a Beállítások egyes füleinek saját fejléc-kontrollja
              (Foglalóoldal → nyelv-választó, Vendég e-mailek → sablon-választó, Csapat →
              Tagok/Szerepek váltó + meghívás) ide portálozódik be, egységesen a többi oldal
              felső fejléc-ikonjaival (üres marad minden más fülön, mert csak az adott fül
              komponense rendereli bele, amikor mountolva van). */}
          {pathname.startsWith(settingsHref) && <div id="settings-subnav-slot" className="relative flex shrink-0 items-center gap-2" />}
          {/* az oldal saját eszközei (a design szerint: 48px kerek gombok; a fő „+” sötét) — oldalanként egy lista */}
          {pageTools.filter((t) => online || t.icon !== Download).map((t) => <IconButton key={t.label} icon={t.icon} label={t.label} size="lg" variant={t.dark ? 'dark' : 'glass'} href={t.href} download={t.download} onClick={t.onClick} className={t.yellow ? 'text-ui-yellow' : undefined} />)}
          {/* Értesítés + fiók — a mobil fejléc JOBB felső sarkában, desktop-szerű popoverrel
              (csengő = értesítések, avatar = fiók-menü → üzletváltó + Saját profil). */}
          {!isBackstage && (
            <UserMenu
              // a Foglalások és a Naptár fejlécében az eszközöknek (kereső, export) kell a hely — ott a fiók-avatar nem látszik
              hideAvatar={at('/bookings') || at('/schedule')}
              showPartner={!hiddenHrefs.some((h) => h.endsWith('/partnerprogram'))}
              name={userName}
              email={userEmail}
              avatarUrl={userAvatarUrl}
              subscriptionHref={subscriptionHref}
              settingsHref={settingsHref}
              publicUrl={`/${salonSlug}`}
              capabilities={capabilities}
              notificationsHref={notificationsHref}
              businesses={businesses}
              activeBusinessKey={activeBusinessKey}
            />
          )}
        </div>
      </header>

      {/* A ⌘K kereső-palette — desktopon a sidebar keresője, mobilon a header ikonja nyitja. */}
      <CommandPalette variant={variant} />
    </>
  )
}
