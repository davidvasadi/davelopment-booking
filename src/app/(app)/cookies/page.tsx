import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Sütikezelés',
  description: 'Tájékoztató a Schedulio által használt sütikről (cookie-król).',
}

export default function CookiesPage() {
  return (
    <LegalPage title="Sütikezelési tájékoztató" updated="2026. június 24.">
      <p>
        A Schedulio sütiket (cookie-kat) és hasonló technológiákat használ a weboldal és a
        Szolgáltatás megfelelő működéséhez, valamint a felhasználói élmény javításához. A jelen
        tájékoztató az Adatkezelési tájékoztató szerves részét képezi.
      </p>

      <LegalSection heading="1. Mi az a süti?">
        <p>
          A süti egy kis adatfájl, amelyet a böngészője az eszközén tárol. Segítségével a weboldal
          felismeri az Ön eszközét a következő látogatáskor, megjegyzi a beállításait, és fenntartja
          a bejelentkezett munkamenet folytonosságát.
        </p>
      </LegalSection>

      <LegalSection heading="2. Az általunk használt sütik típusai">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-brand-ink">Elengedhetetlen (működési) sütik:</strong> a
            bejelentkezéshez, a biztonságos munkamenet fenntartásához és a Szolgáltatás
            alapfunkcióihoz szükségesek. Jogalapjuk a Szolgáltató jogos érdeke, illetve a szerződés
            teljesítése; ezek a Szolgáltatás működéséhez nélkülözhetetlenek, ezért hozzájárulás nélkül
            is alkalmazhatók.
          </li>
          <li>
            <strong className="text-brand-ink">Beállítási sütik:</strong> megjegyzik az Ön
            preferenciáit (pl. téma, nyelv), a kényelmesebb használat érdekében.
          </li>
          <li>
            <strong className="text-brand-ink">Statisztikai sütik:</strong> anonimizált, összesített
            formában segítenek megérteni az oldal használatát, hogy fejleszthessük azt. Ezek
            alkalmazása az Ön hozzájárulásán alapul.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Hozzájárulás és a sütik kezelése">
        <p>
          A nem elengedhetetlen sütik alkalmazásához az Ön előzetes hozzájárulását kérjük az oldal
          alján megjelenő süti-sávban. Hozzájárulását bármikor visszavonhatja vagy módosíthatja,
          továbbá a böngészője beállításaiban a sütiket törölheti, illetve letilthatja. Az
          elengedhetetlen sütik letiltása esetén előfordulhat, hogy a Szolgáltatás egyes funkciói nem
          érhetők el, amelyért a Szolgáltatót felelősség nem terheli.
        </p>
      </LegalSection>

      <LegalSection heading="4. Harmadik fél sütijei">
        <p>
          A fizetési folyamat során a Stripe, illetve egyes beágyazott szolgáltatások saját sütiket
          helyezhetnek el, amelyekre az adott szolgáltató saját süti- és adatkezelési tájékoztatója
          irányadó.
        </p>
      </LegalSection>

      <LegalSection heading="5. Kapcsolat">
        <p>
          A sütikkel kapcsolatos kérdéseivel forduljon hozzánk a{' '}
          <a href="mailto:hello@schedulio.hu" className="font-medium text-brand-ink underline underline-offset-2">
            hello@schedulio.hu
          </a>{' '}
          címen.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
