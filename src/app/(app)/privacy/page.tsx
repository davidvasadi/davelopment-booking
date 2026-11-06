import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'A davelopment booking adatkezelési tájékoztatója a GDPR rendelkezéseivel összhangban.',
  robots: { index: false, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Adatkezelési tájékoztató" updated="2026. november 6.">
      <p>
        A jelen tájékoztató a davelopment booking szolgáltatás (a továbbiakban: „Szolgáltatás") keretében
        megvalósuló személyesadat-kezelést ismerteti az Európai Parlament és a Tanács (EU) 2016/679
        rendeletével (GDPR) és az információs önrendelkezési jogról szóló 2011. évi CXII. törvénnyel
        összhangban.
      </p>

      <LegalSection heading="1. Az adatkezelő / adatfeldolgozó">
        <p>
          A Szolgáltatást üzemeltető:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Név: <strong className="text-brand-ink">Vasadi Dávid egyéni vállalkozó</strong></li>
          <li>Székhely: <strong className="text-brand-ink">2161 Csomád, Szent István utca 19/C.</strong></li>
          <li>Nyilvántartási szám: <strong className="text-brand-ink">62508634</strong></li>
          <li>Adószám: <strong className="text-brand-ink">92176472-1-33</strong></li>
          <li>Kapcsolat: <a href="mailto:hello@davelopment.hu" className="font-medium text-brand-ink underline underline-offset-2">hello@davelopment.hu</a></li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Az adatkezelői és adatfeldolgozói szerepkörök">
        <p>
          <strong className="text-brand-ink">A Felhasználó (a Szolgáltatást igénybe vevő vállalkozás)
          saját ügyfeleinek adatai tekintetében önálló adatkezelőnek minősül.</strong> A Szolgáltató
          ezen ügyféladatokat (foglaló vendégek neve, elérhetősége, foglalási adatai) kizárólag a
          Felhasználó megbízásából, az ő utasításai szerint, adatfeldolgozóként kezeli. A
          jogalap megléte, a vendégek tájékoztatása és az adatkezelés jogszerűsége e körben a
          Felhasználó kizárólagos felelőssége. A Felhasználó saját fiók- és számlázási adatai
          tekintetében a Szolgáltató önálló adatkezelő. A Szolgáltató adatfeldolgozói kötelezettségeit a
          Felhasználási feltételek (ÁSZF) „Adatfeldolgozás” pontja — a GDPR 28. cikke szerinti adatfeldolgozói
          szerződés — rögzíti.
        </p>
        <p>
          <strong className="text-brand-ink">Vendégeknek:</strong> ha egy vállalkozás foglalóoldalán foglal, az
          adatait elsősorban az adott vállalkozás kezeli. A vállalkozás saját adatkezelési tájékoztatója — ha
          megadta — a foglalóoldalon, a foglalás véglegesítésénél és az oldal alján érhető el; adatkezeléssel
          kapcsolatos kéréseivel elsősorban hozzá forduljon.
        </p>
      </LegalSection>

      <LegalSection heading="3. A kezelt adatok köre">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong className="text-brand-ink">Fiókadatok:</strong> név, e-mail cím, profilkép, vállalkozás neve, telefonszám, település, cégadatok. Jelszót nem tárolunk: a belépés az e-mail-címre küldött, rövid ideig érvényes egyszer használatos kóddal vagy Google-fiókkal történik.</li>
          <li><strong className="text-brand-ink">Munkamenetek:</strong> a bejelentkezett eszközök adatai (eszköz és böngésző típusa, IP-cím, utolsó használat ideje), amelyeket a Felhasználó a „Saját profil” oldalon lát, és kiléptethet.</li>
          <li><strong className="text-brand-ink">Foglalási adatok:</strong> a Felhasználó ügyfeleinek neve, elérhetősége, foglalási időpontok és megjegyzések.</li>
          <li><strong className="text-brand-ink">Számlázási adatok:</strong> az előfizetéshez szükséges számlázási információk (a kártyaadatokat kizárólag a Stripe kezeli).</li>
          <li><strong className="text-brand-ink">Vendég-fizetési adatok (előleg, ajándékutalvány):</strong> ha a Felhasználó ezt a funkciót aktiválja, a vendég a foglalási előleget vagy az ajándékutalvány díját közvetlenül a Felhasználó saját, önálló Stripe Connect-fiókjába fizeti be — a kártyaadatokhoz és a fizetés lebonyolításához a Szolgáltató ebben a körben sem fér hozzá, azokat nem látja és nem tárolja.</li>
          <li><strong className="text-brand-ink">Számlázási adatok a vendég felé:</strong> ha a Felhasználó összekapcsolja saját Számlázz.hu- vagy Billingo-fiókját, a vendégnek szóló számla adatait (név, cím, adószám, tételek) a rendszer a Felhasználó fiókjába továbbítja; a számla kiállítója a Felhasználó.</li>
          <li><strong className="text-brand-ink">Ajánló program:</strong> az ajánló kódja, a linkre kattintások száma, és hogy kit ajánlott (a meghívott vállalkozás neve, regisztrációjának és előfizetésének állapota), a jóváírás érdekében.</li>
          <li><strong className="text-brand-ink">Technikai adatok:</strong> bejelentkezési és tevékenységi naplók (audit-napló), IP-cím, eszköz- és böngészőinformációk a biztonság és a hibaelhárítás érdekében; a kiküldött e-mailek naplója (címzett, tárgy, kézbesítés állapota).</li>
          <li><strong className="text-brand-ink">Értesítések:</strong> a felületen és — ha a felhasználó engedélyezi — böngésző-értesítésként (push) küldött értesítések. A böngésző-értesítés a vendég nevét és a foglalás idejét is tartalmazhatja, amely az eszköz zárolt képernyőjén is látszhat; ez az eszköz beállításaiban kikapcsolható.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Az adatkezelés célja és jogalapja">
        <ul className="list-disc pl-6 space-y-1">
          <li>A Szolgáltatás nyújtása és a fiók kezelése — jogalap: szerződés teljesítése [GDPR 6. cikk (1) b)].</li>
          <li>Számlázás és jogszabályi kötelezettségek teljesítése — jogalap: jogi kötelezettség [6. cikk (1) c)].</li>
          <li>A Szolgáltatás biztonsága, fejlesztése, visszaélések megelőzése — jogalap: jogos érdek [6. cikk (1) f)].</li>
          <li>Az ajánló program működtetése (jóváírás, visszaélések kiszűrése) — jogalap: szerződés teljesítése és jogos érdek [6. cikk (1) b) és f)].</li>
          <li>A platform és a foglalóoldalak látogatottságának mérése (Google Analytics) — jogalap: hozzájárulás [6. cikk (1) a)]; részletek a <a href="/cookies" className="font-medium text-brand-ink underline underline-offset-2">Sütikezelési tájékoztatóban</a>.</li>
          <li>Ügyfél-értesítések küldése a Felhasználó nevében — jogalap: a Felhasználó adatkezelői utasítása.</li>
          <li id="marketing">
            Marketing-hírlevél/kampány-email küldése a Felhasználó (üzlet) nevében — jogalap: a vendég
            ÖNKÉNTES, előzetes hozzájárulása [6. cikk (1) a)], amit a foglaláskor egy külön, alapból
            kipipálatlan jelölőnégyzettel ad meg. A hozzájárulás bármikor, ingyenesen visszavonható —
            minden kiküldött hírlevél tartalmaz egyedi leiratkozó linket, aminek használatával a
            hozzájárulás azonnal törlődik. A hozzájárulás megtagadása/visszavonása a foglalást
            (a szolgáltatás igénybevételét) nem érinti. A hírlevél megnyitását és a benne lévő linkekre
            kattintást az e-mail-küldő szolgáltató technikai úton (képpont, átirányított link) méri,
            kizárólag a kampány eredményességének összesített kiértékeléséhez. Ezt a vendég a képek
            letiltásával kikapcsolhatja; a leiratkozással a mérés is megszűnik.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Adatfeldolgozók és továbbítás">
        <p>
          A Szolgáltatás működéséhez az alábbi adatfeldolgozókat (további adatfeldolgozókat) vesszük igénybe. Ezek
          kizárólag a megbízásunkból, a jelen tájékoztatóval összhangban kezelik az adatokat. Adatait harmadik félnek
          értékesítési célból nem adjuk át.
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong className="text-brand-ink">RackForest Kft.</strong> (Magyarország) — tárhely és szerver-üzemeltetés; az adatokat kizárólag az Európai Unión belül kezeli.</li>
          <li><strong className="text-brand-ink">Resend Inc.</strong> (Egyesült Államok) — e-mailek kézbesítése (belépési kódok, foglalási visszaigazolások, emlékeztetők, hírlevelek).</li>
          <li><strong className="text-brand-ink">Stripe Payments Europe, Ltd.</strong> (Írország) — az előfizetési díjak beszedése.</li>
          <li><strong className="text-brand-ink">KBOSS.hu Kft. (Számlázz.hu)</strong> (Magyarország) — az előfizetési számlák kiállítása.</li>
          <li><strong className="text-brand-ink">Google</strong> (Google Ireland Ltd., Írország, illetve Google LLC, Egyesült Államok) — belépés Google-fiókkal, címek kiegészítése, a Google-értékelések megjelenítése, és — hozzájárulás esetén — a látogatottság mérése (Google Analytics).</li>
          <li><strong className="text-brand-ink">A böngészők értesítési szolgáltatásai</strong> (pl. Google, Apple, Mozilla) — a böngésző-értesítések (push) kézbesítése, ha a felhasználó engedélyezte.</li>
        </ul>
        <p>
          A Felhasználó által aktivált vendég-fizetéseknél (előleg, ajándékutalvány, helyszíni fizetés, fizetési link)
          a Stripe a Felhasználó saját, önálló (Stripe Connect) fiókjaként működik közre, a vendégnek szóló számlákat
          pedig a Felhasználó saját Számlázz.hu- vagy Billingo- (Billingo Technologies Zrt.) fiókja állítja ki — ezekben
          a körökben a fizetési, illetve számlázási jogviszony a vendég, a Felhasználó és az adott szolgáltató között áll.
        </p>
        <p>
          <strong className="text-brand-ink">Adattovábbítás az EU-n kívülre.</strong> A Resend és a Google
          az adatokat az Egyesült Államokba is továbbíthatja. Ennek alapja az Európai Bizottság EU–USA
          adatvédelmi keretrendszerről szóló megfelelőségi határozata, illetve az Európai Bizottság által
          elfogadott általános szerződési feltételek.
        </p>
        <p>
          <strong className="text-brand-ink">A foglalóoldalak mérése.</strong> Ha a Felhasználó a foglalóoldalán
          saját mérőkódot (Google Analytics, Meta Pixel) állít be, ezt a mérést a Felhasználó végzi, és annak ő
          az adatkezelője; a mérőkód csak a látogató hozzájárulása után töltődik be. A Felhasználó köteles ezt a
          saját adatkezelési tájékoztatójában is feltüntetni.
        </p>
      </LegalSection>

      <LegalSection heading="6. Adatmegőrzés">
        <p>
          A személyes adatokat a fiók fennállásáig, illetve a cél eléréséhez szükséges ideig kezeljük:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>fiók-, foglalási és vendégadatok: a fiók (illetve az adott üzlet) törléséig;</li>
          <li>zárolt (lejárt próbaidejű vagy nem fizetett) fiók adatai: a zárolástól számított legfeljebb 12 hónapig;</li>
          <li>belépési kódok: néhány percig, felhasználásukig; munkamenetek: kilépésig vagy lejáratukig;</li>
          <li>értesítések: 30, illetve 60 napig;</li>
          <li>audit-napló és e-mail-napló: legfeljebb 12 hónapig;</li>
          <li>ajánló-adatok: a fiók fennállásáig;</li>
          <li>számlázási bizonylatok: a számviteli jogszabályokban előírt ideig (8 évig).</li>
        </ul>
        <p>
          A fiók vagy egy üzlet törlésekor az adatok azonnal törlődnek az éles rendszerből, a biztonsági
          mentésekből pedig legkésőbb 30 napon belül, kivéve ahol jogszabály a megőrzést előírja.
        </p>
      </LegalSection>

      <LegalSection heading="7. Adatbiztonság">
        <p>
          A Szolgáltató megfelelő technikai és szervezési intézkedéseket alkalmaz az adatok védelmére
          (titkosított adatátvitel, a belépési kódok és a külső szolgáltatások kulcsainak titkosított tárolása, hozzáférés-korlátozás, naplózás, rendszeres mentés). Ugyanakkor a
          jogszabály által megengedett mértékig kizárt a Szolgáltató felelőssége az olyan adatvédelmi
          incidensekért, amelyek a Felhasználó hibájából (pl. belépési adatai megosztásából) vagy
          rajta kívül álló okból következnek be.
        </p>
      </LegalSection>

      <LegalSection heading="8. Az érintett jogai">
        <p>Az érintett a rá vonatkozó személyes adatok tekintetében jogosult:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>tájékoztatást és hozzáférést kérni,</li>
          <li>helyesbítést, törlést vagy az adatkezelés korlátozását kérni,</li>
          <li>az adathordozhatósághoz való jogát gyakorolni,</li>
          <li>tiltakozni az adatkezelés ellen, illetve hozzájárulását visszavonni.</li>
        </ul>
        <p>
          A Felhasználó ügyfeleit (a foglaló vendégeket) megillető jogok teljesítése — mivel ezen
          adatok tekintetében a Felhasználó az adatkezelő — elsődlegesen a Felhasználó felelőssége; a
          Szolgáltató adatfeldolgozóként ehhez ésszerű támogatást nyújt.
        </p>
      </LegalSection>

      <LegalSection heading="9. Jogorvoslat">
        <p>
          Adatvédelmi kérdéseivel forduljon hozzánk a{' '}
          <a href="mailto:hello@davelopment.hu" className="font-medium text-brand-ink underline underline-offset-2">
            hello@davelopment.hu
          </a>{' '}
          címen. Jogai sérelme esetén panasszal élhet a Nemzeti Adatvédelmi és Információszabadság
          Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9–11.), illetve bírósághoz fordulhat.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
