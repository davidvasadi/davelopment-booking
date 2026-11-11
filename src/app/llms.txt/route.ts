import { getPricing } from '@/lib/pricing'
import { SITE_URL } from '@/lib/publicSeo'
import { FEATURE_GROUPS } from '@/lib/landingFeatures'
import { billingFacts, priceSummary } from '@/lib/pricingContent'
import { CONTACT_EMAIL, CONTACT_PHONE, SUPPORT_HOURS_TEXT } from '@/lib/brand'
import { TIPS } from '@/lib/tips-content'

/**
 * /llms.txt — az AI-keresőknek szóló összefoglaló, UGYANAZOKBÓL az adatokból, mint az oldalak:
 * a funkciók a `landingFeatures.ts`-ből, az árak és a számlázás a `pricingContent.ts`-ből +
 * a backstage árazási beállításaiból. Óránként frissül (az árváltozás is átjön).
 */
export const revalidate = 3600

export async function GET() {
  const p = await getPricing()
  const groups = FEATURE_GROUPS.filter((g) => g.ready)
  const body = `# davelopment booking

> Online időpont- és asztalfoglaló rendszer szakembereknek és szolgáltató vállalkozásoknak — szépségszalonoktól, rendelőktől és stúdióktól az éttermekig. A vendégek egy saját, publikus foglalóoldalon foglalnak; a tulajdonos és a csapat egy helyen kezeli a naptárat, a beosztást, a vendégeket, az előleget, a számlázást és a marketinget.

davelopment booking magyar SaaS termék (fejlesztő: davelopment, davelopment.hu). A vállalkozások saját foglalóoldalt kapnak (\`/[üzlet-slug]\`), automatikus visszaigazolással, emlékeztetőkkel és valós idejű csapat-értesítésekkel.

## Árak

${priceSummary(p)}

${billingFacts(p).map((f) => `- ${f.title}: ${f.body}`).join('\n')}

Részletek, kalkulátor és csomag-összehasonlítás: ${SITE_URL}/arak

## Funkciók

${groups.map((g) => `### [${g.label}](${SITE_URL}/funkciok/${g.slug})\n${g.tagline}\n${g.items.map((f) => `- ${f.title}: ${f.desc}`).join('\n')}`).join('\n\n')}

## Fő oldalak

- [Főoldal](${SITE_URL}/): termékbemutató, funkciók, árak, GYIK.
- [Funkciók](${SITE_URL}/funkciok): az összes funkció csoportonként.\n- [Árak](${SITE_URL}/arak): csomagok, díjkalkulátor, összehasonlító táblázat, árazási GYIK.
- [Tippek és cikkek](${SITE_URL}/tips): útmutatók a rendszer használatához és gyakorlati cikkek kisvállalkozásoknak.
- [Kapcsolat](${SITE_URL}/kapcsolat): ügyfélszolgálat — ${CONTACT_PHONE}, ${CONTACT_EMAIL} (${SUPPORT_HOURS_TEXT.toLowerCase()}).
- [Regisztráció](${SITE_URL}/register): ${p.trial_days} napos ingyenes próbaidő szakembereknek.
- [Regisztráció éttermeknek](${SITE_URL}/register-restaurant): ${p.trial_days} napos ingyenes próbaidő éttermeknek.

## Tippek (a rendszer használata)

${TIPS.filter((t) => t.kind === 'tipp').map((t) => `- [${t.title}](${SITE_URL}/tips/${t.slug}): ${t.excerpt}`).join('\n')}

## Cikkek

${TIPS.filter((t) => (t.kind ?? 'cikk') === 'cikk').map((t) => `- [${t.title}](${SITE_URL}/tips/${t.slug}): ${t.excerpt}`).join('\n')}

## Megjegyzés

Az egyes vállalkozások publikus foglalóoldalai (\`/[üzlet-slug]\`) ügyfelenként jönnek létre — ezek nem a davelopment booking terméket mutatják be, hanem az adott vállalkozás saját foglalási felületét.
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
