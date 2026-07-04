'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Lightbulb, ChevronDown, Search, ChevronsDownUp, ChevronsUpDown, ArrowRight, X, type LucideIcon,
} from 'lucide-react'
import {
  CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair, LayoutDashboard, Printer, Bell,
} from 'lucide-react'

type Variant = 'restaurant' | 'salon'

type Tip = {
  /** Mélylinkhez (#id) és accordion-állapothoz stabil azonosító. */
  id: string
  icon: LucideIcon
  title: string
  body: string
  /** Kattintásra kibomló bővebb magyarázat. */
  details: string
  /** Konkrét, lépésszerű tippek a részletekben. */
  bullets: string[]
  /** A kapcsolódó oldal útvonala — „Ugrás a … oldalra" gombhoz. */
  href: string
  /** A direkt link gomb felirata (pl. „Megnyitom a Foglalásokat"). */
  linkLabel: string
}

const TIPS: Record<Variant, Tip[]> = {
  restaurant: [
    {
      id: 'overview',
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai foglalások, a kihasználtság és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: rögtön belépés után látod, mi vár rád ma, anélkül hogy bárhová kattintanod kellene.',
      bullets: [
        'A felső számkártyák a mai foglalások számát, a várható vendéglétszámot és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg az adott mutatóról.',
        'A „mai foglalások” listából egy kattintással a Foglalások oldalra ugrasz az adott naphoz.',
      ],
      href: '/restaurant',
      linkLabel: 'Megnyitom az Áttekintést',
    },
    {
      id: 'bookings',
      icon: CalendarDays,
      title: 'Foglalások kezelése',
      body: 'A nap vendégeit lista- és idővonal-nézetben látod. Beeső és telefonos foglalást is rögzíthetsz.',
      details: 'A Foglalások oldal a mindennapi munka középpontja. Válts a lista- és az idővonal-nézet között aszerint, hogy gyorsan átnéznéd a napot, vagy az asztalok időbeli elfoglaltságát terveznéd.',
      bullets: [
        'Az idővonal-nézetben a foglalásokat húzással (drag & drop) áthelyezheted másik időpontra vagy asztalra.',
        'Beeső és telefonos foglalást is felvehetsz — akár név nélkül, ha siettek; ilyenkor „Beeső” / „Telefon” alapnév kerül be.',
        'A státuszokkal (megerősítve, leültetve, távozott, lemondva) végigvezeted a vendéget az érkezéstől a távozásig.',
        'A felső dátumváltóval bármelyik napra előre-hátra lépdelhetsz.',
      ],
      href: '/restaurant/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'print',
      icon: Printer,
      title: 'Napi lista nyomtatása',
      body: 'A Foglalások oldal tetején a nyomtató gombbal a kiválasztott nap foglalásait nyomtatható listában nyitod meg.',
      details: 'Ha a pultnál vagy a konyhában papíron is kéznél akarod tartani a nap vendégeit, a nyomtatható lista letisztult, fekete-fehér formátumban adja ki őket.',
      bullets: [
        'A lista a kiválasztott nap foglalásait tartalmazza idő szerint sorrendben.',
        'Minden sorban ott a vendég neve, létszáma, ideje és a megjegyzés.',
        'A böngésző nyomtatási párbeszédéből PDF-be is mentheted.',
      ],
      href: '/restaurant/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'tables',
      icon: Armchair,
      title: 'Asztalok és kapacitás',
      body: 'Vedd fel az asztalaidat vagy adj meg egyszerű férőhely-számot. A rendszer ez alapján kezeli a kapacitást.',
      details: 'A kapacitás dönti el, hány vendég foglalhat online egy adott sávra. Kétféleképp állíthatod be — aszerint, mennyire szeretnéd részletesen kezelni az asztalaidat.',
      bullets: [
        'Egyszerű mód: csak egy összesített férőhely-számot adsz meg, a rendszer ez alapján számol.',
        'Asztalos mód: felveszed a konkrét asztalokat férőhellyel, így a foglalások asztalhoz rendelhetők.',
        'Nagyobb társasághoz több asztalt összevonhatsz, hogy elférjenek.',
        'Szezonális/időszakos asztalokat is felvehetsz, ha pl. teraszod csak nyáron üzemel.',
      ],
      href: '/restaurant/tables',
      linkLabel: 'Megnyitom az Asztalokat',
    },
    {
      id: 'availability',
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás csak a beállított nyitvatartáson belül lehetséges. Itt állítod be a napi sávokat és az ülésidőt.',
      details: 'A nyitvatartás határozza meg, mikor és milyen sűrűn vehetők fel online foglalások. Az ülésidő (mennyi ideig ül egy asztal) befolyásolja, hányszor fordulhat egy asztal egy este.',
      bullets: [
        'Naponként külön sávokat állíthatsz be (pl. ebéd és vacsora külön).',
        'Az ülésidővel szabályozod, mennyi időre foglal le egy vendég egy asztalt.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárva tartásra a szokásos nyitvatartás felülírásával.',
      ],
      href: '/restaurant/availability',
      linkLabel: 'Megnyitom a Nyitvatartást',
    },
    {
      id: 'analytics',
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a kihasználtságot, a lemondásokat és a beesők arányát.',
      details: 'A számok megmutatják, mely napok és sávok a legerősebbek, és hol van tartalék. Jó alap a nyitvatartás vagy a kapacitás finomhangolásához.',
      bullets: [
        'Kihasználtság, lemondási arány és a beesők aránya egy helyen.',
        'Az átlagos ülésidő (dwell) statisztika segít a kapacitástervezésben.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
      href: '/restaurant/analytics',
      linkLabel: 'Megnyitom a Statisztikákat',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Értesítések',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem, akkor sem, ha épp nem a foglalási oldalt nézed.',
      bullets: [
        'A fejléc harang ikonján piros jelzés mutatja az olvasatlanokat.',
        'E-mail értesítést is kérhetsz az új foglalásokról.',
        'A Beállításokban szabályozhatod, miről és hogyan kérsz értesítést.',
      ],
      href: '/restaurant/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'settings',
      icon: Settings,
      title: 'Beállítások',
      body: 'Itt szabod testre az éttermed adatait, az értesítéseket és a foglalási szabályokat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig minden innen állítható.',
      bullets: [
        'Étterem adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási szabályok: meddig előre, hány főig, kell-e telefonszám.',
        'Cég- és jogi adatok, valamint a foglalási feltételek a vendégeknek.',
        'A márkázott visszaigazoló e-mailek megjelenése.',
      ],
      href: '/restaurant/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
  ],
  salon: [
    {
      id: 'overview',
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai időpontok, a bevétel és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: belépés után rögtön látod a mai időpontokat és a legfontosabb mutatókat.',
      bullets: [
        'A felső számkártyák a mai időpontok számát, a várható bevételt és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg.',
        'A mai időpontok listájából egy kattintással a foglalások részleteihez jutsz.',
      ],
      href: '/dashboard',
      linkLabel: 'Megnyitom az Áttekintést',
    },
    {
      id: 'bookings',
      icon: CalendarDays,
      title: 'Időpontok kezelése',
      body: 'A foglalásokat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz.',
      details: 'A foglalások oldalon tartod kézben a napod. Válts naptár- és listanézet között aszerint, hogy az időbeosztást terveznéd, vagy gyorsan átnéznéd a vendégeket.',
      bullets: [
        'Az online foglalások automatikusan megjelennek, amint a vendég lefoglal.',
        'Új időpontot kézzel is felvehetsz telefonos vagy beeső vendéghez.',
        'A naptárnézetben jól látod a szabad réseket és a munkatársak beosztását.',
      ],
      href: '/dashboard/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'services',
      icon: Briefcase,
      title: 'Szolgáltatások',
      body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.',
      details: 'A szolgáltatások a foglalási oldalad gerince: a vendég ezek közül választ, és az időtartam alapján számolódik a szabad időpont.',
      bullets: [
        'Adj meg minden szolgáltatáshoz árat és időtartamot — utóbbi pontos időpontkiosztást ad.',
        'Csoportosíthatod a szolgáltatásokat kategóriákba az átláthatóságért.',
        'A pontos időtartam segít elkerülni a túl szoros vagy túl laza beosztást.',
      ],
      href: '/dashboard/services',
      linkLabel: 'Megnyitom a Szolgáltatásokat',
    },
    {
      id: 'staff',
      icon: Users,
      title: 'Munkatársak',
      body: 'Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat, hogy foglaláskor választhatók legyenek.',
      details: 'Ha többen dolgoztok, a munkatársakhoz rendelt szolgáltatások alapján a vendég kiválaszthatja, kihez szeretne menni.',
      bullets: [
        'Minden munkatárshoz hozzárendeled, mely szolgáltatásokat végzi.',
        'A foglalási oldalon a vendég választhat munkatársat, vagy rábízhatja a szalonra.',
        'A beosztás és az elérhetőség munkatársanként külön kezelhető.',
      ],
      href: '/dashboard/staff',
      linkLabel: 'Megnyitom a Munkatársakat',
    },
    {
      id: 'availability',
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás a beállított nyitvatartáson és a munkatársak elérhetőségén belül lehetséges.',
      details: 'A nyitvatartás és a munkatársak elérhetősége együtt határozza meg, milyen időpontok foglalhatók online.',
      bullets: [
        'Naponként külön sávokat állíthatsz be.',
        'A munkatársak egyéni elérhetősége tovább szűri a foglalható időpontokat.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárásra.',
      ],
      href: '/dashboard/availability',
      linkLabel: 'Megnyitom a Nyitvatartást',
    },
    {
      id: 'analytics',
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a bevételt és a kihasználtságot, és bármikor exportálhatsz CSV-be.',
      details: 'A számokból kiderül, mely szolgáltatások és munkatársak a legkeresettebbek, és hol van szabad kapacitás.',
      bullets: [
        'Bevétel és kihasználtság egy helyen, időszakra bontva.',
        'Lemondási arány és a legnépszerűbb szolgáltatások.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
      href: '/dashboard/analytics',
      linkLabel: 'Megnyitom a Statisztikákat',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Értesítések',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem.',
      bullets: [
        'A fejléc harang ikonján piros jelzés mutatja az olvasatlanokat.',
        'E-mail értesítést is kérhetsz az új foglalásokról.',
        'A Beállításokban szabályozhatod, miről és hogyan kérsz értesítést.',
      ],
      href: '/dashboard/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'settings',
      icon: Settings,
      title: 'Beállítások',
      body: 'Itt szabod testre a szalonod adatait, az értesítéseket és a foglalási szabályokat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig minden innen állítható.',
      bullets: [
        'Szalon adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási szabályok: meddig előre, kell-e telefonszám.',
        'Cég- és jogi adatok, valamint a foglalási feltételek a vendégeknek.',
        'A márkázott visszaigazoló e-mailek megjelenése.',
      ],
      href: '/dashboard/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
  ],
}

/** Ékezet-érzéketlen, kisbetűs normalizálás a kereséshez. */
function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Crextio-nyílás easing. */
const EASE = [0.22, 1, 0.36, 1] as const

export function TipsContent({ variant }: { variant: Variant }) {
  const tips = TIPS[variant]
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setOpenIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Szűrt lista: cím + body + details + bulletek között, ékezet-érzéketlenül.
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return tips
    return tips.filter((t) => {
      const hay = normalize([t.title, t.body, t.details, ...t.bullets].join(' '))
      return hay.includes(q)
    })
  }, [tips, query])

  const allOpen = filtered.length > 0 && filtered.every((t) => openIds.has(t.id))

  function toggleAll() {
    setOpenIds(allOpen ? new Set() : new Set(filtered.map((t) => t.id)))
  }

  // Mélylink: a #id-ra mutató URL-nél nyisd meg és görgess az adott kártyához.
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id || !tips.some((t) => t.id === id)) return
    setOpenIds((cur) => new Set(cur).add(id))
    // A render után görgessünk oda (kis késleltetés a layout miatt).
    const t = setTimeout(() => {
      document.getElementById(`tip-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(t)
  }, [tips])

  function restartTour() {
    window.dispatchEvent(new Event('schedulio:open-onboarding'))
  }

  return (
    <div className="space-y-6 p-5 lg:p-0 font-onest">
      {/* ── HERO fejléc — davelopment cream kártya ── */}
      <div className="rounded-[26px] bg-white p-6 shadow-dav-card lg:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gold text-ink-dark">
              <Lightbulb className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <div>
              <h1 className="text-2xl font-light tracking-[-0.02em] text-ink lg:text-[32px] lg:leading-[1.1]">
                Tippek és trükkök
              </h1>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-soft">
                Minden, amit a rendszerről tudni érdemes — egy helyen. Kattints egy sorra a részletekért, vagy indítsd újra a vezetett bemutatót.
              </p>
            </div>
          </div>
          <button
            onClick={restartTour}
            className="flex shrink-0 items-center justify-center gap-2 self-start rounded-[18px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] sm:self-auto"
          >
            <Lightbulb className="h-4 w-4" strokeWidth={1.8} />
            Bevezető újraindítása
          </button>
        </div>
      </div>

      {/* ── Eszköztár: kereső + „összes kinyitása/bezárása" ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.8} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés a tippek között…"
            className="h-12 w-full rounded-[18px] border border-line bg-white pl-11 pr-11 text-sm text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-gold/40 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Keresés törlése"
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={filtered.length === 0}
          className="flex shrink-0 items-center justify-center gap-2 rounded-[18px] border border-line bg-white px-5 py-3 text-[13px] font-semibold text-ink-soft2 transition-all hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {allOpen ? <ChevronsDownUp className="h-4 w-4" strokeWidth={1.8} /> : <ChevronsUpDown className="h-4 w-4" strokeWidth={1.8} />}
          {allOpen ? 'Összes bezárása' : 'Összes kinyitása'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-line-strong bg-white py-14 text-center shadow-dav-card">
          <Search className="mx-auto h-6 w-6 text-ink-soft" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            Nincs találat a(z) „{query}” keresésre.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-2 text-sm font-semibold text-ink transition-opacity hover:opacity-70"
          >
            Keresés törlése
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {filtered.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              open={openIds.has(tip.id)}
              onToggle={() => toggle(tip.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Egy tipp-kártya: davelopment cream kártya, Crextio-akkordeon (label + ChevronDown,
 * solid #efebdf divider, framer-motion nyílás). A fejléc külön button; a kibomló
 * részben link (<a>) is van, ezért a kártya div (nem button).
 */
function TipCard({ tip, open, onToggle }: { tip: Tip; open: boolean; onToggle: () => void }) {
  const { id, icon: Icon, title, body, details, bullets, href, linkLabel } = tip

  return (
    <div
      id={`tip-${id}`}
      className="scroll-mt-24 rounded-[22px] bg-white p-5 shadow-dav-card transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,.04),0_18px_40px_-28px_rgba(80,70,30,.28)]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`tip-panel-${id}`}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#fcfbf7] text-ink-soft2 ring-1 ring-line transition-colors">
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <h2 className="flex-1 text-[16px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{body}</p>

      {/* Kibomló részletek — Crextio framer-motion nyílás, solid divider */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`tip-panel-${id}`}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-[#efebdf] pt-4">
              <p className="text-[13px] leading-relaxed text-ink-soft2">{details}</p>
              <ul className="mt-3 space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                className="group mt-4 inline-flex items-center gap-1.5 rounded-[16px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {linkLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
