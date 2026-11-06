import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Felhasználási feltételek',
  description: 'A davelopment booking időpontfoglaló szolgáltatás Általános Szerződési Feltételei.',
  robots: { index: false, follow: true },
}

export default function TermsPage() {
  return (
    <LegalPage title="Felhasználási feltételek" updated="2026. november 6.">
      <p>
        A jelen Általános Szerződési Feltételek (a továbbiakban: „ÁSZF") a davelopment booking online időpont-
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
          <li>Név: <strong className="text-brand-ink">Vasadi Dávid egyéni vállalkozó</strong></li>
          <li>Székhely: <strong className="text-brand-ink">2161 Csomád, Szent István utca 19/C.</strong></li>
          <li>Nyilvántartási szám: <strong className="text-brand-ink">62508634</strong></li>
          <li>Adószám: <strong className="text-brand-ink">92176472-1-33</strong> (alanyi adómentes)</li>
          <li>Közösségi adószám: <strong className="text-brand-ink">HU92176472</strong></li>
          <li>Illetékes adóhatóság: <strong className="text-brand-ink">NAV 13. Pest Vármegyei Adó- és Vámigazgatósága</strong></li>
          <li>E-mail: <a href="mailto:hello@davelopment.hu" className="font-medium text-brand-ink underline underline-offset-2">hello@davelopment.hu</a></li>
        </ul>
        <p>
          A Szolgáltató alanyi adómentes egyéni vállalkozóként működik, ezért az általa kiállított
          számlák áfát nem tartalmaznak. A feltüntetett díjak a fizetendő végösszeget jelentik.
        </p>
      </LegalSection>

      <LegalSection heading="2. A Szolgáltatás tárgya és jellege">
        <p>
          A davelopment booking felhőalapú, „szoftver mint szolgáltatás" (SaaS) modellben működő időpont- és
          asztalfoglaló rendszer. A Szolgáltató kizárólag a szoftveres eszközt biztosítja; a
          Felhasználó és annak ügyfelei közötti jogviszonyban, a foglalások teljesítésében, a
          szolgáltatások minőségében vagy bármely, a Felhasználó saját tevékenységéből eredő
          kötelezettségben a Szolgáltató nem vesz részt és felelősséget nem vállal.
        </p>
        <p>
          A Szolgáltatás vállalkozások (egyéni vállalkozók, gazdasági társaságok és más szervezetek) részére,
          gazdasági tevékenységük körében készült. A Felhasználó a regisztrációval kijelenti, hogy a Szolgáltatást
          önálló foglalkozása, illetve gazdasági tevékenysége körében veszi igénybe, és nem minősül fogyasztónak.
        </p>
      </LegalSection>

      <LegalSection heading="3. Regisztráció, fiók és felhasználói felelősség">
        <p>
          A Szolgáltatás használata regisztrációhoz kötött. A Felhasználó köteles valós és pontos
          adatokat megadni, és felelős a fiókja belépési adatainak titokban tartásáért, valamint a
          fiókján keresztül végzett minden tevékenységért. A belépés jelszó nélkül, az e-mail-címre küldött
          egyszer használatos kóddal vagy Google-fiókkal történik; a bejelentkezett eszközök a „Saját profil”
          oldalon láthatók és kiléptethetők. A Felhasználó teljeskörűen felel az általa
          a rendszerbe feltöltött adatok jogszerűségéért — különösen az ügyfelei személyes adatainak
          kezeléséhez szükséges jogalap meglétéért. A Felhasználó kötelezettséget vállal arra, hogy a
          Szolgáltatót mentesíti minden olyan igény, követelés vagy bírság alól, amely a Felhasználó
          jogsértő adatkezeléséből vagy a Szolgáltatás nem rendeltetésszerű használatából ered.
        </p>
      </LegalSection>

      <LegalSection heading="4. Próbaidőszak, díjak és fizetés">
        <p>
          A Szolgáltatás 30 napos ingyenes próbaidőszakkal indul, bankkártya megadása nélkül. A próbaidőszak
          leteltét követően a használat előfizetéshez kötött, az aktuálisan közzétett díjszabás szerint. Az
          előfizetési díjak beszedését a <strong className="text-brand-ink">Stripe Payments Europe, Ltd.</strong>{' '}
          fizetési szolgáltató kezeli; a Szolgáltató bankkártyaadatokat nem lát és nem tárol. A díjak a
          számlázási időszak elején, előre fizetendők.
        </p>
        <p>
          <strong className="text-brand-ink">Ha a próbaidőszak lejár, és a Felhasználó nem ad meg számlázási
          adatokat</strong> (illetve ha az előfizetési díj megfizetése meghiúsul), a fiók zárolásra kerül: a
          vállalkozói felület csak az előfizetés rendezéséhez érhető el, a nyilvános foglalóoldal „szünetel”
          állapotba kerül, és új foglalást nem fogad. A Felhasználó adatai a zárolás alatt megmaradnak, és az
          előfizetés rendezésével a fiók azonnal újra teljes értékűen használható. A Szolgáltató a zárolt fiók
          adatait a zárolástól számított 12 hónap elteltével — előzetes e-mailes értesítést követően — törölheti.
        </p>
        <p>
          <strong className="text-brand-ink">Több üzlet egy fiókban.</strong> Az előfizetés fiók-szintű; a
          díj üzletenként adódik hozzá. A próbaidőszak alatt hozzáadott új üzlet a közös próbaidőszakba kerül;
          fizetős előfizetés mellett hozzáadott üzlet díja a következő számlán jelenik meg.
        </p>
        <p>
          <strong className="text-brand-ink">Díjmódosítás.</strong> A Szolgáltató a díjakat a hatálybalépés
          előtt legalább 30 nappal, e-mailben és a Szolgáltatáson belül közölt értesítéssel módosíthatja. A
          Felhasználó a módosítás hatálybalépéséig az előfizetést lemondhatja; ebben az esetben a már kifizetett
          időszak végéig a korábbi díj érvényes.
        </p>
        <p>
          A Felhasználó — saját döntése alapján — a vendégeitől foglalási előleget kérhet, ajándékutalványt
          értékesíthet, a szolgáltatás díját a helyszínen bankkártyával („Lezárás fizetéssel”) vagy a vendégnek
          küldött fizetési linken keresztül fizettetheti. Ezen fizetések a Felhasználó saját, önálló Stripe
          Connect-fiókjába, közvetlenül, a Szolgáltató közreműködése nélkül érkeznek; a Szolgáltató e
          fizetések tekintetében kizárólag a technikai (szoftveres) hátteret biztosítja, a fizetési
          jogviszonynak nem alanya. Az előleg és az ajándékutalvány feltételeiért (így különösen a
          visszatérítés szabályaiért és az utalvány érvényességi idejéért) kizárólag a Felhasználó
          felel, akinek ezeket saját, a vendégek számára közzétett foglalási feltételeiben kell
          rögzítenie.
        </p>
        <p>
          <strong className="text-brand-ink">Egyéni vállalkozó munkatársak.</strong> Ha a Felhasználó
          csapatában egy munkatárs saját nevére számláz, illetve saját Stripe-fiókjába fizettet, a vendéggel a
          munkatárs áll jogviszonyban; a Szolgáltató ebben a körben is kizárólag a technikai hátteret
          biztosítja. A munkatárs bevonásáért és a köztük fennálló jogviszonyért a Felhasználó felel.
        </p>
      </LegalSection>

      <LegalSection heading="4/A. Számlázás a Felhasználó nevében">
        <p>
          Ha a Felhasználó összekapcsolja a Szolgáltatást a saját számlázó fiókjával (Számlázz.hu vagy Billingo),
          a rendszer a Felhasználó nevében, a Felhasználó fiókján keresztül állít ki számlát a vendégnek
          (előleg, helyszíni fizetés, végszámla, ajándékutalvány). <strong className="text-brand-ink">A számla
          kiállítója a Felhasználó</strong>; a Szolgáltató kizárólag a számla adatait továbbítja a Felhasználó
          által megadott számlázó szolgáltatónak. A számla adataiért (különösen az adószámért, az áfakulcsért, a
          tételekért és az árakért) és a számla kiállításával járó adózási kötelezettségekért a Felhasználó
          felel. A rendszer az áfakulcsot a Felhasználó által megadott adószám alapján javasolja; ennek
          helyességét a Felhasználó köteles ellenőrizni. A Szolgáltató nem felel a számlázó szolgáltató
          hibájáért, elérhetetlenségéért, illetve a Felhasználó által megadott hibás adatokból eredő
          következményekért.
        </p>
      </LegalSection>

      <LegalSection heading="4/B. Adatok behozatala más rendszerből">
        <p>
          A Felhasználó más rendszerből (pl. táblázatból) vendég- és foglalási adatokat tölthet fel. A
          Felhasználó felel azért, hogy a feltöltött adatokat jogszerűen kezelheti, és vendégeit az
          adatkezelésről tájékoztatta. A behozatal során a vendégek nem kapnak értesítést. A korábbi
          hírlevél-hozzájárulásokat a Felhasználó csak akkor jelölheti meg, ha azok igazolhatóan fennállnak.
        </p>
      </LegalSection>

      <LegalSection heading="4/C. Ajánló program (Partnerprogram)">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            A fiók tulajdonosa egyedi ajánló linket és kódot kap. Ha egy vállalkozás ezzel a linkkel vagy kóddal
            regisztrál, és a próbaidőszak után először előfizetési díjat fizet, az ajánló Felhasználó előfizetése
            1 hónappal díjmentesen meghosszabbodik. A jóváírható hónapok száma nincs korlátozva.
          </li>
          <li>
            A meghívott vállalkozás a szokásos 30 napos próbaidőszakkal indul; külön jutalmat nem kap, de maga
            is ajánlóvá válhat.
          </li>
          <li>
            A jóváírás kizárólag a Szolgáltatás díjára használható fel, pénzre nem váltható, és nem
            ruházható át. Ha az ajánlónak még nincs fizetős előfizetése, a jóváírás az első előfizetésekor
            kerül felhasználásra.
          </li>
          <li>
            Önmaga (saját, illetve ugyanazon tulajdonos további vállalkozásának) ajánlása, valamint
            valótlan vagy tömeges, kéretlen megkeresésen (spam) alapuló ajánlás nem jogosít jóváírásra. Ilyen
            visszaélés esetén a Szolgáltató a jóváírást visszavonhatja, és az ajánló programból kizárhatja a
            Felhasználót.
          </li>
          <li>
            A Szolgáltató a programot a jövőre nézve bármikor módosíthatja vagy megszüntetheti; a módosítás
            előtt már megszerzett jóváírásokat ez nem érinti.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Elállás, lemondás és visszatérítés">
        <p>
          Az előfizetés a Felhasználó által bármikor lemondható; a lemondás a folyó, már kifizetett
          számlázási időszak végén lép hatályba. A már kifizetett, megkezdett időszakra járó díj —
          a jogszabály eltérő, kötelező rendelkezése hiányában — nem téríthető vissza. Mivel a
          Szolgáltatás vállalkozások részére készült (2. pont), a fogyasztókat megillető elállási jog a
          Felhasználót nem illeti meg.
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
        <p>
          <strong className="text-brand-ink">Üzlet és fiók törlése.</strong> A Felhasználó egy üzletét vagy a
          teljes fiókját a Beállításokban bármikor törölheti. A törlés végleges, és azonnal hatályos: az üzlet
          foglalóoldala megszűnik, a foglalások, vendégadatok és beállítások törlődnek. A törlés előtt a
          Felhasználó letöltheti adatait (vendéglista, foglalások). A Felhasználó által a saját számlázó fiókjában
          kiállított számlák a számlázó szolgáltatónál, a Szolgáltató által kiállított előfizetési számlák pedig
          a számviteli jogszabályokban előírt ideig megmaradnak.
        </p>
      </LegalSection>

      <LegalSection heading="10. A feltételek módosítása">
        <p>
          A Szolgáltató fenntartja a jogot a jelen ÁSZF egyoldalú módosítására. A lényeges
          változásokról a Felhasználót a hatálybalépés előtt legalább 15 nappal (díjmódosításnál 30 nappal), a
          Szolgáltatáson belül és e-mailben értesíti; a Felhasználó a hatálybalépésig az előfizetést lemondhatja.
          A módosítás hatálybalépését követő használat a módosított feltételek elfogadásának minősül.
        </p>
      </LegalSection>

      <LegalSection heading="11. Irányadó jog és vitarendezés">
        <p>
          A jelen ÁSZF-re a magyar jog az irányadó. A felek a vitáikat elsődlegesen békés úton
          rendezik; ennek eredménytelensége esetén a jogvita elbírálására — a hatásköri és illetékességi
          szabályok keretei között — a Szolgáltató székhelye szerinti bíróság az illetékes.
        </p>
      </LegalSection>

      <LegalSection heading="12. Adatfeldolgozás (adatfeldolgozói szerződés)">
        <p>
          A Felhasználó vendégeinek személyes adatai tekintetében a Felhasználó az adatkezelő, a Szolgáltató
          az adatfeldolgozó. A felek e pontot a GDPR 28. cikke szerinti adatfeldolgozói szerződésnek tekintik.
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong className="text-brand-ink">Tárgy és időtartam:</strong> a Szolgáltatás nyújtásához szükséges adatkezelés (foglalások fogadása és kezelése, értesítések küldése, vendéglista, hírlevél, fizetések és számlázás technikai lebonyolítása), a szerződés fennállása alatt.</li>
          <li><strong className="text-brand-ink">Érintettek és adatok köre:</strong> a Felhasználó vendégei és munkatársai; név, telefonszám, e-mail-cím, foglalási adatok, megjegyzések, a foglaláskor adott hozzájárulások, fizetési és számlázási adatok (kártyaadat nélkül).</li>
          <li><strong className="text-brand-ink">Utasítás:</strong> a Szolgáltató az adatokat kizárólag a Felhasználó utasítása szerint — amelyet a Szolgáltatás beállításai és használata jelent — és a jelen ÁSZF szerint kezeli; saját célra nem használja fel.</li>
          <li><strong className="text-brand-ink">Titoktartás és biztonság:</strong> az adatokhoz csak a feladatukhoz szükséges mértékben, titoktartásra kötelezett személyek férnek hozzá; a Szolgáltató megfelelő technikai és szervezési intézkedéseket alkalmaz (titkosított adatátvitel, hozzáférés-korlátozás, naplózás, mentések).</li>
          <li><strong className="text-brand-ink">További adatfeldolgozók:</strong> a Felhasználó általános felhatalmazást ad az Adatkezelési tájékoztatóban név szerint felsorolt további adatfeldolgozók igénybevételére. Új adatfeldolgozó bevonásáról a Szolgáltató előzetesen értesíti a Felhasználót, aki az ellen kifogással élhet.</li>
          <li><strong className="text-brand-ink">Közreműködés:</strong> a Szolgáltató a Szolgáltatás funkcióival (keresés, exportálás, törlés) és szükség esetén közvetlenül segíti a Felhasználót az érintetti kérelmek teljesítésében, valamint az adatbiztonsági és adatvédelmi kötelezettségei teljesítésében.</li>
          <li><strong className="text-brand-ink">Adatvédelmi incidens:</strong> a Szolgáltató az őt érintő adatvédelmi incidensről a tudomásszerzést követően indokolatlan késedelem nélkül értesíti a Felhasználót.</li>
          <li><strong className="text-brand-ink">A szerződés vége:</strong> a szerződés megszűnésekor (az üzlet, illetve a fiók törlésekor) a Szolgáltató az adatokat törli; a Felhasználó előtte letöltheti azokat. A mentésekből az adatok legkésőbb 30 napon belül törlődnek.</li>
          <li><strong className="text-brand-ink">Ellenőrzés:</strong> a Szolgáltató a Felhasználó kérésére rendelkezésre bocsátja azokat az információkat, amelyek a jelen pontban foglaltak teljesítésének igazolásához szükségesek, és lehetővé teszi az ésszerű, előre egyeztetett ellenőrzést.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="13. Kapcsolat">
        <p>
          Kérdés esetén írjon nekünk a{' '}
          <a href="mailto:hello@davelopment.hu" className="font-medium text-brand-ink underline underline-offset-2">
            hello@davelopment.hu
          </a>{' '}
          címre.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
