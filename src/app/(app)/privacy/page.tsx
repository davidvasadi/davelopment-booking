import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'A davelopment booking adatkezelési tájékoztatója a GDPR rendelkezéseivel összhangban.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Adatkezelési tájékoztató" updated="2026. június 24.">
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
          <li>Név / cégnév: <strong className="text-brand-ink">[Üzemeltető neve]</strong></li>
          <li>Székhely: <strong className="text-brand-ink">[Székhely]</strong></li>
          <li>Nyilvántartási szám: <strong className="text-brand-ink">[Nyilvántartási szám]</strong></li>
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
          tekintetében a Szolgáltató önálló adatkezelő.
        </p>
      </LegalSection>

      <LegalSection heading="3. A kezelt adatok köre">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong className="text-brand-ink">Fiókadatok:</strong> név, e-mail cím, jelszó (titkosított formában tárolva), vállalkozás neve, telefonszám, település.</li>
          <li><strong className="text-brand-ink">Foglalási adatok:</strong> a Felhasználó ügyfeleinek neve, elérhetősége, foglalási időpontok és megjegyzések.</li>
          <li><strong className="text-brand-ink">Számlázási adatok:</strong> az előfizetéshez szükséges számlázási információk (a kártyaadatokat kizárólag a Stripe kezeli).</li>
          <li><strong className="text-brand-ink">Technikai adatok:</strong> bejelentkezési naplók, IP-cím, eszköz- és böngészőinformációk a biztonság és a hibaelhárítás érdekében.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Az adatkezelés célja és jogalapja">
        <ul className="list-disc pl-6 space-y-1">
          <li>A Szolgáltatás nyújtása és a fiók kezelése — jogalap: szerződés teljesítése [GDPR 6. cikk (1) b)].</li>
          <li>Számlázás és jogszabályi kötelezettségek teljesítése — jogalap: jogi kötelezettség [6. cikk (1) c)].</li>
          <li>A Szolgáltatás biztonsága, fejlesztése, visszaélések megelőzése — jogalap: jogos érdek [6. cikk (1) f)].</li>
          <li>Ügyfél-értesítések küldése a Felhasználó nevében — jogalap: a Felhasználó adatkezelői utasítása.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Adatfeldolgozók és továbbítás">
        <p>
          A Szolgáltatás működéséhez gondosan kiválasztott adatfeldolgozókat veszünk igénybe (tárhely-
          és infrastruktúra-szolgáltató, e-mail-küldő szolgáltató, valamint a fizetésekhez a{' '}
          <strong className="text-brand-ink">Stripe Payments Europe, Ltd.</strong>). Ezek kizárólag a
          megbízásunkból, a jelen tájékoztatóval összhangban kezelik az adatokat. Adatait harmadik
          félnek értékesítési célból nem adjuk át. Az EU-n kívülre történő esetleges adattovábbítás
          kizárólag megfelelő garanciák (pl. az Európai Bizottság általános szerződési feltételei)
          mellett történhet.
        </p>
      </LegalSection>

      <LegalSection heading="6. Adatmegőrzés">
        <p>
          A személyes adatokat a fiók fennállásáig, illetve a cél eléréséhez szükséges ideig kezeljük.
          A számlázási bizonylatokat a számviteli jogszabályokban előírt ideig (jellemzően 8 évig)
          megőrizzük. A fiók törlését követően az adatokat ésszerű határidőn belül véglegesen töröljük
          vagy visszafordíthatatlanul anonimizáljuk, kivéve ahol jogszabály a megőrzést előírja.
        </p>
      </LegalSection>

      <LegalSection heading="7. Adatbiztonság">
        <p>
          A Szolgáltató megfelelő technikai és szervezési intézkedéseket alkalmaz az adatok védelmére
          (titkosított adatátvitel, jelszavak hash-elt tárolása, hozzáférés-korlátozás). Ugyanakkor a
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
