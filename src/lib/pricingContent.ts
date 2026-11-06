import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { businessMonthlyFee, monthlyEmailCapForTier, SALON_INCLUDED_STAFF } from '@/lib/tier'
import { FEATURE_GROUPS } from '@/lib/landingFeatures'

/**
 * AZ ÁRAZÁS TARTALMÁNAK EGYETLEN FORRÁSA. Innen dolgozik a főoldali árkártya (`Pricing.tsx`), az
 * /arak oldal (kártyák, kalkulátor, összehasonlító táblázat, GYIK), az árazási strukturált adat
 * (`publicSeo.ts`), a főoldali GYIK ár-válasza (`faqContent.ts`) és az `llms.txt`. A SZÁMOK
 * kizárólag a backstage `pricing-settings` globalból jönnek (`LandingPricing`) — itt csak a
 * szöveg és a csomag-koncepció él. Ha a koncepció változik, ITT kell átírni, és mindenhol változik.
 *
 * Koncepció (a kód szerint, lásd `src/lib/tier.ts`): a Starter és a Pro FUNKCIÓBAN AZONOS —
 * csak az ár és a beépített havi hírlevél-keret tér el. Szakembernél a díj = alapdíj +
 * (munkatársak − 1) × extra-fő ár; étteremnél fix. Az Egyedi egyeztetett árú, egyedi igényekre.
 * Egy fiókban több üzlet is lehet, a díjuk egy összevont számlán jön.
 */

export type Segment = 'salon' | 'restaurant'
export type PlanId = 'starter' | 'pro' | 'egyedi'

export const PLAN_META: Record<PlanId, { title: string; badge: string; dot: string; sub: Record<Segment, string> }> = {
  starter: { title: 'Starter', badge: 'Belépő', dot: '#A8A496', sub: { salon: 'Induláshoz, kisebb vendégkörrel', restaurant: 'Induláshoz, kisebb vendégkörrel' } },
  pro: { title: 'Pro', badge: 'Népszerű', dot: '#F1CE45', sub: { salon: 'Ha rendszeresen visszahívnád a vendégeidet', restaurant: 'Ha rendszeresen visszahívnád a vendégeidet' } },
  egyedi: { title: 'Egyedi', badge: 'Vállalati', dot: '#1D1C19', sub: { salon: 'veled egyeztetve alakítjuk ki', restaurant: 'veled egyeztetve alakítjuk ki' } },
}

export const REGISTER_HREF: Record<Segment, string> = { salon: '/register', restaurant: '/register-restaurant' }
export const CONTACT_EMAIL = 'hello@davelopment.hu'

/** A kártyák rövid kulcspontjai (Starter = Pro) szegmensenként — a teljes lista az /arak
 *  összehasonlító táblázatában van (a funkció-oldalak forrásából). */
const BASE_FEATS: Record<Segment, string[]> = {
  salon: [
    'Saját foglalóoldal élő szerkesztővel, 6 nyelven',
    'Csapat-naptár, beosztás és jogosultságok',
    'Munkaidő, bér és borravaló nyilvántartás',
    'Előleg és ajándékutalvány online',
    'Automatikus számla (Számlázz.hu / Billingo)',
    'Vendégkártya, tiltólista, vendég-térkép',
    'Emlékeztetők és Google-értékeléskérés',
    'Statisztikák és CSV-export',
  ],
  restaurant: [
    'Saját foglalóoldal élő szerkesztővel, 6 nyelven',
    'Asztaltérkép és napi idővonal asztalonként',
    'Csoportos foglalás előleggel',
    'Csapat-naptár, beosztás és jogosultságok',
    'Automatikus számla (Számlázz.hu / Billingo)',
    'Ajándékutalvány online',
    'Vendégkártya, alkalmak, tiltólista',
    'Napi forgalom- és vendégjelentés',
  ],
}

/** Ami CSAK az Egyedi csomagban jár (a táblázat és a kártya is ebből). */
export const EGYEDI_EXTRAS = [
  'Egyedi fejlesztés az igényeidre',
  'Testreszabott foglaló + arculat',
  'Dedikált kapcsolattartó',
  'Prioritásos támogatás & SLA',
  'API-hozzáférés egyedi integrációkhoz',
  'Egyedi riportok és exportálás',
  'Rugalmas, egyedi fizetési feltételek',
]

const num = (n: number) => n.toLocaleString('hu-HU')
/** „10× nagyobb” — ha a két keret aránya kerek többszörös, különben „nagyobb”. */
const ratio = (a: number, b: number) => (b > 0 && a / b >= 2 ? `${Math.round(a / b)}× nagyobb` : 'nagyobb')

export function planCards(seg: Segment, p: LandingPricing) {
  const starterCap = monthlyEmailCapForTier(p, 'starter')
  const proCap = monthlyEmailCapForTier(p, 'pro')
  return {
    noun: seg === 'restaurant' ? 'Étterem' : 'Szalon',
    starterFee: businessMonthlyFee(p, seg, 1, 'starter'),
    proFee: businessMonthlyFee(p, seg, 1, 'pro'),
    // Kommunikáció a Pro felé (funkcióban azonos csomagok): a valódi különbség — a hírlevél-keret
    // — a Starteren áthúzott sorként, a Prón az első, kiemelt sorként jelenik meg.
    starterFeats: [
      ...BASE_FEATS[seg].map((label) => ({ label, included: true })),
      { label: `Hírlevél — ${num(starterCap)} email/hó`, included: true },
      { label: `Bővített hírlevél-keret (${num(proCap)} email/hó)`, included: false },
    ],
    proFeats: [
      { label: `Minden a Starterből + ${ratio(proCap, starterCap)} hírlevél-keret`, included: true },
      ...BASE_FEATS[seg].map((label) => ({ label, included: true })),
      { label: `Hírlevél — ${num(proCap)} email/hó`, included: true },
    ],
    customFeats: ['Minden a Próból', ...EGYEDI_EXTRAS, 'Korlátlan hírlevél-küldés'].map((label) => ({ label, included: true })),
  }
}

/** Egy rövid, minden felületen azonos ár-összefoglaló (GYIK, llms.txt, meta-leírás). */
export function priceSummary(p: LandingPricing): string {
  return `Szakembereknek Starter csomag ${ftFmt(p.salon_starter_huf)}/hó-tól, Pro csomag ${ftFmt(p.salon_pro_huf)}/hó (az első munkatárssal; minden további +${ftFmt(p.salon_extra_staff_huf)}/hó). Éttermeknek Starter ${ftFmt(p.restaurant_starter_huf)}/hó, Pro ${ftFmt(p.restaurant_pro_huf)}/hó, fix áron. Nagyobb vagy egyedi igényekhez Egyedi csomag, egyeztetett árral. Minden csomag ${p.trial_days} napig ingyenesen kipróbálható, bankkártya nélkül.`
}

// ── Összehasonlító táblázat ───────────────────────────────────────────────────
export type Cell = boolean | string
export type CompareRow = { label: string; hint?: string; cells: [Cell, Cell, Cell] }
export type CompareSection = { title: string; rows: CompareRow[] }

export function compareSections(p: LandingPricing): CompareSection[] {
  const all: [Cell, Cell, Cell] = [true, true, true]
  return [
    {
      title: 'Ár és keretek',
      rows: [
        { label: 'Szakember havidíj', hint: 'az első munkatárssal', cells: [ftFmt(p.salon_starter_huf), ftFmt(p.salon_pro_huf), 'Árajánlat'] },
        { label: 'További munkatárs', hint: 'szakembereknél, havonta', cells: [`+${ftFmt(p.salon_extra_staff_huf)}`, `+${ftFmt(p.salon_extra_staff_huf)}`, 'Egyedi'] },
        { label: 'Étterem havidíj', hint: 'fix, létszámtól független', cells: [ftFmt(p.restaurant_starter_huf), ftFmt(p.restaurant_pro_huf), 'Árajánlat'] },
        { label: 'Hírlevél-keret', hint: 'beépítve, havonta', cells: [`${num(p.starter_email_cap)} email`, `${num(p.pro_email_cap)} email`, 'Korlátlan'] },
        { label: 'Éves fizetés kedvezménye', cells: [`−${p.annual_discount_pct}%`, `−${p.annual_discount_pct}%`, 'Egyedi feltételek'] },
        { label: `${p.trial_days} napos ingyenes próbaidő`, hint: 'bankkártya nélkül', cells: [true, true, 'Egyeztetés szerint'] },
        { label: 'Több üzlet egy fiókban, egy számlán', cells: all },
      ],
    },
    // A funkció-csoportok MINDEN funkciója minden csomagban — a táblázat a funkció-oldalak forrásából épül.
    ...FEATURE_GROUPS.map((g) => ({ title: g.label, rows: g.items.map((f) => ({ label: f.title, hint: f.desc, cells: all })) })),
    {
      title: 'Támogatás és egyedi igények',
      rows: [
        { label: 'E-mailes ügyfélszolgálat', cells: all },
        ...EGYEDI_EXTRAS.map((label): CompareRow => ({ label, cells: [false, false, true] })),
      ],
    },
  ]
}

// ── Árazási GYIK (az /arak oldal + FAQPage JSON-LD) ───────────────────────────
export function pricingFaqItems(p: LandingPricing): { q: string; a: string }[] {
  const ex3 = businessMonthlyFee(p, 'salon', 3, 'pro')
  const exAnnual = Math.round(p.salon_pro_huf * (1 - p.annual_discount_pct / 100))
  return [
    { q: 'Mennyibe kerül a davelopment booking?', a: priceSummary(p) },
    {
      q: 'Mi a különbség a Starter és a Pro csomag között?',
      a: `Funkcióban semmi: a Starterben is minden funkció benne van, amit a Pro tud — foglalóoldal, naptár, csapat, előleg, utalvány, számlázás és marketing. A különbség az ár és a beépített havi hírlevél-keret: Starterben ${num(p.starter_email_cap)}, Próban ${num(p.pro_email_cap)} email havonta.`,
    },
    {
      q: 'Hogyan számolódik a havidíj szakembereknél?',
      a: `Az alapdíj az első munkatársat tartalmazza, minden további munkatárs +${ftFmt(p.salon_extra_staff_huf)}/hó. Például egy 3 fős szalon Pro csomagban ${ftFmt(p.salon_pro_huf)} + 2 × ${ftFmt(p.salon_extra_staff_huf)} = ${ftFmt(ex3)} havonta. Csak annyit fizetsz, amekkora a csapatod.`,
    },
    {
      q: 'Éttermeknél számít a személyzet létszáma?',
      a: `Nem. Az étterem-csomagok havidíja fix (Starter ${ftFmt(p.restaurant_starter_huf)}, Pro ${ftFmt(p.restaurant_pro_huf)}), akárhány munkatársat veszel fel.`,
    },
    {
      q: 'Van éves fizetés kedvezménnyel?',
      a: `Igen. Éves számlázásnál a havidíj ${p.annual_discount_pct}%-kal kevesebb — például a szakember Pro csomag effektíven ${ftFmt(exAnnual)}/hó —, a díjat évente egyszer terheljük.`,
    },
    {
      q: 'Kell bankkártya a próbaidőhöz?',
      a: `Nem. A ${p.trial_days} napos próbaidőhöz csak egy e-mail-cím és jelszó kell, és minden funkciót kipróbálhatsz. Kártyaadatot csak akkor kérünk, ha a próbaidő után is folytatod.`,
    },
    {
      q: 'Mi történik a próbaidő végén?',
      a: 'Kiválasztod a csomagot, és bankkártyával előfizetsz. Ha nem folytatod, nem terhelünk semmit — a fiókod a beállításokon kívül zárolódik, amíg nem fizetsz elő.',
    },
    {
      q: 'Hogyan fizetek, és kapok számlát?',
      a: 'Bankkártyával, a Stripe biztonságos fizetési rendszerén keresztül. Minden díjról számla készül, amit a fiókod Pénzügy menüjében bármikor megtalálsz és letölthetsz.',
    },
    {
      q: 'Több üzletem van — hogyan fizetek?',
      a: 'Egy fiókban több szalont és éttermet is kezelhetsz. Mindegyik üzlet a saját csomagja szerint számít, a díjukat pedig egyetlen, összevont számlán fizeted.',
    },
    {
      q: 'Van jutalék a foglalások vagy az előlegek után?',
      a: 'Nincs. Csak a havidíjat fizeted, a foglalások után nem vonunk le jutalékot. Az előleg és az utalvány ára a saját Stripe-fiókodba érkezik — ott csak a Stripe saját tranzakciós díja érvényes.',
    },
    {
      q: 'Bármikor lemondhatom vagy csomagot válthatok?',
      a: 'Igen. Az előfizetést bármikor lemondhatod, és a csomagot is válthatod a fiókod beállításaiban.',
    },
    {
      q: 'Mikor érdemes az Egyedi csomagot választani?',
      a: `Ha egyedi fejlesztésre, saját arculatú foglalóra, egyedi integrációra vagy dedikált kapcsolattartóra van szükséged. Az árat az igényeid alapján egyeztetjük — írj a ${CONTACT_EMAIL} címre.`,
    },
  ]
}

/** schema.org Offer-ek a csomagokhoz (az /arak JSON-LD-je). */
export function pricingOffers(p: LandingPricing, url: string) {
  const offer = (name: string, price: number, description: string) => ({
    '@type': 'Offer',
    name,
    price,
    priceCurrency: 'HUF',
    description,
    url,
    availability: 'https://schema.org/InStock',
    priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'HUF', unitText: 'hónap', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } },
  })
  return [
    offer('Szakember Starter', p.salon_starter_huf, `Az első munkatárssal; minden további +${p.salon_extra_staff_huf} Ft/hó.`),
    offer('Szakember Pro', p.salon_pro_huf, `Az első munkatárssal; minden további +${p.salon_extra_staff_huf} Ft/hó.`),
    offer('Étterem Starter', p.restaurant_starter_huf, 'Fix havidíj, létszámtól függetlenül.'),
    offer('Étterem Pro', p.restaurant_pro_huf, 'Fix havidíj, létszámtól függetlenül.'),
  ]
}

export { SALON_INCLUDED_STAFF }

// ── „Így működik a számlázás” tények (az /arak oldal + llms.txt) ──────────────
export function billingFacts(p: LandingPricing): { title: string; body: string }[] {
  return [
    { title: `${p.trial_days} nap ingyen, kártya nélkül`, body: 'Minden funkciót kipróbálhatsz, csak e-mail-cím és jelszó kell. Kártyát csak akkor kérünk, ha folytatod.' },
    { title: 'Annyit fizetsz, amekkora a csapatod', body: `Szakembereknél az alapdíj az első munkatársat tartalmazza, minden további +${ftFmt(p.salon_extra_staff_huf)}/hó. Étteremnél a díj fix.` },
    { title: `Éves fizetésnél −${p.annual_discount_pct}%`, body: 'Havi vagy éves számlázás közül választhatsz; az éves díjat évente egyszer terheljük.' },
    { title: 'Nincs jutalék a foglalások után', body: 'Csak a havidíjat fizeted. Az előleg és az utalvány ára a saját Stripe-fiókodba érkezik.' },
    { title: 'Több üzlet, egy számla', body: 'Egy fiókban több szalont és éttermet is kezelhetsz; a díjukat egy összevont számlán fizeted.' },
    { title: 'Bármikor lemondható', body: 'Az előfizetést bármikor lemondhatod, a csomagot a fiókod beállításaiban válthatod.' },
  ]
}
