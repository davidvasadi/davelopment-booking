#!/usr/bin/env node
/**
 * UI-egységesség ellenőrzés: a közös UI-készletben és az átállított felületeken nem lehet kézzel írt
 * szín, betűméret, lekerekítés, árnyék vagy régi `dav`-os osztály — csak a `ui-*` skála.
 * Szándékos kivétel (pl. paletta-adat) sorvégi `// ui-allow` megjegyzéssel.
 *
 * Futtatás: npm run check:ui   (hiba esetén 1-es kilépési kóddal áll meg)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
// Az átállított (egységes) területek — az élő oldalak átállításakor ide kerülnek fel.
// az átállított élő részek is ide kerülnek (amit egyszer átállítottunk, abba ne kerülhessen vissza régi kód)
const TARGETS = ['src/components/ui-kit', 'src/components/blocks', 'src/app/(app)/design', 'src/components/ui', 'src/components/shared/FormSheet.tsx', 'src/components/dashboard/AppShell.tsx', 'src/components/dashboard/AppNavbar.tsx', 'src/components/dashboard/UserMenu.tsx', 'src/components/dashboard/MobileBottomNav.tsx', 'src/components/dashboard/DashboardNav.tsx', 'src/components/dashboard/ApprovalActions.tsx', 'src/components/dashboard/SubscriptionBanner.tsx', 'src/components/dashboard/DashboardLockModal.tsx', 'src/components/onboarding/OnboardingTour.tsx', 'src/components/dashboard/DigestSheet.tsx', 'src/components/dashboard/DigestAutoPopup.tsx', 'src/components/dashboard/BroadcastAutoPopup.tsx', 'src/components/dashboard/BroadcastSheet.tsx', 'src/components/dashboard/CommandPalette.tsx', 'src/app/(app)/dashboard/page.tsx', 'src/app/(app)/restaurant/page.tsx', 'src/components/dashboard/OverviewLayout.tsx', 'src/components/dashboard/SetupNudge.tsx', 'src/components/shared/OverviewTimeline.tsx', 'src/components/shared/OverviewTasksPanel.tsx', 'src/components/shared/OverviewPanels.tsx', 'src/components/shared/DetailSheet.tsx', 'src/components/shared/OverviewInbox.tsx', 'src/components/shared/BookingsHead.tsx', 'src/components/shared/BookingsDateNav.tsx', 'src/components/shared/DatePickerPopover.tsx', 'src/components/shared/ResourceGrid.tsx', 'src/components/shared/BookingList.tsx', 'src/components/shared/BookingsMoreMenu.tsx', 'src/components/shared/BookingDrawerBody.tsx', 'src/components/dashboard/BookingEditSheet.tsx', 'src/components/restaurant/ReservationEditSheet.tsx', 'src/components/dashboard/WaitlistPanel.tsx', 'src/components/shared/GuestLookup.tsx', 'src/components/shared/EmailStatusBadge.tsx', 'src/components/shared/CalendarMonthGrid.tsx', 'src/components/dashboard/SalonOfflineBanner.tsx', 'src/components/restaurant/OfflineBanner.tsx', 'src/components/shared/OccasionBadge.tsx', 'src/components/shared/OfflineDraftsBar.tsx', 'src/components/shared/RangeGrids.tsx', 'src/components/shared/BookingDrawer.tsx', 'src/components/shared/BookingSummary.tsx', 'src/components/shared/BookingsDateNav.tsx', 'src/components/blocks/day-timeline.tsx', 'src/components/dashboard/SalonDailyView.tsx', 'src/components/restaurant/DailyView.tsx', 'src/components/dashboard/SalonScheduleView.tsx', 'src/components/restaurant/RestaurantScheduleView.tsx', 'src/components/dashboard/SalonOfflineBanner.tsx', 'src/components/restaurant/OfflineBanner.tsx', 'src/app/(app)/dashboard/bookings', 'src/app/(app)/restaurant/bookings', 'src/components/dashboard/CalendarView.tsx', 'src/components/dashboard/ShiftEditor.tsx', 'src/app/(app)/dashboard/schedule', 'src/app/(app)/restaurant/schedule', 'src/components/shared/CalendarSkeleton.tsx', 'src/components/dashboard/ShiftDayGrid.tsx', 'src/components/dashboard/GuestsView.tsx', 'src/components/shared/GuestsSkeleton.tsx', 'src/components/shared/ExportDialog.tsx', 'src/components/dashboard/ServicesView.tsx', 'src/components/restaurant/TablesView.tsx', 'src/app/(app)/restaurant/tables', 'src/app/(app)/dashboard/services', 'src/app/(app)/dashboard/guests', 'src/app/(app)/restaurant/guests', 'src/components/dashboard/TeamView.tsx', 'src/app/(app)/dashboard/staff', 'src/app/(app)/restaurant/staff', 'src/components/dashboard/StatsView.tsx', 'src/app/(app)/dashboard/analytics', 'src/app/(app)/restaurant/analytics', 'src/components/dashboard/VouchersView.tsx', 'src/app/(app)/dashboard/vouchers', 'src/app/(app)/restaurant/vouchers', 'src/components/dashboard/MarketingView.tsx', 'src/app/(app)/dashboard/marketing', 'src/app/(app)/restaurant/marketing', 'src/components/dashboard/TipsView.tsx', 'src/app/(app)/dashboard/tips', 'src/app/(app)/restaurant/tips', 'src/components/dashboard/HelpView.tsx', 'src/app/(app)/dashboard/help', 'src/app/(app)/restaurant/help']
// A paletta-dokumentáció adatai: itt maga a színkód a tartalom.
const SKIP_FILES = ['src/app/(app)/design/shared.tsx']

const RULES = [
  { name: 'kézi szín', re: /#[0-9A-Fa-f]{6}\b/ },
  { name: 'kézi betűméret', re: /\btext-\[\d+(?:\.\d+)?px\]/ },
  { name: 'kézi lekerekítés', re: /\brounded(?:-[tblr]{1,2})?-\[\d+(?:\.\d+)?px\]/ },
  { name: 'kézi árnyék', re: /\bshadow-\[/ },
  // árnyék csak lebegő elemen és popupon: shadow-ui-float / shadow-ui-popup
  { name: 'nem engedett árnyék (csak shadow-ui-float / shadow-ui-popup)', re: /(?<![\w-])shadow(?:-(?!ui-float\b|ui-popup\b|none\b)[a-z][\w-]*)?(?=[\s"'`]|$)/ },
  { name: 'kézi betűköz', re: /\btracking-\[/ },
  { name: 'régi dav-osztály', re: /\b(?:text-ink(?:-soft2?|-dark)?|bg-ink-dark|border-line(?:-strong)?|bg-gold|text-gold|dav-card-glass)\b/ },
  { name: 'Tailwind alap-szín (használd a ui-* színeket)', re: /\b(?:bg|text|border|ring|divide|from|to|fill|stroke)-(?:amber|red|zinc|emerald|orange|green|gray|slate|stone|neutral|yellow|blue|rose|lime|teal|sky|indigo|violet|purple|pink)-\d{2,3}\b/ },
  { name: 'Tailwind alap-betűméret (használd a text-ui-* skálát)', re: /(?<![\w-])text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/ },
  { name: 'tiltott betűsúly', re: /\bfont-(?:semibold|bold|extrabold|black)\b/ },
  { name: 'kézi kártya (használd a <Card>-ot)', re: /\$\{CARD(?:_DARK)?\}/ },
  { name: 'kézi csík (ui-hatch / ui-hatch-cell osztály)', re: /\bHATCH(?:_CELL|_BORDER)?\b/ },
  // grafikon (SVG stroke / fill / stopColor) kivétel: ott a CSS-változó a helyes
  { name: 'nyers CSS-változó (ui-* osztály kell)', re: /(?<!(?:stroke|fill|stopColor)=\{?["'])var\(--ui-/ },
  { name: 'kézi átlátszó szín', re: /rgba\(/ },
  { name: 'kézi ikon-gomb (IconButton)', re: /<span className="flex h-(?:9|10|11) w-(?:9|10|11) [^"]*rounded-full[^"]*"><[A-Z]\w* className="h-4 w-4"/ },
  { name: 'kézi mező / megjegyzés (Input / Select / Note / FieldRow boxed)', re: /className=["{`][^"`]*\brounded-ui-control bg-ui-cell\b[^"`]*\b(?:px-|p-3)/, notIn: 'src/components/ui-kit' },
  { name: 'kézi popup-szélesség (Panel / Modal size="sm|md|lg")', re: /<(?:Panel|Modal)\b[^>]*\bmax-w-\[/ },
  { name: 'régi HeroKpi (Kpi kell)', re: /<HeroKpi\b/ },
  { name: 'régi StatusPills (SegmentBar kell)', re: /<StatusPills\b/ },
  { name: 'kézi avatar-kép (Avatar kell)', re: /<img\b[^>]*rounded-full object-cover object-top/, notIn: 'src/components/ui-kit' },
  { name: 'kézi táblázat (Table / Th / Tr / Td)', re: /<(?:table|th|td)\b/, notIn: 'src/components/ui-kit' },
  { name: 'inline szín (osztály kell)', re: /style=\{.*\b(?:background|color|border|boxShadow|textShadow)\s*:/ },
]

// Kézzel rakott pill / gomb: kerek, fix magasságú vagy kis paddingos, saját betűmérettel → Pill / Button / StatusPill.
const CLASS_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g
function handMadePill(cls) {
  if (!/\brounded-full\b/.test(cls) || !/\bpx-/.test(cls) || !/\btext-ui-(?:label|meta|body)\b/.test(cls)) return false
  return /\bh-(?:7|8|9|10|11|12)\b/.test(cls) || /\bpy-(?:0\.5|1|1\.5|2)\b/.test(cls)
}
// Teljes szélességű kézi gomb (px nélkül): kerek, színes háttér, félkövér felirat → Button.
function handMadeButton(cls) {
  return /\brounded-full\b/.test(cls) && /\bbg-ui-(?:dark|yellow|cell)\b/.test(cls) && /\bfont-medium\b/.test(cls) && /\bh-(?:9|10|11|12)\b/.test(cls)
}

// Kézi kerek jelvény / ikon-kör: kerek, középre igazított, négyzetes fix méret → IconCircle (jelvény) / IconButton (kattintható).
function handMadeCircle(cls) {
  return /\brounded-full\b/.test(cls) && /\bjustify-center\b/.test(cls) && /\bh-(4|5|6|7|8|9|10|11|12) w-\1\b/.test(cls)
}

function walk(dir) {
  if (statSync(dir).isFile()) return [dir] // egy-egy átállított fájl is lehet cél
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

let problems = 0
for (const t of TARGETS) {
  for (const file of walk(join(ROOT, t))) {
    const rel = relative(ROOT, file)
    if (SKIP_FILES.includes(rel)) continue
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('ui-allow')) return
      for (const m of line.matchAll(CLASS_RE)) {
        if (handMadePill(m[1] ?? m[2]) || handMadeButton(m[1] ?? m[2])) {
          problems++
          console.log(`${rel}:${i + 1}  kézi pill/gomb (Pill / Button / StatusPill): ${(m[1] ?? m[2]).slice(0, 70)}`)
        }
        if (!rel.startsWith('src/components/ui-kit') && handMadeCircle(m[1] ?? m[2])) {
          problems++
          console.log(`${rel}:${i + 1}  kézi kerek jelvény (IconCircle / IconButton): ${(m[1] ?? m[2]).slice(0, 70)}`)
        }
      }
      for (const r of RULES) {
        if (r.notIn && rel.startsWith(r.notIn)) continue
        const m = line.match(r.re)
        if (m) {
          problems++
          console.log(`${rel}:${i + 1}  ${r.name}: ${m[0]}`)
        }
      }
    })
  }
}

if (problems) {
  console.log(`\n${problems} eltérés a UI-készlettől. Használd a ui-* skálát (tailwind.config) vagy a src/components/ui-kit elemeit.`)
  process.exit(1)
}
console.log('UI-ellenőrzés rendben: nincs kézzel írt szín, méret, lekerekítés vagy árnyék.')
