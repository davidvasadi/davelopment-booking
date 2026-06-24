import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Felhasználási feltételek',
  description: 'A Schedulio időpontfoglaló szolgáltatás Általános Szerződési Feltételei.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Felhasználási feltételek" updated="2026. június 24.">
      <p>
        A jelen Általános Szerződési Feltételek (a továbbiakban: „ÁSZF") a Schedulio online időpont-
        és asztalfoglaló szolgáltatás (a továbbiakban: „Szolgáltatás") igénybevételének feltételeit
        szabályozzák a Szolgáltató és a Szolgáltatást igénybe vevő természetes vagy jogi személy
        (a továbbiakban: „Felhasználó") között. A regisztrációval, illetve a Szolgáltatás bármilyen
        formában történő használatával a Felhasználó kijelenti, hogy a jelen ÁSZF-et elolvasta,
        megértette és magára nézve kötelezőnek fogadja el.
      </p>

      <LegalSection heading="1. A Szolgáltató">
        <p>
          A Szolgáltatást üzemeltető (a továbbiakban: „Szolgáltató"):
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Név / cégnév: <strong className="text-brand-ink">[Üzemeltető neve]</strong></li>
          <li>Székhely: <strong className="text-brand-ink">[Székhely]</strong></li>
          <li>Nyilvántartási szám: <strong className="text-brand-ink">[Nyilvántartási szám]</strong></li>
          <li>Adószám: <strong className="text-brand-ink">[Adószám]</strong> (alanyi adómentes)</li>
          <li>E-mail: <a href="mailto:hello@schedulio.hu" className="font-medium text-brand-ink underline underline-offset-2">hello@schedulio.hu</a></li>
        </ul>
        <p>
          A Szolgáltató alanyi adómentes egyéni vállalkozóként működik, ezért az általa kiállított
          számlák áfát nem tartalmaznak. A feltüntetett díjak a fizetendő végösszeget jelentik.
        </p>
      </LegalSection>

      <LegalSection heading="2. A Szolgáltatás tárgya és jellege">
        <p>
          A Schedulio felhőalapú, „szoftver mint szolgáltatás" (SaaS) modellben működő időpont- és
          asztalfoglaló rendszer. A Szolgáltató kizárólag a szoftveres eszközt biztosítja; a
          Felhasználó és annak ügyfelei közötti jogviszonyban, a foglalások teljesítésében, a
          szolgáltatások minőségében vagy bármely, a Felhasználó saját tevékenységéből eredő
          kötelezettségben a Szolgáltató nem vesz részt és felelősséget nem vállal.
        </p>
      </LegalSection>

      <LegalSection heading="3. Regisztráció, fiók és felhasználói felelősség">
        <p>
          A Szolgáltatás használata regisztrációhoz kötött. A Felhasználó köteles valós és pontos
          adatokat megadni, és felelős a fiókja belépési adatainak titokban tartásáért, valamint a
          fiókján keresztül végzett minden tevékenységért. A Felhasználó teljeskörűen felel az általa
          a rendszerbe feltöltött adatok jogszerűségéért — különösen az ügyfelei személyes adatainak
          kezeléséhez szükséges jogalap meglétéért. A Felhasználó kötelezettséget vállal arra, hogy a
          Szolgáltatót mentesíti minden olyan igény, követelés vagy bírság alól, amely a Felhasználó
          jogsértő adatkezeléséből vagy a Szolgáltatás nem rendeltetésszerű használatából ered.
        </p>
      </LegalSection>

      <LegalSection heading="4. Próbaidőszak, díjak és fizetés">
        <p>
          A Szolgáltatás ingyenes próbaidőszakkal indul. A próbaidőszak leteltét követően a
          használat előfizetéshez kötött, az aktuálisan közzétett díjszabás szerint. Az előfizetési
          díjak beszedését a <strong className="text-brand-ink">Stripe Payments Europe, Ltd.</strong>{' '}
          fizetési szolgáltató kezeli; a Szolgáltató bankkártyaadatokat nem lát és nem tárol. A
          díjak a számlázási időszak elején, előre fizetendők. A Szolgáltató fenntartja a jogot a
          díjak jövőbeni módosítására, amelyről a Felhasználót előzetesen értesíti.
        </p>
      </LegalSection>

      <LegalSection heading="5. Elállás, lemondás és visszatérítés">
        <p>
          Az előfizetés a Felhasználó által bármikor lemondható; a lemondás a folyó, már kifizetett
          számlázási időszak végén lép hatályba. A már kifizetett, megkezdett időszakra járó díj —
          a jogszabály eltérő, kötelező rendelkezése hiányában — nem téríthető vissza. Mivel a
          Szolgáltatás digitális tartalom, amelynek teljesítése a Felhasználó kifejezett előzetes
          hozzájárulásával a próbaidőszak alatt megkezdődik, a Felhasználó tudomásul veszi, hogy
          elállási joga a teljesítés megkezdését követően a vonatkozó jogszabályok keretei között
          korlátozott.
        </p>
      </LegalSection>

      <LegalSection heading="6. A Szolgáltatás elérhetősége">
        <p>
          A Szolgáltató törekszik a Szolgáltatás folyamatos elérhetőségére, azonban nem garantál
          megszakításmentes vagy hibamentes működést, és nem vállal kötelezettséget meghatározott
          rendelkezésre állási (SLA) szint biztosítására. A Szolgáltató jogosult a Szolgáltatást
          karbantartás, fejlesztés, biztonsági okból vagy vis maior esetén előzetes értesítés nélkül
          átmenetileg szüneteltetni vagy korlátozni.
        </p>
      </LegalSection>

      <LegalSection heading="7. Felelősség korlátozása">
        <p>
          A Szolgáltatást „adott állapotában" és „elérhetőség szerint" biztosítjuk, mindennemű
          kifejezett vagy hallgatólagos szavatosság nélkül. A vonatkozó jogszabályok által megengedett
          legteljesebb mértékben a Szolgáltató kizárja a felelősségét minden közvetett, következményi,
          különleges vagy büntető jellegű kárért, így különösen elmaradt haszonért, bevételkiesésért,
          adatvesztésért, üzleti jó hírnév sérelméért vagy üzletmenet megszakadásáért. A Szolgáltató
          teljes, összesített felelőssége — bármely jogcímen — semmilyen esetben nem haladhatja meg a
          Felhasználó által az igény keletkezését megelőző három (3) hónapban a Szolgáltatásért
          ténylegesen megfizetett díjak összegét. E korlátozás nem érinti azt a felelősséget, amely
          jogszabály alapján érvényesen nem zárható ki.
        </p>
      </LegalSection>

      <LegalSection heading="8. Szellemi tulajdon">
        <p>
          A Szolgáltatás, annak forráskódja, megjelenése, védjegyei és minden kapcsolódó szellemi
          alkotás a Szolgáltató kizárólagos tulajdonát képezi. A Felhasználó a Szolgáltatás
          használatára nem kizárólagos, át nem ruházható, visszavonható felhasználási jogot kap az
          előfizetés időtartamára. A Szolgáltatás visszafejtése, másolása, továbbértékesítése vagy
          származékos mű létrehozása tilos.
        </p>
      </LegalSection>

      <LegalSection heading="9. A szerződés megszűnése">
        <p>
          A Szolgáltató jogosult a Felhasználó hozzáférését azonnali hatállyal felfüggeszteni vagy a
          szerződést felmondani, ha a Felhasználó a jelen ÁSZF-et lényegesen megszegi, a Szolgáltatást
          jogellenes célra használja, vagy a díjfizetéssel késedelembe esik. A szerződés megszűnése
          esetén a Felhasználó adatait a Szolgáltató az Adatkezelési tájékoztató szerint kezeli.
        </p>
      </LegalSection>

      <LegalSection heading="10. A feltételek módosítása">
        <p>
          A Szolgáltató fenntartja a jogot a jelen ÁSZF egyoldalú módosítására. A lényeges
          változásokról a Felhasználót a Szolgáltatáson belül vagy e-mailben értesíti. A módosítás
          hatálybalépését követő használat a módosított feltételek elfogadásának minősül.
        </p>
      </LegalSection>

      <LegalSection heading="11. Irányadó jog és vitarendezés">
        <p>
          A jelen ÁSZF-re a magyar jog az irányadó. A felek a vitáikat elsődlegesen békés úton
          rendezik; ennek eredménytelensége esetén a jogvita elbírálására — a hatásköri és illetékességi
          szabályok keretei között — a Szolgáltató székhelye szerinti bíróság az illetékes. Fogyasztói
          jogvita esetén a Felhasználó a lakóhelye szerinti békéltető testülethez is fordulhat.
        </p>
      </LegalSection>

      <LegalSection heading="12. Kapcsolat">
        <p>
          Kérdés esetén írjon nekünk a{' '}
          <a href="mailto:hello@schedulio.hu" className="font-medium text-brand-ink underline underline-offset-2">
            hello@schedulio.hu
          </a>{' '}
          címre.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
